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
import type { LineSegment, Point } from '@/lib/visibilityEngine';
import { computeVisibilityFromSegments } from '@/lib/visibilityEngine';
import { animatedTextureManager } from '@/lib/animatedTextureManager';

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
    // Skip aura effects — they are rendered separately by renderAuraEffects
    if (effect.isAura) continue;

    // Compute fade-out multiplier
    let fadeMul = 1.0;
    if (effect.dismissedAt) {
      const fadeAge = rc.time - effect.dismissedAt;
      fadeMul = Math.max(0, 1.0 - fadeAge / FADE_OUT_DURATION);
      if (fadeMul <= 0.01) continue; // fully faded — skip rendering
    }

    // Polyline effects use waypoints for rendering
    if (effect.template.shape === 'polyline' && effect.waypoints && effect.waypoints.length >= 2) {
      renderPolylineEffect(rc, effect, fadeMul);
    } else {
      renderEffect(rc, effect.template, effect.origin, effect.direction ?? 0, fadeMul, effect.animationPaused);
    }
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

  // Polyline placement preview
  if (placement.step === 'polyline') {
    renderPolylinePlacementPreview(rc, placement);
    rc.ctx.restore();
    return;
  }

  // For token-sourced placement, compute perimeter origin (non-ranged only)
  let effectOrigin = previewOrigin;
  const isRangedTokenSourced = placement.casterToken && template.ranged;
  if (placement.casterToken && placement.step === 'direction' && !isRangedTokenSourced) {
    effectOrigin = computeTokenSourcedOrigin(
      placement.casterToken,
      previewDirection,
      rc.gridSize,
      template.shape,
    );
  }

  // Draw spell intent line for token-sourced placements
  // For non-ranged: only during direction step; for ranged: during both steps
  if (placement.casterToken && (
    (placement.step === 'direction' && !isRangedTokenSourced) ||
    isRangedTokenSourced
  )) {
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
    ? { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5, rotationAngle: 0 }
    : computeAnimation(template.animation, template.animationSpeed, rc.time, template.id, template.rotateDirection);

  const opacity = template.opacity * anim.opacityMod * fadeMul;
  const scale = anim.scaleMod;

  if (opacity <= 0.01) {
    rc.ctx.restore();
    return;
  }

  rc.ctx.globalAlpha = Math.min(1, Math.max(0, opacity));

  // Apply scale and/or rotation transforms around origin
  const needsScale = Math.abs(scale - 1.0) > 0.001;
  const needsRotation = Math.abs(anim.rotationAngle) > 0.001;
  if (needsScale || needsRotation) {
    rc.ctx.translate(origin.x, origin.y);
    if (needsScale) rc.ctx.scale(scale, scale);
    if (needsRotation) rc.ctx.rotate(anim.rotationAngle);
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
// Texture image cache
// ---------------------------------------------------------------------------

const textureImageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();

type TextureSource = HTMLImageElement | ImageBitmap;

function getTextureImage(url: string): TextureSource | null {
  // Check for animated frame first (GIFs decoded via ImageDecoder)
  const animatedFrame = animatedTextureManager.getCurrentFrame(url);
  if (animatedFrame) return animatedFrame;

  // Preload animated textures if not yet decoded
  if (animatedTextureManager.mightBeAnimated(url)) {
    animatedTextureManager.preload(url);
  }

  const cached = textureImageCache.get(url);
  if (cached instanceof HTMLImageElement) return cached;
  if (cached === 'loading' || cached === 'error') return null;
  // Start loading
  const img = new Image();
  // Only set crossOrigin for non-data URLs (data: URIs don't need CORS and it can cause issues)
  if (!url.startsWith('data:')) {
    img.crossOrigin = 'anonymous';
  }
  textureImageCache.set(url, 'loading');
  img.onload = () => textureImageCache.set(url, img);
  img.onerror = (e) => {
    console.warn('[effectRenderer] Failed to load texture:', url.substring(0, 80), e);
    textureImageCache.set(url, 'error');
  };
  img.src = url;
  return null;
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
  const path = buildPath(template, origin, direction, gridSize);

  // Draw color fill first (acts as fallback / tint under texture)
  ctx.fillStyle = color;
  ctx.fill(path);

  // Draw texture if present and loaded (skip for colorOverride glow passes)
  if (template.texture && !colorOverride) {
    const src = getTextureImage(template.texture);
    if (src) {
      drawTextureInPath(ctx, src, path, template, origin, direction, gridSize);
    }
  }
}

/**
 * Draw a texture image clipped to the effect's Path2D shape.
 * Uses textureScale and offset fields for positioning.
 */
function drawTextureInPath(
  ctx: CanvasRenderingContext2D,
  img: TextureSource,
  path: Path2D,
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
  gridSize: number,
): void {
  const scale = (template.textureScale ?? 1);
  const offsetX = (template.textureOffsetX ?? 0);
  const offsetY = (template.textureOffsetY ?? 0);
  const repeat = template.textureRepeat ?? false;

  // Compute bounding size of the effect in pixels for image sizing
  let boundW: number;
  let boundH: number;
  switch (template.shape) {
    case 'circle':
    case 'circle-burst': {
      const r = (template.radius ?? 4) * gridSize;
      boundW = boundH = r * 2;
      break;
    }
    case 'cone': {
      const len = (template.length ?? 6) * gridSize;
      boundW = boundH = len * 2;
      break;
    }
    case 'rectangle':
    case 'rectangle-burst':
      boundW = (template.width ?? 2) * gridSize;
      boundH = (template.length ?? 2) * gridSize;
      break;
    case 'line':
      boundW = (template.length ?? 12) * gridSize;
      boundH = (template.width ?? 1) * gridSize;
      break;
    default:
      boundW = boundH = gridSize * 4;
  }

  const imgWidth = img instanceof HTMLImageElement ? img.width : img.width;
  const imgHeight = img instanceof HTMLImageElement ? img.height : img.height;

  ctx.save();
  ctx.clip(path);
  ctx.translate(origin.x, origin.y);
  ctx.rotate(direction);

  if (repeat) {
    // Tile/repeat mode: draw repeating tiles at user scale
    const tileW = imgWidth * scale;
    const tileH = imgHeight * scale;
    if (tileW > 0 && tileH > 0) {
      const halfW = boundW / 2;
      const halfH = boundH / 2;
      const ox = ((offsetX % tileW) + tileW) % tileW;
      const oy = ((offsetY % tileH) + tileH) % tileH;
      for (let py = -halfH - tileH + oy; py < halfH + tileH; py += tileH) {
        for (let px = -halfW - tileW + ox; px < halfW + tileW; px += tileW) {
          ctx.drawImage(img, px, py, tileW, tileH);
        }
      }
    }
  } else {
    // Cover-fit mode: scale image to cover the bounding box, centered, with user scale & offset
    const imgAspect = imgWidth / imgHeight;
    const boundAspect = boundW / boundH;
    let drawW: number, drawH: number;
    if (imgAspect > boundAspect) {
      drawH = boundH;
      drawW = boundH * imgAspect;
    } else {
      drawW = boundW;
      drawH = boundW / imgAspect;
    }
    drawW *= scale;
    drawH *= scale;

    ctx.drawImage(
      img,
      -drawW / 2 + offsetX,
      -drawH / 2 + offsetY,
      drawW,
      drawH,
    );
  }
  ctx.restore();
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
    case 'polyline':
      // Polyline is rendered differently — this fallback creates an empty path
      return new Path2D();
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
  /** Rotation angle in radians (used by 'rotate' animation) */
  rotationAngle: number;
}

function computeAnimation(type: EffectAnimationType, speed: number, time: number, id: string, rotateDirection?: string): AnimationMods {
  const base: AnimationMods = { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5, rotationAngle: 0 };
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
        rotationAngle: 0,
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
        rotationAngle: 0,
      };
    }
    case 'pulse': {
      const p = (Math.sin(t * 2 + phase) + 1) * 0.5;
      return { opacityMod: 0.7 + p * 0.3, scaleMod: 0.97 + p * 0.06, colorShift: p, glowMod: p, rotationAngle: 0 };
    }
    case 'expand': {
      const e = (Math.sin(t * 1.5 + phase) + 1) * 0.5;
      return { opacityMod: 0.8 + e * 0.2, scaleMod: 0.95 + e * 0.1, colorShift: e * 0.5, glowMod: e, rotationAngle: 0 };
    }
    case 'swirl': {
      const s1 = (Math.sin(t * 1.2 + phase) + 1) * 0.5;
      const s2 = (Math.sin(t * 0.7 + phase * 2.1) + 1) * 0.5;
      return { opacityMod: 0.75 + s1 * 0.25, scaleMod: 0.98 + s2 * 0.04, colorShift: s1 * 0.7, glowMod: s2 * 0.8, rotationAngle: 0 };
    }
    case 'rotate': {
      // Continuous rotation: full revolution based on speed (speed=1 → ~6s per revolution)
      const dir = rotateDirection === 'ccw' ? -1 : 1;
      const angle = t * 1.0 * dir; // radians, continuous
      return { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5, rotationAngle: angle };
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

// ---------------------------------------------------------------------------
// Polyline rendering
// ---------------------------------------------------------------------------

/**
 * Render a placed polyline effect (thick stroked path with rounded caps).
 */
function renderPolylineEffect(
  rc: EffectRenderContext,
  effect: PlacedEffect,
  fadeMul: number,
): void {
  const { ctx, time, gridSize } = rc;
  const template = effect.template;
  const waypoints = effect.waypoints!;
  const widthPx = (template.segmentWidth ?? 0.2) * gridSize;

  const anim = effect.animationPaused
    ? { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5, rotationAngle: 0 }
    : computeAnimation(template.animation, template.animationSpeed, time, effect.id, template.rotateDirection);

  const opacity = template.opacity * anim.opacityMod * fadeMul;
  if (opacity <= 0.01) return;

  ctx.save();

  // Outer glow
  if (template.secondaryColor && template.animation !== 'none') {
    ctx.globalAlpha = Math.min(1, opacity * 0.3 * anim.glowMod);
    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = widthPx * 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();
  }

  // Main wall stroke
  ctx.globalAlpha = Math.min(1, opacity);
  ctx.strokeStyle = template.color;
  ctx.lineWidth = widthPx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(waypoints[0].x, waypoints[0].y);
  for (let i = 1; i < waypoints.length; i++) {
    ctx.lineTo(waypoints[i].x, waypoints[i].y);
  }
  ctx.stroke();

  // Inner bright core
  ctx.globalAlpha = Math.min(1, opacity * 0.6);
  ctx.strokeStyle = template.secondaryColor ?? '#ffffff';
  ctx.lineWidth = Math.max(1, widthPx * 0.3);
  ctx.beginPath();
  ctx.moveTo(waypoints[0].x, waypoints[0].y);
  for (let i = 1; i < waypoints.length; i++) {
    ctx.lineTo(waypoints[i].x, waypoints[i].y);
  }
  ctx.stroke();

  // Draw waypoint dots
  ctx.globalAlpha = Math.min(1, opacity * 0.5);
  ctx.fillStyle = '#ffffff';
  for (const wp of waypoints) {
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, Math.max(2, widthPx * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Render the polyline placement preview: committed segments + live segment to cursor.
 */
function renderPolylinePlacementPreview(
  rc: EffectRenderContext,
  placement: EffectPlacementState,
): void {
  const { ctx, gridSize, time } = rc;
  const template = placement.template;
  const waypoints = placement.polylineWaypoints ?? [];
  const widthPx = (template.segmentWidth ?? 0.2) * gridSize;
  const maxLenPx = (template.maxLength ?? 12) * gridSize;
  const usedPx = (placement.polylineLengthUsed ?? 0) * gridSize;

  // Draw spell intent line from caster if token-sourced
  if (placement.casterToken && waypoints.length > 0) {
    renderSpellIntentLine(rc, placement.casterToken, waypoints[0], template.color);
  }

  // Draw committed segments
  if (waypoints.length >= 2) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = template.color;
    ctx.lineWidth = widthPx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();
  }

  // Draw waypoint markers
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = template.color;
  for (const wp of waypoints) {
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, Math.max(3, widthPx * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw live segment from last waypoint to cursor
  if (waypoints.length > 0 && placement.previewOrigin) {
    const last = waypoints[waypoints.length - 1];
    const cursor = placement.previewOrigin;

    // Clamp cursor distance to remaining length
    const dx = cursor.x - last.x;
    const dy = cursor.y - last.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const remainPx = maxLenPx - usedPx;
    let endX = cursor.x;
    let endY = cursor.y;
    if (segLen > remainPx && segLen > 0) {
      endX = last.x + (dx / segLen) * remainPx;
      endY = last.y + (dy / segLen) * remainPx;
    }

    // Dashed preview line
    ctx.globalAlpha = 0.4 + Math.sin(time * 0.004) * 0.15;
    ctx.strokeStyle = template.color;
    ctx.lineWidth = widthPx;
    ctx.lineCap = 'round';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Length remaining indicator
    const remainUnits = Math.max(0, (template.maxLength ?? 12) - (placement.polylineLengthUsed ?? 0));
    const remainFt = remainUnits * 5;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = remainUnits < 2 ? '#ef4444' : '#ffffff';
    ctx.font = `bold ${Math.max(10, gridSize * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${remainFt}ft left`, (last.x + endX) / 2, (last.y + endY) / 2 - widthPx - 4);
  }
}

// ---------------------------------------------------------------------------
// Aura rendering — visibility-clipped translucent circle
// ---------------------------------------------------------------------------

export interface AuraRenderContext extends EffectRenderContext {
  /** Wall/obstacle segments for visibility clipping */
  wallSegments: LineSegment[];
  /** Token positions keyed by ID — used to find the anchor token */
  tokenPositions: Map<string, { x: number; y: number }>;
}

/**
 * Render all aura effects. Auras are drawn as visibility-clipped translucent
 * circles centered on their anchor token. The visibility engine clips the
 * circle by walls, so the aura doesn't bleed through walls.
 */
export function renderAuraEffects(
  rc: AuraRenderContext,
  effects: PlacedEffect[],
): void {
  const auraEffects = effects.filter(e => e.isAura && e.anchorTokenId && e.template.aura);
  if (auraEffects.length === 0) return;

  for (const effect of auraEffects) {
    // Compute fade-out multiplier
    let fadeMul = 1.0;
    if (effect.dismissedAt) {
      const fadeAge = rc.time - effect.dismissedAt;
      fadeMul = Math.max(0, 1.0 - fadeAge / FADE_OUT_DURATION);
      if (fadeMul <= 0.01) continue;
    }

    const anchorPos = rc.tokenPositions.get(effect.anchorTokenId!);
    if (!anchorPos) continue;

    const aura = effect.template.aura!;
    const radiusPx = (effect.template.radius ?? 1) * rc.gridSize;
    const center: Point = { x: anchorPos.x, y: anchorPos.y };

    // Animation
    const anim = effect.animationPaused
      ? { opacityMod: 1, scaleMod: 1, colorShift: 0, glowMod: 0.5, rotationAngle: 0 }
      : computeAnimation(effect.template.animation, effect.template.animationSpeed, rc.time, effect.id, effect.template.rotateDirection);

    const opacity = effect.template.opacity * anim.opacityMod * fadeMul;
    if (opacity <= 0.01) continue;

    const { ctx } = rc;
    ctx.save();

    // If wall-blocked (default true), clip to visibility polygon
    const wallBlocked = aura.wallBlocked !== false;
    if (wallBlocked && rc.wallSegments.length > 0) {
      const vis = computeVisibilityFromSegments(center, rc.wallSegments, radiusPx);
      if (vis.polygon.length >= 3) {
        // Build clipping path from visibility polygon
        const clipPath = new Path2D();
        clipPath.moveTo(vis.polygon[0].x, vis.polygon[0].y);
        for (let i = 1; i < vis.polygon.length; i++) {
          clipPath.lineTo(vis.polygon[i].x, vis.polygon[i].y);
        }
        clipPath.closePath();
        ctx.clip(clipPath);
      }
    }

    // Draw filled aura circle (will be clipped by visibility polygon)
    const auraRadius = radiusPx * anim.scaleMod;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = effect.template.color;
    ctx.beginPath();
    ctx.arc(center.x, center.y, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw texture if present (clipped by both visibility polygon and circle)
    if (effect.template.texture) {
      const src = getTextureImage(effect.template.texture);
      if (src) {
        const circlePath = new Path2D();
        circlePath.arc(center.x, center.y, auraRadius, 0, Math.PI * 2);
        circlePath.closePath();
        drawTextureInPath(ctx, src, circlePath, effect.template, center, 0, rc.gridSize);
      }
    }

    // Radial gradient edge fade
    ctx.globalAlpha = opacity * 0.6;
    const grad = ctx.createRadialGradient(
      center.x, center.y, radiusPx * 0.3,
      center.x, center.y, radiusPx * anim.scaleMod,
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.7, 'transparent');
    grad.addColorStop(1, effect.template.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx * anim.scaleMod, 0, Math.PI * 2);
    ctx.fill();

    // Outline ring
    ctx.globalAlpha = Math.min(1, opacity * 1.5);
    ctx.strokeStyle = effect.template.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx * anim.scaleMod, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }
}
