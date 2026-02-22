/**
 * Post-Processing Layer using PixiJS
 *
 * COORDINATE SPACE DESIGN
 * =======================
 * The PixiJS canvas covers the content bounding box (all regions + tokens in
 * screen space) plus FIXED_PADDING on every side.  Its CSS top/left are set so
 * that it starts at (contentLeft - FIXED_PADDING, contentTop - FIXED_PADDING)
 * relative to the container.
 *
 * When content fits entirely within the viewport the canvas is simply
 * (viewport + FIXED_PADDING*2) — the same as before.  When content extends
 * beyond the viewport on any side the canvas grows to cover that content, so
 * fog is always drawn over every region regardless of pan position.
 *
 * The fog canvas (Canvas 2D) is initialised at the SAME pixel dimensions and
 * uses translate(FIXED_PADDING - originX + pan.x, FIXED_PADDING - originY + pan.y)
 * / scale(zoom) so that world-space coordinates land in the correct fog-canvas pixel.
 *
 * FIXED_PADDING is chosen to be large enough that light circles whose centres are
 * at the content edge still render fully.
 */

import * as PIXI from 'pixi.js';
import { Z_INDEX } from './zIndex';
import { IlluminationFilter } from './shaders/illuminationFilter';

// ---------------------------------------------------------------------------
// Fixed padding — padding around the content bounding box on every side.
// ---------------------------------------------------------------------------
export const FIXED_PADDING = 600;

export interface PostProcessingConfig {
  width: number;
  height: number;
  resolution?: number;
  antialias?: boolean;
  /** Origin offset: how many CSS px the content bbox top-left is above/left of the container origin. */
  originX?: number;
  originY?: number;
}

export interface EffectSettings {
  edgeBlur: number;
  lightFalloff: number;
  bloomThreshold: number;
  volumetricEnabled: boolean;
  effectQuality: 'performance' | 'balanced' | 'cinematic';
  dimZoneOpacity: number;
}

const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  edgeBlur: 8,
  lightFalloff: 0.5,
  bloomThreshold: 0.7,
  volumetricEnabled: false,
  effectQuality: 'balanced',
  dimZoneOpacity: 0.4,
};

let pixiApp: PIXI.Application | null = null;
let fogSprite: PIXI.Sprite | null = null;
let fogTexture: PIXI.Texture | null = null;
let illuminationSprite: PIXI.Sprite | null = null;
let illuminationTexture: PIXI.Texture | null = null;
let blurFilter: PIXI.BlurFilter | null = null;
let illuminationFilter: IlluminationFilter | null = null;
let containerRef: HTMLElement | null = null;
let isInitialized = false;
let currentSettings: EffectSettings = { ...DEFAULT_EFFECT_SETTINGS };

// Stored dimensions — content bbox dimensions (without padding)
let _contentW = 0;
let _contentH = 0;
// CSS origin of the fog canvas relative to the container
let _originX = 0;
let _originY = 0;
// Last transform used for a full fog render — used for CSS-offset fast path during pan
let _lastRenderTransform = { x: 0, y: 0, zoom: 0 };

function getQualityMultiplier(quality: EffectSettings['effectQuality']): number {
  switch (quality) {
    case 'performance': return 0.5;
    case 'balanced': return 0.75;
    case 'cinematic': return 1.0;
    default: return 0.75;
  }
}

/** Total canvas dimension = content size + 2 × padding. */
function totalSize(contentPx: number): number {
  return contentPx + FIXED_PADDING * 2;
}

/** Apply CSS positioning to the PixiJS canvas based on current origin. */
function applyCanvasCSS(canvas: HTMLCanvasElement, contentW: number, contentH: number): void {
  canvas.style.position = 'absolute';
  // The fog canvas starts at (originX - FIXED_PADDING, originY - FIXED_PADDING)
  // relative to the container.  originX/Y are the CSS px distances from the
  // container top-left to the content bounding-box top-left (can be negative
  // when content is above / left of the viewport).
  canvas.style.top  = `${_originY - FIXED_PADDING}px`;
  canvas.style.left = `${_originX - FIXED_PADDING}px`;
  canvas.style.width  = `${totalSize(contentW)}px`;
  canvas.style.height = `${totalSize(contentH)}px`;
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = String(Z_INDEX.CANVAS_ELEMENTS.FOG_POST_PROCESSING);
}

/**
 * Initialize the PixiJS post-processing layer.
 *
 * width/height = content bbox dimensions in CSS px.
 * originX/Y    = CSS px position of the content bbox top-left inside the container.
 *                Typically 0 when content fits in the viewport (same as before).
 */
