/**
 * Effect Renderer
 *
 * Draws placed effects and placement previews on a Canvas 2D context.
 * Each shape is rendered with fill colour, opacity, and an optional
 * per-frame animation modifier (flicker, crackle, pulse, expand, swirl).
 *
 * Called from the main SimpleTabletop render loop once per frame.
 */

import type {
  EffectTemplate,
  EffectAnimationType,
  PlacedEffect,
  EffectPlacementState,
} from '@/types/effectTypes';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EffectRenderContext {
  ctx: CanvasRenderingContext2D;
  /** Current animation time (performance.now()) */
  time: number;
  /** Grid cell size in pixels */
  gridSize: number;
  /** Canvas transform already applied (translate + scale). Positions are world coords. */
}

/**
 * Render all placed effects onto the canvas.
 */
export function renderPlacedEffects(
  rc: EffectRenderContext,
  effects: PlacedEffect[],
): void {
  for (const effect of effects) {
    const age = rc.time - effect.placedAt;

    // Instant effects: play a 600 ms expand-then-fade animation
    if (effect.template.persistence === 'instant') {
      const INSTANT_DURATION = 600;
      if (age > INSTANT_DURATION) continue; // already finished
      const progress = age / INSTANT_DURATION; // 0 → 1
      renderEffect(rc, effect.template, effect.origin, effect.direction ?? 0, progress, true);
    } else {
      renderEffect(rc, effect.template, effect.origin, effect.direction ?? 0, 0, false);
    }
  }
}

/**
 * Render a placement preview (semi-transparent, pulsing outline).
 * In step 'origin': shows the shape centered on the cursor.
 * In step 'direction': shows the shape at the locked origin, oriented toward cursor,
 * plus a crosshair at the origin and a guide line.
 */
export function renderPlacementPreview(
  rc: EffectRenderContext,
  placement: EffectPlacementState,
): void {
  if (!placement.previewOrigin) return;
  const { template, previewOrigin, previewDirection } = placement;

  rc.ctx.save();

  // Draw the effect shape preview
  rc.ctx.globalAlpha = 0.4 + Math.sin(rc.time * 0.004) * 0.15;
  drawShape(rc, template, previewOrigin, previewDirection, 1.0);
  // Outline
  rc.ctx.globalAlpha = 0.8;
  strokeShape(rc, template, previewOrigin, previewDirection);

  // In direction step, draw origin crosshair and guide line
  if (placement.step === 'direction' && placement.origin) {
    const o = placement.origin;
    const gs = rc.gridSize;
    const crossSize = gs * 0.5;

    // Crosshair at origin
    rc.ctx.globalAlpha = 0.9;
    rc.ctx.strokeStyle = '#ffffff';
    rc.ctx.lineWidth = 2;
    rc.ctx.setLineDash([]);
    rc.ctx.beginPath();
    rc.ctx.moveTo(o.x - crossSize, o.y);
    rc.ctx.lineTo(o.x + crossSize, o.y);
    rc.ctx.moveTo(o.x, o.y - crossSize);
    rc.ctx.lineTo(o.x, o.y + crossSize);
    rc.ctx.stroke();

    // Small circle at origin
    rc.ctx.beginPath();
    rc.ctx.arc(o.x, o.y, gs * 0.15, 0, Math.PI * 2);
    rc.ctx.stroke();
  }

  rc.ctx.restore();
}

// ---------------------------------------------------------------------------
// Core render dispatch
// ---------------------------------------------------------------------------

