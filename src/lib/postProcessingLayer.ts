/**
 * Post-Processing Layer using PixiJS
 *
 * COORDINATE SPACE DESIGN
 * =======================
 * The PixiJS canvas is **viewport-sized** — it matches the main rendering canvas
 * exactly.  It sits at position: absolute; top: 0; left: 0 and never moves.
 *
 * The fog Canvas2D (in fogPostProcessing.ts) uses the same
 *   ctx.translate(transform.x, transform.y)
 *   ctx.scale(transform.zoom, transform.zoom)
 * as the main canvas, so fog masks are pixel-aligned by definition.
 *
 * A small EDGE_PADDING (50px) is added to all sides so blur filters don't
 * clip at the viewport edge.  The PixiJS canvas is positioned at
 * (-EDGE_PADDING, -EDGE_PADDING) and sized (viewport + 2 × EDGE_PADDING).
 *
 * Resizing only happens when the browser viewport changes — never on zoom or pan.
 * This eliminates the WebGL buffer clear flash that occurred with the old
 * content-sized approach.
 */

import * as PIXI from 'pixi.js';
import { Z_INDEX } from './zIndex';
import { IlluminationFilter } from './shaders/illuminationFilter';

// ---------------------------------------------------------------------------
// Edge padding — small bleed area so blur doesn't clip at viewport edges.
// ---------------------------------------------------------------------------
export const EDGE_PADDING = 50;

export interface PostProcessingConfig {
  /** Viewport width in CSS px. */
  width: number;
  /** Viewport height in CSS px. */
  height: number;
  resolution?: number;
  antialias?: boolean;
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

// Stored viewport dimensions (without padding)
let _viewportW = 0;
let _viewportH = 0;

function getQualityMultiplier(quality: EffectSettings['effectQuality']): number {
  switch (quality) {
    case 'performance': return 0.5;
    case 'balanced': return 0.75;
    case 'cinematic': return 1.0;
    default: return 0.75;
  }
}

// WebGL context loss / restore handlers
function _onContextLost(e: Event): void {
  e.preventDefault();
  console.warn('⚠️ PixiJS WebGL context lost — fog layer suspended');
  isInitialized = false;
}

function _onContextRestored(): void {
  console.log('✅ PixiJS WebGL context restored — forcing texture re-upload');
  isInitialized = true;
  if (fogTexture) { fogTexture.destroy(false); fogTexture = null; }
  if (illuminationTexture) { illuminationTexture.destroy(false); illuminationTexture = null; }
}

/** Total canvas dimension = viewport + 2 × edge padding. */
function totalSize(viewportPx: number): number {
  return viewportPx + EDGE_PADDING * 2;
}

/** Apply CSS positioning to the PixiJS canvas. */
function applyCanvasCSS(canvas: HTMLCanvasElement, viewportW: number, viewportH: number): void {
  canvas.style.position = 'absolute';
  canvas.style.top = `${-EDGE_PADDING}px`;
  canvas.style.left = `${-EDGE_PADDING}px`;
  canvas.style.width = `${totalSize(viewportW)}px`;
  canvas.style.height = `${totalSize(viewportH)}px`;
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = String(Z_INDEX.CANVAS_ELEMENTS.FOG_POST_PROCESSING);
}

/**
 * Initialize the PixiJS post-processing layer.
 *
 * width/height = viewport dimensions in CSS px.
 */
export async function initPostProcessing(
  container: HTMLElement,
  config: PostProcessingConfig
): Promise<boolean> {
  try {
    if (pixiApp) {
      await cleanupPostProcessing();
    }

    _viewportW = config.width;
    _viewportH = config.height;

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
      preference: 'webgl',
      autoStart: false,
    });

    pixiApp.ticker.stop();

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

    const canvas2 = pixiApp.canvas as HTMLCanvasElement;
    canvas2.addEventListener('webglcontextlost', _onContextLost);
    canvas2.addEventListener('webglcontextrestored', _onContextRestored);

    console.log(
      `✅ PixiJS post-processing initialized — viewport ${config.width}×${config.height}, ` +
      `canvas ${canvasW}×${canvasH}, edge padding ${EDGE_PADDING}px`
    );
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize post-processing:', error);
    if (pixiApp) {
      try { pixiApp.ticker.stop(); } catch (_) { /* noop */ }
      try { pixiApp.destroy(true); } catch (_) { /* noop */ }
      pixiApp = null;
    }
    isInitialized = false;
    return false;
  }
}

/**
 * Update the fog texture from a Canvas 2D source.
 * The source canvas MUST be totalSize(viewportW) × totalSize(viewportH).
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
 * Update the illumination overlay texture from a Canvas 2D source.
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

  // Quality change requires renderer resize
  if (settings.effectQuality && settings.effectQuality !== prevQuality && isInitialized && _viewportW > 0) {
    resizePostProcessing(_viewportW, _viewportH);
  }
}

/** No-op — retained for call-site compatibility. */
export function updateIlluminationData(_data: unknown): void {}

export function getEffectSettings(): EffectSettings {
  return { ...currentSettings };
}

/**
 * Resize the post-processing layer when the viewport changes.
 * Only called on window resize — never on zoom or pan.
 */
export function resizePostProcessing(width: number, height: number): void {
  if (!pixiApp || !isInitialized) return;

  _viewportW = width;
  _viewportH = height;

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
  isInitialized = false;

  try {
    if (fogTexture) { fogTexture.destroy(true); fogTexture = null; }
    if (illuminationTexture) { illuminationTexture.destroy(true); illuminationTexture = null; }
    if (blurFilter) { blurFilter.destroy(); blurFilter = null; }
    if (illuminationFilter) { illuminationFilter.destroy(); illuminationFilter = null; }
    if (fogSprite) { fogSprite.destroy(); fogSprite = null; }
    if (illuminationSprite) { illuminationSprite.destroy(); illuminationSprite = null; }

    if (pixiApp) {
      try {
        pixiApp.ticker.stop();
        const canvas = pixiApp.canvas as HTMLCanvasElement | undefined;
        if (canvas) {
          canvas.removeEventListener('webglcontextlost', _onContextLost);
          canvas.removeEventListener('webglcontextrestored', _onContextRestored);
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        }
        pixiApp.destroy(true, { children: true, texture: true });
      } catch (destroyErr) {
        console.warn('PixiJS destroy error (safe to ignore):', destroyErr);
      }
      pixiApp = null;
    }

    containerRef = null;
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
    console.warn('PixiJS render failed (GPU context lost?), cleaning up:', err);
    isInitialized = false;
    cleanupPostProcessing();
  }
}