export async function initPostProcessing(
  container: HTMLElement,
  config: PostProcessingConfig
): Promise<boolean> {
  try {
    if (pixiApp) {
      await cleanupPostProcessing();
    }

    _contentW = config.width;
    _contentH = config.height;
    _originX  = config.originX ?? 0;
    _originY  = config.originY ?? 0;

    const qm = getQualityMultiplier(currentSettings.effectQuality);
    const canvasW = Math.floor(totalSize(config.width) * qm);
    const canvasH = Math.floor(totalSize(config.height) * qm);

    pixiApp = new PIXI.Application();
    await pixiApp.init({
      width: canvasW,
      height: canvasH,
      backgroundAlpha: 0,
      antialias: config.antialias ?? true,
      resolution: config.resolution ?? 1,
      autoDensity: true,
      // Force WebGL to prevent "CanvasRenderer is not yet implemented" fallback
      // when GPU context is lost after long idle periods
      preference: 'webgl',
    });

    const canvas = pixiApp.canvas as HTMLCanvasElement;
    applyCanvasCSS(canvas, config.width, config.height);

    container.appendChild(canvas);
    containerRef = container;

    blurFilter = new PIXI.BlurFilter({
      strength: currentSettings.edgeBlur,
      quality: currentSettings.effectQuality === 'performance' ? 2 : 4,
    });

    illuminationFilter = new IlluminationFilter({
      globalEdgeBlur: currentSettings.edgeBlur,
    });

    const fogContainer = new PIXI.Container();
    fogContainer.filters = [blurFilter, illuminationFilter];
    pixiApp.stage.addChild(fogContainer);

    fogSprite = new PIXI.Sprite();
    fogSprite.width = canvasW;
    fogSprite.height = canvasH;
    fogSprite.x = 0;
    fogSprite.y = 0;
    fogContainer.addChild(fogSprite);

    illuminationSprite = new PIXI.Sprite();
    illuminationSprite.width = canvasW;
    illuminationSprite.height = canvasH;
    illuminationSprite.x = 0;
    illuminationSprite.y = 0;
    illuminationSprite.blendMode = 'add';
    fogContainer.addChild(illuminationSprite);

    isInitialized = true;
    console.log(
      `✅ PixiJS post-processing initialized — content ${config.width}×${config.height}, ` +
      `origin (${_originX}, ${_originY}), canvas ${canvasW}×${canvasH}, padding ${FIXED_PADDING}px`
    );
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize post-processing:', error);
    return false;
  }
}

/**
 * Update the fog texture from a padded Canvas 2D source.
 * The source canvas MUST be totalSize(contentW) × totalSize(contentH).
 */
export function updateFogTexture(sourceCanvas: HTMLCanvasElement): void {
  if (!pixiApp || !fogSprite || !isInitialized) return;

  try {
    const qm = getQualityMultiplier(currentSettings.effectQuality);
    const needsRecreate =
      !fogTexture ||
      !fogTexture.source ||
      fogTexture.source.width !== sourceCanvas.width ||
      fogTexture.source.height !== sourceCanvas.height;

    if (needsRecreate) {
      if (fogTexture) fogTexture.destroy(false);
      fogTexture = PIXI.Texture.from(sourceCanvas);
      fogSprite.texture = fogTexture;
    } else {
      fogTexture.source.update();
    }

    fogSprite.width = sourceCanvas.width * qm;
    fogSprite.height = sourceCanvas.height * qm;
    fogSprite.x = 0;
    fogSprite.y = 0;
  } catch (error) {
    console.error('Failed to update fog texture:', error);
  }
}

/**
 * Update the illumination overlay texture from a padded Canvas 2D source.
 */
export function updateIlluminationTexture(sourceCanvas: HTMLCanvasElement): void {
  if (!pixiApp || !illuminationSprite || !isInitialized) return;

  try {
    const qm = getQualityMultiplier(currentSettings.effectQuality);
    const needsRecreate =
      !illuminationTexture ||
      !illuminationTexture.source ||
      illuminationTexture.source.width !== sourceCanvas.width ||
      illuminationTexture.source.height !== sourceCanvas.height;

    if (needsRecreate) {
      if (illuminationTexture) illuminationTexture.destroy(false);
      illuminationTexture = PIXI.Texture.from(sourceCanvas);
      illuminationSprite.texture = illuminationTexture;
    } else {
      illuminationTexture.source.update();
    }

    illuminationSprite.width = sourceCanvas.width * qm;
    illuminationSprite.height = sourceCanvas.height * qm;
    illuminationSprite.x = 0;
    illuminationSprite.y = 0;
  } catch (error) {
    console.error('Failed to update illumination texture:', error);
  }
}

export function updateEffectSettings(settings: Partial<EffectSettings>): void {
  const prevQuality = currentSettings.effectQuality;
  currentSettings = { ...currentSettings, ...settings };

  if (blurFilter) {
    blurFilter.strength = currentSettings.edgeBlur;
    blurFilter.quality = currentSettings.effectQuality === 'performance' ? 2 : 4;
  }

  if (illuminationFilter) {
    illuminationFilter.globalEdgeBlur = currentSettings.edgeBlur;
  }

  // Quality change requires renderer resize — sprite/renderer size mismatch
  // otherwise causes a white screen (fog texture no longer covers the canvas)
  if (settings.effectQuality && settings.effectQuality !== prevQuality && isInitialized && _contentW > 0) {
    resizePostProcessing(_contentW, _contentH, _originX, _originY);
  }
}