function renderEffect(
  rc: EffectRenderContext,
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
  instantProgress: number,
  isInstant: boolean,
): void {
  rc.ctx.save();

  // Compute animation modifiers
  const anim = computeAnimation(
    template.animation,
    template.animationSpeed,
    rc.time,
    template.id,
  );

  let opacity = template.opacity * anim.opacityMod;
  let scale = anim.scaleMod;

  // Instant effects: expand then fade
  if (isInstant) {
    const expandPhase = Math.min(instantProgress / 0.3, 1.0); // 0-30% = expand
    const fadePhase = Math.max((instantProgress - 0.5) / 0.5, 0); // 50-100% = fade
    scale *= 0.2 + expandPhase * 0.8; // grow from 20% to 100%
    opacity *= 1.0 - fadePhase;        // fade out in second half
  }

  if (opacity <= 0.01) {
    rc.ctx.restore();
    return;
  }

  rc.ctx.globalAlpha = Math.min(1, Math.max(0, opacity));

  // Apply scale around origin
  if (Math.abs(scale - 1.0) > 0.001) {
    rc.ctx.translate(origin.x, origin.y);
    rc.ctx.scale(scale, scale);
    rc.ctx.translate(-origin.x, -origin.y);
  }

  drawShape(rc, template, origin, direction, anim.colorShift);

  // Secondary glow layer for animated effects
  if (template.animation !== 'none' && template.secondaryColor) {
    rc.ctx.globalAlpha = Math.min(1, opacity * 0.3 * anim.glowMod);
    drawShape(rc, template, origin, direction, anim.colorShift, template.secondaryColor);
  }

  rc.ctx.restore();
}

// ---------------------------------------------------------------------------
// Shape drawing
// ---------------------------------------------------------------------------

function drawShape(
  rc: EffectRenderContext,
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
  _colorShift: number,
  colorOverride?: string,
): void {
  const { ctx, gridSize } = rc;
  const color = colorOverride ?? template.color;

  ctx.fillStyle = color;

  const path = buildPath(template, origin, direction, gridSize);
  ctx.fill(path);
}

function strokeShape(
  rc: EffectRenderContext,
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
): void {
  const { ctx, gridSize } = rc;
  ctx.strokeStyle = template.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  const path = buildPath(template, origin, direction, gridSize);
  ctx.stroke(path);
  ctx.setLineDash([]);
}

function buildPath(
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
  gridSize: number,
): Path2D {
  switch (template.shape) {
    case 'circle':
    case 'circle-burst':
      return buildCirclePath(origin, (template.radius ?? 4) * gridSize);
    case 'rectangle':
    case 'rectangle-burst':
      return buildRectPath(
        origin,
        (template.width ?? 2) * gridSize,
        (template.length ?? 2) * gridSize,
        direction,
      );
    case 'line':
      return buildLinePath(
        origin,
        (template.length ?? 12) * gridSize,
        (template.width ?? 1) * gridSize,
        direction,
      );
    case 'cone':
      return buildConePath(
        origin,
        (template.length ?? 6) * gridSize,
        (template.angle ?? 53) * (Math.PI / 180),
        direction,
      );
    default:
      return buildCirclePath(origin, gridSize);
  }
}

// ---------------------------------------------------------------------------
// Path2D builders
// ---------------------------------------------------------------------------

function buildCirclePath(center: { x: number; y: number }, radius: number): Path2D {
  const p = new Path2D();
  p.arc(center.x, center.y, radius, 0, Math.PI * 2);
  p.closePath();
  return p;
}

function buildRectPath(
  origin: { x: number; y: number },
  width: number,
  length: number,
  direction: number,
): Path2D {
  const hw = width / 2;
  const hl = length / 2;
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  const corners = [
    { x: -hl, y: -hw },
    { x: hl, y: -hw },
    { x: hl, y: hw },
    { x: -hl, y: hw },
  ];
  const p = new Path2D();
  corners.forEach((c, i) => {
    const wx = origin.x + c.x * cos - c.y * sin;
    const wy = origin.y + c.x * sin + c.y * cos;
    if (i === 0) p.moveTo(wx, wy);
    else p.lineTo(wx, wy);
  });
  p.closePath();
  return p;
}

