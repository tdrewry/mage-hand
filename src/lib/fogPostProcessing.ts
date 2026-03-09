/**
 * Fog Post-Processing Effects
 *
 * COORDINATE SPACE
 * ================
 * All canvases here (fogCanvas, illuminationCanvas, dimZoneCanvas) are sized
 * totalSize(contentW) × totalSize(contentH) — identical to the PixiJS canvas.
 *
 * "Content" here means the bounding box of all regions + tokens in screen/CSS px,
 * possibly larger than the browser viewport when the map is zoomed out far.
 *
 * Content is rendered with:
 *   ctx.translate(FIXED_PADDING - originX + transform.x,
 *                 FIXED_PADDING - originY + transform.y)
 *   ctx.scale(transform.zoom, transform.zoom)
 *
 * originX/Y = CSS px position of the content bbox top-left relative to the container.
 * When content fits entirely inside the viewport both are 0 and the formula collapses
 * to the original FIXED_PADDING + pan.x / pan.y.
 *
 * CLIPPING ARCHITECTURE
 * =====================
 * Every illumination source has two independent clip masks that are always intersected:
 *
 *  1. clipShape — the geometric boundary of the light:
 *       'circle' (default): a full circle of `range * gridSize` pixels radius.
 *       'cone'   (future):  a wedge sector defined by coneAngle + coneDirection.
 *
 *  2. visibilityPolygon — a Path2D computed by the visibility engine to account for
 *       wall occlusion.  Optional; when absent only the clipShape is used.
 *
 * Canvas clip regions are intersected when multiple ctx.clip() calls are made
 * inside a save/restore block.  We clip to the geometric shape first, then to
 * the visibility polygon, giving us visibilityPolygon ∩ clipShape.
 *
 * This design makes light cones trivial to add later: set clipShape = 'cone',
 * provide coneAngle + coneDirection, and the existing rendering code just works.
 */

import {
  updateFogTexture,
  updateIlluminationTexture,
  updateEffectSettings,
  getEffectSettings,
  isPostProcessingReady,
  renderPostProcessing,
  setLastRenderTransform,
  panOffsetPostProcessing,
  repositionPostProcessing,
  resetPostProcessingOffset,
  FIXED_PADDING,
  type EffectSettings,
} from './postProcessingLayer';
import { calculateAnimationModifiers, type IlluminationSource } from '@/types/illumination';

export interface FogEffectConfig {
  enabled: boolean;
  edgeBlur: number;
  lightFalloff: number;
  volumetricEnabled: boolean;
  effectQuality: 'performance' | 'balanced' | 'cinematic';
}

export const DEFAULT_FOG_EFFECTS: FogEffectConfig = {
  enabled: true,
  edgeBlur: 8,
  lightFalloff: 0.5,
  volumetricEnabled: false,
  effectQuality: 'balanced',
};

let fogCanvas: HTMLCanvasElement | null = null;
let fogCtx: CanvasRenderingContext2D | null = null;
let illuminationCanvas: HTMLCanvasElement | null = null;
let illuminationCtx: CanvasRenderingContext2D | null = null;
let dimZoneCanvas: HTMLCanvasElement | null = null;
let dimZoneCtx: CanvasRenderingContext2D | null = null;
let lastUpdateTime = 0;
const MIN_UPDATE_INTERVAL = 16; // ~60fps max

// Fast-path tracking: when only pan changed, skip Canvas 2D redraw
let _lastFogMasks: object | null = null;  // identity check
let _lastIlluminationSources: object | null = null;  // identity check
let _lastFullRenderTime = 0;
const FULL_RENDER_INTERVAL = 100; // Force a full redraw at least every 100ms during pan
let _lastZoom = 0; // Track zoom for throttle bypass on zoom changes
const ZOOM_THROTTLE_INTERVAL = 50; // ~20fps cap during zoom to prevent GPU overload

// Content bbox dimensions tracked so we can guard resize calls
let _lastContentW = 0;
let _lastContentH = 0;