/** No-op — retained for call-site compatibility. Shader is a pass-through. */
export function updateIlluminationData(_data: unknown): void {
  // Intentional no-op. All illumination geometry is on Canvas 2D now.
}

export function getEffectSettings(): EffectSettings {
  return { ...currentSettings };
}

/** Return current origin so fog canvas can use matching translate. */
export function getPostProcessingOrigin(): { x: number; y: number } {
  return { x: _originX, y: _originY };
}

/**
 * Resize the post-processing layer when content bounds or viewport changes.
 * width/height = new content bbox dimensions.
 * originX/Y    = new CSS origin of the content bbox inside the container.
 */
export function resizePostProcessing(
  width: number,
  height: number,
  originX?: number,
  originY?: number
): void {
  if (!pixiApp || !isInitialized) return;

  _contentW = width;
  _contentH = height;
  if (originX !== undefined) _originX = originX;
  if (originY !== undefined) _originY = originY;

  const qm = getQualityMultiplier(currentSettings.effectQuality);
  const canvasW = Math.floor(totalSize(width) * qm);
  const canvasH = Math.floor(totalSize(height) * qm);

  pixiApp.renderer.resize(canvasW, canvasH);

  const canvas = pixiApp.canvas as HTMLCanvasElement;
  applyCanvasCSS(canvas, width, height);

  if (fogSprite) {
    fogSprite.width = canvasW;
    fogSprite.height = canvasH;
    fogSprite.x = 0;
    fogSprite.y = 0;
  }

  if (illuminationSprite) {
    illuminationSprite.width = canvasW;
    illuminationSprite.height = canvasH;
    illuminationSprite.x = 0;
    illuminationSprite.y = 0;
  }
}

export function setPostProcessingVisible(visible: boolean): void {
  if (!pixiApp || !isInitialized) return;
  const canvas = pixiApp.canvas as HTMLCanvasElement;
  canvas.style.display = visible ? 'block' : 'none';
}

export function isPostProcessingReady(): boolean {
  return isInitialized && pixiApp !== null;
}

export function getPostProcessingCanvas(): HTMLCanvasElement | null {
  return (pixiApp?.canvas as HTMLCanvasElement) ?? null;
}

export async function cleanupPostProcessing(): Promise<void> {
  try {
    if (fogTexture) { fogTexture.destroy(true); fogTexture = null; }
    if (illuminationTexture) { illuminationTexture.destroy(true); illuminationTexture = null; }
    if (blurFilter) { blurFilter.destroy(); blurFilter = null; }
    if (illuminationFilter) { illuminationFilter.destroy(); illuminationFilter = null; }
    if (fogSprite) { fogSprite.destroy(); fogSprite = null; }
    if (illuminationSprite) { illuminationSprite.destroy(); illuminationSprite = null; }

    if (pixiApp) {
      try {
        const canvas = pixiApp.canvas as HTMLCanvasElement | undefined;
        if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
        pixiApp.destroy(true, { children: true, texture: true });
      } catch (destroyErr) {
        console.warn('PixiJS destroy error (safe to ignore):', destroyErr);
      }
      pixiApp = null;
    }

    containerRef = null;
    isInitialized = false;
    console.log('🧹 PixiJS post-processing cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

export function renderPostProcessing(): void {
  if (!pixiApp || !isInitialized) return;
  try {
    pixiApp.render();
  } catch (err) {
    // GPU context lost — internal PixiJS state is corrupted
    console.warn('PixiJS render failed (GPU context lost?), cleaning up:', err);
    isInitialized = false;
    cleanupPostProcessing();
  }
}

/**
 * Record the transform used for the last full fog render.
 * Called by fogPostProcessing after a full Canvas 2D redraw.
 */
export function setLastRenderTransform(transform: { x: number; y: number; zoom: number }): void {
  _lastRenderTransform = { ...transform };
}

/**
 * CSS-offset fast path: during pan (no zoom change), skip the expensive
 * Canvas 2D fog redraw and just reposition the PixiJS canvas to match.
 *
 * Returns true if the fast path was used (caller should skip full redraw).
 */
export function panOffsetPostProcessing(transform: { x: number; y: number; zoom: number }): boolean {
  if (!pixiApp || !isInitialized) return false;
  // Zoom changed — need full redraw for correct scaling
  if (_lastRenderTransform.zoom !== transform.zoom || _lastRenderTransform.zoom === 0) return false;

  const dx = transform.x - _lastRenderTransform.x;
  const dy = transform.y - _lastRenderTransform.y;
  if (dx === 0 && dy === 0) return false; // nothing to offset

  const canvas = pixiApp.canvas as HTMLCanvasElement;
  canvas.style.left = `${_originX - FIXED_PADDING + dx}px`;
  canvas.style.top  = `${_originY - FIXED_PADDING + dy}px`;
  return true;
}

/**
 * Reset the PixiJS canvas CSS position back to its canonical location.
 * Called after a full fog redraw so there's no stale offset.
 */
export function resetPostProcessingOffset(): void {
  if (!pixiApp || !isInitialized) return;
  const canvas = pixiApp.canvas as HTMLCanvasElement;
  applyCanvasCSS(canvas, _contentW, _contentH);
}