function buildLinePath(
  origin: { x: number; y: number },
  length: number,
  width: number,
  direction: number,
): Path2D {
  const hw = width / 2;
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  const corners = [
    { x: 0, y: -hw },
    { x: length, y: -hw },
    { x: length, y: hw },
    { x: 0, y: hw },
  ];
  const p = new Path2D();
  corners.forEach((c, i) => {
    const wx = origin.x + c.x * cos - c.y * sin;
    const wy = origin.y + c.x * sin + c.y * cos;
    if (i === 0) p.moveTo(wx, wy);
    else p.lineTo(wx, wy);
  });
  p.closePath();
  return p;
}

function buildConePath(
  origin: { x: number; y: number },
  length: number,
  angle: number,
  direction: number,
): Path2D {
  const halfAngle = angle / 2;
  const p = new Path2D();
  p.moveTo(origin.x, origin.y);
  // Arc from direction-halfAngle to direction+halfAngle
  p.arc(origin.x, origin.y, length, direction - halfAngle, direction + halfAngle);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Animation system
// ---------------------------------------------------------------------------

interface AnimationMods {
  opacityMod: number;  // multiplier on template opacity
  scaleMod: number;    // multiplier on effect radius/size
  colorShift: number;  // 0-1, blend toward secondaryColor
  glowMod: number;     // intensity of secondary glow layer
}

function computeAnimation(
  type: EffectAnimationType,
  speed: number,
  time: number,
  id: string,
): AnimationMods {
  const base: AnimationMods = { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5 };
  if (type === 'none') return base;

  const phase = hashId(id) * Math.PI * 2;
  const t = time * speed * 0.001;

  switch (type) {
    case 'flicker': {
      const f1 = Math.sin(t * 10 + phase) * 0.3;
      const f2 = Math.sin(t * 23 + phase * 1.4) * 0.2;
      const spike = Math.pow(Math.sin(t * 4 + phase), 8) * 0.25;
      const combined = f1 + f2 + spike;
      return {
        opacityMod: clamp(1.0 - combined * 0.4, 0.4, 1.0),
        scaleMod: 1.0 + combined * 0.02,
        colorShift: clamp(0.5 + combined, 0, 1),
        glowMod: clamp(0.5 + combined * 0.5, 0.2, 1),
      };
    }

    case 'crackle': {
      // Rapid stochastic flashes using multiple high-freq sines
      const c1 = Math.sin(t * 30 + phase) > 0.7 ? 1 : 0;
      const c2 = Math.sin(t * 47 + phase * 1.7) > 0.8 ? 0.6 : 0;
      const c3 = Math.sin(t * 13 + phase * 0.3) * 0.3;
      const flash = c1 + c2 + c3;
      return {
        opacityMod: clamp(0.5 + flash * 0.5, 0.3, 1.0),
        scaleMod: 1.0 + flash * 0.03,
        colorShift: flash > 0.5 ? 1 : 0,
        glowMod: flash,
      };
    }

    case 'pulse': {
      const p = (Math.sin(t * 2 + phase) + 1) * 0.5;
      return {
        opacityMod: 0.7 + p * 0.3,
        scaleMod: 0.97 + p * 0.06,
        colorShift: p,
        glowMod: p,
      };
    }

    case 'expand': {
      // Continuous breathing expansion (for persistent effects that use expand)
      const e = (Math.sin(t * 1.5 + phase) + 1) * 0.5;
      return {
        opacityMod: 0.8 + e * 0.2,
        scaleMod: 0.95 + e * 0.1,
        colorShift: e * 0.5,
        glowMod: e,
      };
    }

    case 'swirl': {
      // Slow rotation-like pulsing
      const s1 = (Math.sin(t * 1.2 + phase) + 1) * 0.5;
      const s2 = (Math.sin(t * 0.7 + phase * 2.1) + 1) * 0.5;
      return {
        opacityMod: 0.75 + s1 * 0.25,
        scaleMod: 0.98 + s2 * 0.04,
        colorShift: s1 * 0.7,
        glowMod: s2 * 0.8,
      };
    }

    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function hashId(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xFFFFFFFF;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
