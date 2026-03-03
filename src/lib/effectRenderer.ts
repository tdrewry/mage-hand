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
import { isBurstShape } from '@/types/effectTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FADE_OUT_DURATION = 500; // ms

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EffectRenderContext {
  ctx: CanvasRenderingContext2D;
  /** Current animation time (performance.now()) */
  time: number;
  /** Grid cell size in pixels */
  gridSize: number;
  /** Current zoom level — needed for screen-space sizing */
  zoom?: number;
}

/**
 * Render all placed effects onto the canvas.
 */
export function renderPlacedEffects(
  rc: EffectRenderContext,
  effects: PlacedEffect[],
): void {
  for (const effect of effects) {
    // Compute fade-out multiplier
    let fadeMul = 1.0;
    if (effect.dismissedAt) {
      const fadeAge = rc.time - effect.dismissedAt;
      fadeMul = Math.max(0, 1.0 - fadeAge / FADE_OUT_DURATION);
      if (fadeMul <= 0.01) continue; // fully faded — skip rendering
    }

    renderEffect(rc, effect.template, effect.origin, effect.direction ?? 0, fadeMul, effect.animationPaused);
  }
}

/**
 * Hit-test a world-coordinate point against placed effects.
 * Returns the first (topmost) effect whose shape contains the point, or null.
 */
export function hitTestEffectAtPoint(
  effects: PlacedEffect[],
  worldX: number,
  worldY: number,
  gridSize: number,
): PlacedEffect | null {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (effect.dismissedAt) continue;
    const path = buildPath(effect.template, effect.origin, effect.direction ?? 0, gridSize);
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const testCtx = testCanvas.getContext('2d');
    if (testCtx && testCtx.isPointInPath(path, worldX, worldY)) {
      return effect;
    }
  }
  return null;
}

/**
 * Compute the effect origin on a token's circular perimeter edge.
 * For burst shapes, returns the token center.
 * For all other shapes, returns the point on the token's circular perimeter
 * in the given direction.
 */
export function computeTokenSourcedOrigin(
  casterToken: { x: number; y: number; gridWidth: number; gridHeight: number },
  direction: number,
  gridSize: number,
  shape: EffectTemplate['shape'],
): { x: number; y: number } {
  // Burst shapes center on the token
  if (isBurstShape(shape)) {
    return { x: casterToken.x, y: casterToken.y };
  }

  // All other shapes: origin on circular perimeter
  const tokenRadius = Math.max(casterToken.gridWidth, casterToken.gridHeight) * gridSize / 2;
  return {
    x: casterToken.x + Math.cos(direction) * tokenRadius,
    y: casterToken.y + Math.sin(direction) * tokenRadius,
  };
}

/**
 * Render a placement preview (semi-transparent, pulsing outline).
 * For token-sourced placements, draws the spell intent line and computes
 * perimeter origin for non-burst shapes.
 */
export function renderPlacementPreview(
  rc: EffectRenderContext,
  placement: EffectPlacementState,
): void {
  if (!placement.previewOrigin) return;
  const { template, previewOrigin, previewDirection } = placement;

  rc.ctx.save();

  // For token-sourced placement, compute perimeter origin
  let effectOrigin = previewOrigin;
  if (placement.casterToken && placement.step === 'direction') {
    effectOrigin = computeTokenSourcedOrigin(
      placement.casterToken,
      previewDirection,
      rc.gridSize,
      template.shape,
    );
  }

  // Draw spell intent line for token-sourced placements
  if (placement.casterToken && placement.step === 'direction') {
    renderSpellIntentLine(rc, placement.casterToken, effectOrigin, template.color);
  }

  // Draw the effect shape preview
  rc.ctx.globalAlpha = 0.4 + Math.sin(rc.time * 0.004) * 0.15;
  drawShape(rc, template, effectOrigin, previewDirection, 1.0);
  // Outline
  rc.ctx.globalAlpha = 0.8;
  strokeShape(rc, template, effectOrigin, previewDirection);

  // In direction step without caster token, draw origin crosshair
  if (placement.step === 'direction' && !placement.casterToken && placement.origin) {
    const o = placement.origin;
    const gs = rc.gridSize;
    const crossSize = gs * 0.5;

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

    rc.ctx.beginPath();
    rc.ctx.arc(o.x, o.y, gs * 0.15, 0, Math.PI * 2);
    rc.ctx.stroke();
  }

  rc.ctx.restore();
}

// ---------------------------------------------------------------------------
// Spell Intent Line (arcane-style animated line from caster to target)
// ---------------------------------------------------------------------------

