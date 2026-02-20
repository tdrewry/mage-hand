/**
 * Fog Post-Processing Effects
 *
 * COORDINATE SPACE
 * ================
 * All canvases here (fogCanvas, illuminationCanvas, dimZoneCanvas) are sized
 * viewport + FIXED_PADDING*2 on each axis — identical to the PixiJS canvas.
 * Content is rendered with:
 *
 *   ctx.translate(FIXED_PADDING + transform.x, FIXED_PADDING + transform.y)
 *   ctx.scale(transform.zoom, transform.zoom)
 *
 * This means world-space coordinates map directly to fog-canvas pixels with
 * no per-frame padding recalculation.  Light circles near the viewport edge
 * spill freely into the FIXED_PADDING overhang region, which the PixiJS canvas
 * (sized and CSS-offset identically) renders without clipping.
 */

import {
  updateFogTexture,
  updateIlluminationTexture,
  updateEffectSettings,
  getEffectSettings,
  isPostProcessingReady,
  renderPostProcessing,
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

// Viewport dimensions tracked so we can guard resize calls
let _lastViewportW = 0;
let _lastViewportH = 0;

/**
 * Returns the padding used by the coordinate system.
 * Always FIXED_PADDING — exposed for callers that previously read a dynamic value.
 */
export function getEdgePadding(): number {
  return FIXED_PADDING;
}

/**
 * Initialize (or re-initialize) the off-screen canvases.
 * They are always sized to (viewportW + FIXED_PADDING*2) × (viewportH + FIXED_PADDING*2).
 *
 * The `_padding` parameter is accepted for backward-compatibility but ignored —
 * FIXED_PADDING is the authoritative value.
 */
export function initFogCanvas(width: number, height: number, _padding?: number): void {
  _lastViewportW = width;
  _lastViewportH = height;

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
 * Resize the canvases when the viewport changes.
 * Same semantics as initFogCanvas — FIXED_PADDING is implicit.
 */
export function resizeFogCanvas(width: number, height: number, _padding?: number): void {
  _lastViewportW = width;
  _lastViewportH = height;

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
 * Render per-source illumination color gradients to the illumination canvas.
 *
 * Transform applied: translate(FIXED_PADDING + pan.x, FIXED_PADDING + pan.y) then scale(zoom).
 * This is identical to the fog canvas transform so the two canvases are pixel-aligned.
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
    if (!source.enabled || !source.colorEnabled || !source.visibilityPolygon) continue;

    const animResult = calculateAnimationModifiers(
      source.animation,
      source.animationSpeed,
      source.animationIntensity,
      animationTime,
      source.id
    );

    ctx.save();
    // Unified transform — matches fogCanvas exactly
    ctx.translate(FIXED_PADDING + transform.x, FIXED_PADDING + transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    ctx.beginPath();
    ctx.clip(source.visibilityPolygon);

    const rangePixels = source.range * gridSize * animResult.radiusMod;
    const brightZone = source.brightZone ?? 0.5;
    const pos = source.position;

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
 * The fog canvas is always sized viewport + FIXED_PADDING*2.  Content rendered
 * to it with the FIXED_PADDING + pan + zoom transform spills naturally into the
 * overhang region, and the PixiJS canvas (same size, same CSS offset) renders
 * it without any clipping.
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
  const totalW = canvasWidth + FIXED_PADDING * 2;
  const totalH = canvasHeight + FIXED_PADDING * 2;

  // (Re)initialize if viewport size changed
  if (!fogCanvas || fogCanvas.width !== totalW || fogCanvas.height !== totalH) {
    initFogCanvas(canvasWidth, canvasHeight);
  }

  if (!isPostProcessingReady() || !fogMasks || !fogCanvas || !fogCtx) return;

  // Throttle updates
  const now = performance.now();
  if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) return;
  lastUpdateTime = now;

  // Clear including overhang area
  fogCtx.clearRect(0, 0, totalW, totalH);

  // Apply unified transform: FIXED_PADDING offset acts as a stable coordinate origin.
  fogCtx.save();
  fogCtx.translate(FIXED_PADDING + transform.x, FIXED_PADDING + transform.y);
  fogCtx.scale(transform.zoom, transform.zoom);

  // Render base fog layers
  fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
  fogCtx.fill(fogMasks.unexploredMask);
  fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  fogCtx.fill(fogMasks.exploredOnlyMask);

  // Illumination: fill visibility areas then cut bright/dim gradients through them
  const animationTime = now;

  if (illuminationData && illuminationData.sources.length > 0) {
    // STEP 1: fill each visibility polygon with explored-level fog
    for (const source of illuminationData.sources) {
      if (!source.enabled || !source.visibilityPolygon) continue;

      const pos = source.position;
      const rangePixels = source.range * illuminationData.gridSize;

      fogCtx.save();
      fogCtx.clip(source.visibilityPolygon);
      fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
      fogCtx.beginPath();
      fogCtx.arc(pos.x, pos.y, rangePixels, 0, Math.PI * 2);
      fogCtx.fill();
      fogCtx.restore();
    }

    // STEP 2: destination-out gradients cut illuminated areas from fog
    fogCtx.globalCompositeOperation = 'destination-out';

    for (const source of illuminationData.sources) {
      if (!source.enabled || !source.visibilityPolygon) continue;

      const animResult = calculateAnimationModifiers(
        source.animation,
        source.animationSpeed,
        source.animationIntensity,
        animationTime,
        source.id
      );

      const pos = source.position;
      const rangePixels = source.range * illuminationData.gridSize * animResult.radiusMod;
      const brightZone = source.brightZone ?? 0.5;
      const brightIntensity = (source.brightIntensity ?? 1.0) * animResult.intensityMod;
      const globalDimOpacity = getEffectSettings().dimZoneOpacity ?? 0.4;
      const dimIntensity = (source.dimIntensity ?? globalDimOpacity) * animResult.intensityMod;

      fogCtx.save();
      fogCtx.clip(source.visibilityPolygon);

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
      animationTime
    );
    if (illuminationCanvas) {
      updateIlluminationTexture(illuminationCanvas);
    }
  }

  // Push fog mask to PixiJS
  updateFogTexture(fogCanvas);
  renderPostProcessing();
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
}