/**
 * Returns the padding used by the coordinate system.
 * Always FIXED_PADDING — exposed for callers that previously read a dynamic value.
 */
export function getEdgePadding(): number {
  return FIXED_PADDING;
}

/**
 * Initialize (or re-initialize) the off-screen canvases.
 * width/height = content bbox size in CSS px.
 * originX/Y   = CSS px position of the content bbox top-left inside the container.
 */
export function initFogCanvas(
  width: number,
  height: number,
  _padding?: number,
  originX = 0,
  originY = 0
): void {
  _lastContentW = width;
  _lastContentH = height;

  const totalW = width + FIXED_PADDING * 2;
  const totalH = height + FIXED_PADDING * 2;

  if (!fogCanvas) fogCanvas = document.createElement('canvas');
  fogCanvas.width = totalW;
  fogCanvas.height = totalH;
  fogCtx = fogCanvas.getContext('2d', { willReadFrequently: false });

  if (!illuminationCanvas) illuminationCanvas = document.createElement('canvas');
  illuminationCanvas.width = totalW;
  illuminationCanvas.height = totalH;
  illuminationCtx = illuminationCanvas.getContext('2d', { willReadFrequently: false });

  if (!dimZoneCanvas) dimZoneCanvas = document.createElement('canvas');
  dimZoneCanvas.width = totalW;
  dimZoneCanvas.height = totalH;
  dimZoneCtx = dimZoneCanvas.getContext('2d', { willReadFrequently: false });
}

/**
 * Resize the canvases when the content bbox or viewport changes.
 */
export function resizeFogCanvas(
  width: number,
  height: number,
  _padding?: number,
  originX = 0,
  originY = 0
): void {
  _lastContentW = width;
  _lastContentH = height;

  const totalW = width + FIXED_PADDING * 2;
  const totalH = height + FIXED_PADDING * 2;

  if (fogCanvas) { fogCanvas.width = totalW; fogCanvas.height = totalH; }
  if (illuminationCanvas) { illuminationCanvas.width = totalW; illuminationCanvas.height = totalH; }
  if (dimZoneCanvas) { dimZoneCanvas.width = totalW; dimZoneCanvas.height = totalH; }
}

export function getFogCanvasContext(): CanvasRenderingContext2D | null {
  return fogCtx;
}

interface IlluminationData {
  sources: IlluminationSource[];
  gridSize: number;
  transform: { x: number; y: number; zoom: number };
}

function parseColorToRGB(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const bigint = parseInt(hex, 16);
    return {
      r: ((bigint >> 16) & 255) / 255,
      g: ((bigint >> 8) & 255) / 255,
      b: (bigint & 255) / 255,
    };
  }
  return { r: 1, g: 1, b: 1 };
}

/**
 * Apply the geometric clip shape for an illumination source to the current context.
 *
 * This MUST be called while the world-space transform is active (translate + scale).
 * It clips the canvas to the source's geometric boundary (circle or cone).
 *
 * If a visibilityPolygon is also present, call ctx.clip(visibilityPolygon) AFTER
 * this function — Canvas 2D clips intersect, so the result is shape ∩ polygon.
 *
 * @param ctx      - 2D context already transformed to world space
 * @param source   - The illumination source
 * @param rangePixels - Radius in world pixels (range * gridSize, with any anim modifier)
 */
function applyClipShape(
  ctx: CanvasRenderingContext2D,
  source: IlluminationSource,
  rangePixels: number
): void {
  const { x, y } = source.position;
  const clipShape = source.clipShape ?? 'circle';

  ctx.beginPath();

  if (clipShape === 'cone') {
    const halfAngle = (source.coneAngle ?? Math.PI / 2) / 2;
    const dir = source.coneDirection ?? 0;
    // Draw a pie-slice sector from the source origin
    ctx.moveTo(x, y);
    ctx.arc(x, y, rangePixels, dir - halfAngle, dir + halfAngle);
    ctx.closePath();
  } else {
    // Default: full circle
    ctx.arc(x, y, rangePixels, 0, Math.PI * 2);
  }

  ctx.clip();
}

