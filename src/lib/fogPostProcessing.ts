/**
 * Fog Post-Processing Effects
 *
 * COORDINATE SPACE
 * ================
 * All canvases here (fogCanvas, illuminationCanvas, dimZoneCanvas) are
 * viewport-sized plus EDGE_PADDING on each side — identical to the PixiJS canvas.
 *
 * Content is rendered with the same transform as the main canvas:
 *   ctx.translate(EDGE_PADDING + transform.x, EDGE_PADDING + transform.y)
 *   ctx.scale(transform.zoom, transform.zoom)
 *
 * This ensures pixel-perfect alignment with the main rendering canvas.
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
 */

import {
  updateFogTexture,
  updateIlluminationTexture,
  updateEffectSettings,
  getEffectSettings,
  isPostProcessingReady,
  renderPostProcessing,
  EDGE_PADDING,
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

// Throttle tracking
let _lastFogMasks: object | null = null;
let _lastIlluminationSources: object | null = null;
let _lastZoom = 0;
const ZOOM_THROTTLE_INTERVAL = 50; // ~20fps cap during zoom

/**
 * Returns the edge padding used by the coordinate system.
 */
export function getEdgePadding(): number {
  return EDGE_PADDING;
}

/**
 * Initialize (or re-initialize) the off-screen canvases.
 * width/height = viewport size in CSS px.
 */
export function initFogCanvas(width: number, height: number): void {
  const totalW = width + EDGE_PADDING * 2;
  const totalH = height + EDGE_PADDING * 2;

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
 * Resize the canvases when the viewport changes.
 */
export function resizeFogCanvas(width: number, height: number): void {
  const totalW = width + EDGE_PADDING * 2;
  const totalH = height + EDGE_PADDING * 2;

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
 * Apply the geometric clip shape for an illumination source.
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
    ctx.moveTo(x, y);
    ctx.arc(x, y, rangePixels, dir - halfAngle, dir + halfAngle);
    ctx.closePath();
  } else {
    ctx.arc(x, y, rangePixels, 0, Math.PI * 2);
  }

  ctx.clip();
}

/**
 * Render per-source illumination color gradients.
 * Uses the same viewport transform as the fog canvas.
 */
function renderIlluminationOverlay(
  sources: IlluminationSource[],
  transform: { x: number; y: number; zoom: number },
  gridSize: number,
  animationTime: number
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
    // Same viewport transform as main canvas
    ctx.translate(EDGE_PADDING + transform.x, EDGE_PADDING + transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    const rangePixels = source.range * gridSize * animResult.radiusMod;
    const brightZone = source.brightZone ?? 0.5;
    const pos = source.position;

    applyClipShape(ctx, source, rangePixels);

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
 * canvasWidth/Height = viewport dimensions in CSS px.
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
  illuminationData?: IlluminationData
): void {
  if (!fogCanvas) {
    initFogCanvas(canvasWidth, canvasHeight);
  }

  const totalW = fogCanvas!.width;
  const totalH = fogCanvas!.height;

  if (!isPostProcessingReady() || !fogMasks || !fogCanvas || !fogCtx) return;

  const now = performance.now();

  // Throttle redraws — zoom changes at lower framerate
  const zoomChanged = _lastZoom !== 0 && _lastZoom !== transform.zoom;
  const throttleMs = zoomChanged ? ZOOM_THROTTLE_INTERVAL : MIN_UPDATE_INTERVAL;
  if (now - lastUpdateTime < throttleMs) {
    return;
  }

  lastUpdateTime = now;

  // Clear
  fogCtx.clearRect(0, 0, totalW, totalH);

  // Viewport transform — same as main canvas, offset by EDGE_PADDING
  fogCtx.save();
  fogCtx.translate(EDGE_PADDING + transform.x, EDGE_PADDING + transform.y);
  fogCtx.scale(transform.zoom, transform.zoom);

  // Render base fog layers
  fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
  fogCtx.fill(fogMasks.unexploredMask);
  fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  fogCtx.fill(fogMasks.exploredOnlyMask);

  // Illumination: fill visibility areas then cut bright/dim gradients
  const animationTime = now;

  if (illuminationData && illuminationData.sources.length > 0) {
    const gSize = illuminationData.gridSize;

    // STEP 1: Fill geometric shape + visibility polygon area with explored-level fog
    for (const source of illuminationData.sources) {
      if (!source.enabled) continue;

      const pos = source.position;
      const rangePixels = source.range * gSize;

      fogCtx.save();

      applyClipShape(fogCtx, source, rangePixels);

      if (source.visibilityPolygon) {
        fogCtx.clip(source.visibilityPolygon);
      }

      fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
      fogCtx.beginPath();
      fogCtx.arc(pos.x, pos.y, rangePixels, 0, Math.PI * 2);
      fogCtx.fill();

      fogCtx.restore();
    }

    // STEP 2: destination-out gradients cut illuminated areas from fog
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

      applyClipShape(fogCtx, source, rangePixels);

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

  // Render color overlays to illumination canvas then push to PixiJS
  if (illuminationData && illuminationData.sources.length > 0) {
    renderIlluminationOverlay(
      illuminationData.sources,
      transform,
      illuminationData.gridSize,
      animationTime
    );
  } else if (illuminationCtx && illuminationCanvas) {
    illuminationCtx.clearRect(0, 0, illuminationCanvas.width, illuminationCanvas.height);
  }
  if (illuminationCanvas) {
    updateIlluminationTexture(illuminationCanvas);
  }

  // Push fog mask to PixiJS
  updateFogTexture(fogCanvas);
  renderPostProcessing();

  // Track state for throttle
  _lastFogMasks = fogMasks;
  _lastIlluminationSources = illuminationData?.sources ?? null;
  _lastZoom = transform.zoom;
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
}