function renderSpellIntentLine(
  rc: EffectRenderContext,
  casterToken: { x: number; y: number },
  targetOrigin: { x: number; y: number },
  color: string,
): void {
  const { ctx, time } = rc;
  const cx = casterToken.x;
  const cy = casterToken.y;
  const tx = targetOrigin.x;
  const ty = targetOrigin.y;

  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return;

  ctx.save();

  // Outer glow layer
  ctx.globalAlpha = 0.15 + Math.sin(time * 0.003) * 0.05;
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // Main animated dash line
  const dashSpeed = time * 0.15;
  ctx.globalAlpha = 0.6 + Math.sin(time * 0.005) * 0.15;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 8, 4, 8]);
  ctx.lineDashOffset = -dashSpeed;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // Inner bright core
  ctx.globalAlpha = 0.8 + Math.sin(time * 0.008 + 1.5) * 0.15;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 16]);
  ctx.lineDashOffset = -dashSpeed * 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // Animated particles along the line
  const particleCount = Math.floor(dist / 30);
  for (let i = 0; i < particleCount; i++) {
    const baseT = (i / particleCount);
    const animT = (baseT + (time * 0.0005)) % 1.0;
    const px = cx + dx * animT;
    const py = cy + dy * animT;
    const particleAlpha = Math.sin(animT * Math.PI) * 0.7;
    const particleSize = 1.5 + Math.sin(time * 0.01 + i * 2.1) * 0.8;

    ctx.globalAlpha = particleAlpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, particleSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Caster token indicator ring (subtle pulse)
  ctx.globalAlpha = 0.3 + Math.sin(time * 0.004) * 0.1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Core render dispatch
// ---------------------------------------------------------------------------

function renderEffect(
  rc: EffectRenderContext,
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
  fadeMul: number = 1.0,
  animationPaused?: boolean,
): void {
  rc.ctx.save();

  const anim = animationPaused
    ? { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5 }
    : computeAnimation(template.animation, template.animationSpeed, rc.time, template.id);

  const opacity = template.opacity * anim.opacityMod * fadeMul;
  const scale = anim.scaleMod;

  if (opacity <= 0.01) {
    rc.ctx.restore();
    return;
  }

  rc.ctx.globalAlpha = Math.min(1, Math.max(0, opacity));

  if (Math.abs(scale - 1.0) > 0.001) {
    rc.ctx.translate(origin.x, origin.y);
    rc.ctx.scale(scale, scale);
    rc.ctx.translate(-origin.x, -origin.y);
  }

  drawShape(rc, template, origin, direction, anim.colorShift);

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
      return buildRectPath(origin, (template.width ?? 2) * gridSize, (template.length ?? 2) * gridSize, direction);
    case 'line':
      return buildLinePath(origin, (template.length ?? 12) * gridSize, (template.width ?? 1) * gridSize, direction);
    case 'cone':
      return buildConePath(origin, (template.length ?? 6) * gridSize, (template.angle ?? 53) * (Math.PI / 180), direction);
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

function buildRectPath(origin: { x: number; y: number }, width: number, length: number, direction: number): Path2D {
  const hw = width / 2;
  const hl = length / 2;
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  const corners = [
    { x: -hl, y: -hw }, { x: hl, y: -hw }, { x: hl, y: hw }, { x: -hl, y: hw },
  ];
  const p = new Path2D();
  corners.forEach((c, i) => {
    const wx = origin.x + c.x * cos - c.y * sin;
    const wy = origin.y + c.x * sin + c.y * cos;
    if (i === 0) p.moveTo(wx, wy); else p.lineTo(wx, wy);
  });
  p.closePath();
  return p;
}

function buildLinePath(origin: { x: number; y: number }, length: number, width: number, direction: number): Path2D {
  const hw = width / 2;
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  const corners = [
    { x: 0, y: -hw }, { x: length, y: -hw }, { x: length, y: hw }, { x: 0, y: hw },
  ];
  const p = new Path2D();
  corners.forEach((c, i) => {
    const wx = origin.x + c.x * cos - c.y * sin;
    const wy = origin.y + c.x * sin + c.y * cos;
    if (i === 0) p.moveTo(wx, wy); else p.lineTo(wx, wy);
  });
  p.closePath();
  return p;
}

function buildConePath(origin: { x: number; y: number }, length: number, angle: number, direction: number): Path2D {
  const halfAngle = angle / 2;
  const p = new Path2D();
  p.moveTo(origin.x, origin.y);
  p.arc(origin.x, origin.y, length, direction - halfAngle, direction + halfAngle);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Animation system
// ---------------------------------------------------------------------------

interface AnimationMods {
  opacityMod: number;
  scaleMod: number;
  colorShift: number;
  glowMod: number;
}

function computeAnimation(type: EffectAnimationType, speed: number, time: number, id: string): AnimationMods {
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
      return { opacityMod: 0.7 + p * 0.3, scaleMod: 0.97 + p * 0.06, colorShift: p, glowMod: p };
    }
    case 'expand': {
      const e = (Math.sin(t * 1.5 + phase) + 1) * 0.5;
      return { opacityMod: 0.8 + e * 0.2, scaleMod: 0.95 + e * 0.1, colorShift: e * 0.5, glowMod: e };
    }
    case 'swirl': {
      const s1 = (Math.sin(t * 1.2 + phase) + 1) * 0.5;
      const s2 = (Math.sin(t * 0.7 + phase * 2.1) + 1) * 0.5;
      return { opacityMod: 0.75 + s1 * 0.25, scaleMod: 0.98 + s2 * 0.04, colorShift: s1 * 0.7, glowMod: s2 * 0.8 };
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