/**
 * Render per-source illumination color gradients to the illumination canvas.
 *
 * Transform applied:
 *   translate(FIXED_PADDING - originX + pan.x, FIXED_PADDING - originY + pan.y)
 *   scale(zoom)
 *
 * This is identical to the fog canvas transform so the two canvases are pixel-aligned.
 */
function renderIlluminationOverlay(
  sources: IlluminationSource[],
  transform: { x: number; y: number; zoom: number },
  gridSize: number,
  animationTime: number,
  originX: number,
  originY: number
): void {
  if (!illuminationCtx || !illuminationCanvas) return;

  const ctx = illuminationCtx;
  ctx.clearRect(0, 0, illuminationCanvas.width, illuminationCanvas.height);
  ctx.globalCompositeOperation = 'screen';

  for (const source of sources) {
    if (!source.enabled || !source.colorEnabled) continue;

    const animResult = calculateAnimationModifiers(
      source.animation,
      source.animationSpeed,
      source.animationIntensity,
      animationTime,
      source.id
    );

    ctx.save();
    // Content-aware transform — matches fogCanvas exactly
    ctx.translate(FIXED_PADDING - originX + transform.x, FIXED_PADDING - originY + transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    const rangePixels = source.range * gridSize * animResult.radiusMod;
    const brightZone = source.brightZone ?? 0.5;
    const pos = source.position;

    // Clip 1: geometric shape (circle or cone)
    applyClipShape(ctx, source, rangePixels);

    // Clip 2: visibility polygon from wall occlusion (intersects with shape clip)
    if (source.visibilityPolygon) {
      ctx.clip(source.visibilityPolygon);
    }

    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, rangePixels);
    const rgb = parseColorToRGB(source.color);
    const intensity = (source.colorIntensity ?? 0.5) * animResult.intensityMod;
    const brightAlpha = intensity * 0.7;
    const dimAlpha = intensity * 0.3;

    gradient.addColorStop(0, `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${brightAlpha})`);
    gradient.addColorStop(brightZone, `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${brightAlpha})`);
    gradient.addColorStop(1, `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${dimAlpha})`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rangePixels, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Capture fog state and push it to the PixiJS GPU pipeline.
 *
 * canvasWidth/Height = content bbox size in CSS px (may be larger than viewport).
 * originX/Y          = CSS px offset of the content bbox top-left from the container origin.
 */
export function applyFogPostProcessing(
  sourceCtx: CanvasRenderingContext2D,
  fogMasks: {
    unexploredMask: Path2D;
    exploredOnlyMask: Path2D;
  } | null,
  fogOpacity: number,
  exploredOpacity: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: { x: number; y: number; zoom: number },
  illuminationData?: IlluminationData,
  originX = 0,
  originY = 0
): void {
  // Canvas2D fog canvases are managed exclusively by usePostProcessing
  // (via initFogCanvas / resizeFogCanvas).  Do NOT auto-resize here —
  // that would desync the Canvas2D texture from the PixiJS renderer,
  // which only resizes on >10% dimension changes.
  if (!fogCanvas) {
    initFogCanvas(canvasWidth, canvasHeight, undefined, originX, originY);
  }

  const totalW = fogCanvas!.width;
  const totalH = fogCanvas!.height;

  if (!isPostProcessingReady() || !fogMasks || !fogCanvas || !fogCtx) return;

  const now = performance.now();

  // ── CSS-offset fast path ──
  // If fog masks and illumination sources haven't changed (same object identity),
  // only the pan transform moved.  Skip the entire Canvas 2D redraw and just
  // reposition the PixiJS canvas via CSS.  Force a full redraw every
  // FULL_RENDER_INTERVAL ms to prevent long-term drift.
  const masksUnchanged = fogMasks === _lastFogMasks;
  const illuUnchanged = illuminationData?.sources === _lastIlluminationSources ||
    (!illuminationData && !_lastIlluminationSources);
  const timeSinceFullRender = now - _lastFullRenderTime;

  if (masksUnchanged && illuUnchanged && timeSinceFullRender < FULL_RENDER_INTERVAL) {
    // Try CSS-offset; falls back to full redraw if zoom changed
    if (panOffsetPostProcessing(transform)) {
      lastUpdateTime = now;
      return;
    }
  }

  // Throttle full redraws.  Zoom changes need a full redraw (CSS offset
  // can't handle scale changes), but at a lower framerate (~30fps) to
  // avoid GPU overload with expensive Canvas 2D + PixiJS texture uploads.
  const zoomChanged = _lastZoom !== 0 && _lastZoom !== transform.zoom;
  const throttleMs = zoomChanged ? ZOOM_THROTTLE_INTERVAL : MIN_UPDATE_INTERVAL;
  if (now - lastUpdateTime < throttleMs) {
    // Keep the PixiJS canvas aligned via CSS offset when possible
    panOffsetPostProcessing(transform);
    return;
  }

  lastUpdateTime = now;

  // Clear including overhang area
  fogCtx.clearRect(0, 0, totalW, totalH);

  // Content-aware transform:
  //   FIXED_PADDING   — standard canvas overhang offset
  //   - originX       — shifts so the content bbox top-left maps to canvas (FIXED_PADDING, FIXED_PADDING)
  //   + transform.x   — pan offset from world origin to screen origin
  fogCtx.save();
  fogCtx.translate(FIXED_PADDING - originX + transform.x, FIXED_PADDING - originY + transform.y);
  fogCtx.scale(transform.zoom, transform.zoom);

  // Render base fog layers
  fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
  fogCtx.fill(fogMasks.unexploredMask);
  fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  fogCtx.fill(fogMasks.exploredOnlyMask);

  // Illumination: fill visibility areas then cut bright/dim gradients through them
  const animationTime = now;

  if (illuminationData && illuminationData.sources.length > 0) {
    const gSize = illuminationData.gridSize;

    // STEP 1: Fill the geometric shape + visibility polygon area with explored-level fog.
    //         This ensures the dim zone never appears darker than explored fog.
    for (const source of illuminationData.sources) {
      if (!source.enabled) continue;

      const pos = source.position;
      const rangePixels = source.range * gSize;

      fogCtx.save();

      // Clip 1: geometric shape (always enforced — fixes rectangular rendering on custom lights)
      applyClipShape(fogCtx, source, rangePixels);

      // Clip 2: visibility polygon (wall occlusion), intersected with shape clip
      if (source.visibilityPolygon) {
        fogCtx.clip(source.visibilityPolygon);
      }

      fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
      fogCtx.beginPath();
      fogCtx.arc(pos.x, pos.y, rangePixels, 0, Math.PI * 2);
      fogCtx.fill();

      fogCtx.restore();
    }

    // STEP 2: destination-out gradients cut illuminated areas from fog.
    fogCtx.globalCompositeOperation = 'destination-out';

    for (const source of illuminationData.sources) {
      if (!source.enabled) continue;

      const animResult = calculateAnimationModifiers(
        source.animation,
        source.animationSpeed,
        source.animationIntensity,
        animationTime,
        source.id
      );

      const pos = source.position;
      const rangePixels = source.range * gSize * animResult.radiusMod;
      const brightZone = source.brightZone ?? 0.5;
      const brightIntensity = (source.brightIntensity ?? 1.0) * animResult.intensityMod;
      const globalDimOpacity = getEffectSettings().dimZoneOpacity ?? 0.4;
      const dimIntensity = (source.dimIntensity ?? globalDimOpacity) * animResult.intensityMod;

      fogCtx.save();

      // Clip 1: geometric shape
      applyClipShape(fogCtx, source, rangePixels);

      // Clip 2: visibility polygon (wall occlusion)
      if (source.visibilityPolygon) {
        fogCtx.clip(source.visibilityPolygon);
      }

      const clearGradient = fogCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, rangePixels);
      clearGradient.addColorStop(0, `rgba(255, 255, 255, ${brightIntensity})`);
      clearGradient.addColorStop(brightZone * 0.9, `rgba(255, 255, 255, ${brightIntensity})`);
      clearGradient.addColorStop(brightZone, `rgba(255, 255, 255, ${(brightIntensity + dimIntensity) / 2})`);
      clearGradient.addColorStop(Math.min(1, brightZone + 0.1), `rgba(255, 255, 255, ${dimIntensity})`);
      clearGradient.addColorStop(1, `rgba(255, 255, 255, ${dimIntensity})`);

      fogCtx.fillStyle = clearGradient;
      fogCtx.beginPath();
      fogCtx.arc(pos.x, pos.y, rangePixels, 0, Math.PI * 2);
      fogCtx.fill();

      fogCtx.restore();
    }

    fogCtx.globalCompositeOperation = 'source-over';
  }

  fogCtx.restore();

  // Render color overlays to the illumination canvas then push to PixiJS
  if (illuminationData && illuminationData.sources.length > 0) {
    renderIlluminationOverlay(
      illuminationData.sources,
      transform,
      illuminationData.gridSize,
      animationTime,
      originX,
      originY
    );
  } else if (illuminationCtx && illuminationCanvas) {
    // No illumination sources — clear stale color overlay to prevent
    // ghost glow from a previous frame persisting on the PixiJS layer.
    illuminationCtx.clearRect(0, 0, illuminationCanvas.width, illuminationCanvas.height);
  }
  // Always upload illumination texture (even when cleared) so stale content
  // doesn't linger on the GPU sprite.
  if (illuminationCanvas) {
    updateIlluminationTexture(illuminationCanvas);
  }

  // Push fog mask to PixiJS
  updateFogTexture(fogCanvas);
  resetPostProcessingOffset();
  renderPostProcessing();

  // Track state for CSS-offset fast path
  _lastFogMasks = fogMasks;
  _lastIlluminationSources = illuminationData?.sources ?? null;
  _lastFullRenderTime = performance.now();
  _lastZoom = transform.zoom;
  setLastRenderTransform(transform);
}

export function updateFogEffects(config: Partial<FogEffectConfig>): void {
  const effectSettings: Partial<EffectSettings> = {};
  if (config.edgeBlur !== undefined) effectSettings.edgeBlur = config.edgeBlur;
  if (config.lightFalloff !== undefined) effectSettings.lightFalloff = config.lightFalloff;
  if (config.volumetricEnabled !== undefined) effectSettings.volumetricEnabled = config.volumetricEnabled;
  if (config.effectQuality !== undefined) effectSettings.effectQuality = config.effectQuality;
  updateEffectSettings(effectSettings);
}

export function getFogEffectConfig(): FogEffectConfig {
  const settings = getEffectSettings();
  return {
    enabled: true,
    edgeBlur: settings.edgeBlur,
    lightFalloff: settings.lightFalloff,
    volumetricEnabled: settings.volumetricEnabled,
    effectQuality: settings.effectQuality,
  };
}

export const FOG_EFFECT_PRESETS = {
  performance: { edgeBlur: 4, bloomIntensity: 0, volumetricEnabled: false, effectQuality: 'performance' as const },
  balanced:    { edgeBlur: 8, bloomIntensity: 0.5, volumetricEnabled: false, effectQuality: 'balanced' as const },
  cinematic:   { edgeBlur: 12, bloomIntensity: 0.8, volumetricEnabled: true, effectQuality: 'cinematic' as const },
};

export function applyFogEffectPreset(preset: keyof typeof FOG_EFFECT_PRESETS): void {
  updateFogEffects(FOG_EFFECT_PRESETS[preset]);
}

export function cleanupFogPostProcessing(): void {
  fogCanvas = null; fogCtx = null;
  illuminationCanvas = null; illuminationCtx = null;
  dimZoneCanvas = null; dimZoneCtx = null;
  _lastFogMasks = null;
  _lastIlluminationSources = null;
  _lastFullRenderTime = 0;
}
