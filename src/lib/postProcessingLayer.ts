/**
 * Post-Processing Layer using PixiJS
 *
 * COORDINATE SPACE DESIGN
 * =======================
 * The PixiJS canvas is larger than the visible viewport by FIXED_PADDING on every
 * side, and is offset by -FIXED_PADDING via CSS so it still covers the viewport.
 *
 *   PixiJS canvas size : (viewportW + FIXED_PADDING*2) × (viewportH + FIXED_PADDING*2)
 *   CSS offset          : top: -FIXED_PADDING px; left: -FIXED_PADDING px
 *
 * The fog canvas (Canvas 2D) is initialised at the SAME dimensions and uses the
 * SAME translate(FIXED_PADDING + pan.x, FIXED_PADDING + pan.y) / scale(zoom)
 * transform.  Both canvases therefore share one coordinate space — (0,0) in
 * PixiJS always equals (0,0) on the fog canvas.  There are NO negative sprite
 * offsets and NO per-frame padding recalculations.
 *
 * FIXED_PADDING is chosen to be large enough that light circles whose centres are
 * at the viewport edge still render fully.  It is computed once at init/resize
 * from a configurable constant and is NEVER changed during a session.
 */

import * as PIXI from 'pixi.js';
import { Z_INDEX } from './zIndex';
import { IlluminationFilter } from './shaders/illuminationFilter';

// ---------------------------------------------------------------------------
// Fixed padding — set large enough to handle the biggest expected light radius
// at the minimum expected zoom level.  A value of 600 CSS px is comfortable
// for light ranges up to ~600 screen px.  Increase here if needed.
// ---------------------------------------------------------------------------
export const FIXED_PADDING = 600;

export interface PostProcessingConfig {
  width: number;
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

// Viewport dimensions (without padding) — stored so resize can recompute
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

/** Total canvas dimension in logical px (viewport + 2 × padding). */
function totalSize(viewportPx: number): number {
  return viewportPx + FIXED_PADDING * 2;
}

/**
 * Initialize the PixiJS post-processing layer.
 *
 * The PixiJS canvas is sized to totalSize(viewport) and positioned so that its
 * extra FIXED_PADDING border overhangs each edge of the parent container.
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
    });

    const canvas = pixiApp.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    // Overhang by FIXED_PADDING on every side so the extra canvas area sits
    // outside the viewport — light circles near the edge render into it freely.
    canvas.style.top = `${-FIXED_PADDING}px`;
    canvas.style.left = `${-FIXED_PADDING}px`;
    canvas.style.width = `${totalSize(config.width)}px`;
    canvas.style.height = `${totalSize(config.height)}px`;
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = String(Z_INDEX.CANVAS_ELEMENTS.FOG_POST_PROCESSING);

    container.appendChild(canvas);
    containerRef = container;

    // BlurFilter — no extra padding needed because sprites are no longer
    // negatively offset; they start at (0,0) and the canvas is already padded.
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

    // Sprites cover the full PixiJS canvas (padded size) starting at (0,0).
    // The fog canvas passed to updateFogTexture must also be this size.
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
      `✅ PixiJS post-processing initialized — viewport ${config.width}×${config.height}, ` +
      `canvas ${canvasW}×${canvasH}, padding ${FIXED_PADDING}px`
    );
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize post-processing:', error);
    return false;
  }
}

/**
 * Update the fog texture from a padded Canvas 2D source.
 * The source canvas MUST be (viewportW + FIXED_PADDING*2) × (viewportH + FIXED_PADDING*2)
 * — the same size as the PixiJS canvas.  No offset is applied.
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
 * Same size requirements as updateFogTexture.
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
  currentSettings = { ...currentSettings, ...settings };

  if (blurFilter) {
    blurFilter.strength = currentSettings.edgeBlur;
    blurFilter.quality = currentSettings.effectQuality === 'performance' ? 2 : 4;
  }

  if (illuminationFilter) {
    illuminationFilter.globalEdgeBlur = currentSettings.edgeBlur;
  }
}

/** No-op — retained for call-site compatibility. Shader is a pass-through. */
export function updateIlluminationData(_data: unknown): void {
  // Intentional no-op. All illumination geometry is on Canvas 2D now.
}

export function getEffectSettings(): EffectSettings {
  return { ...currentSettings };
}

/**
 * Resize the post-processing layer when the viewport changes.
 * Re-creates the PixiJS renderer at the new padded size.
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
  canvas.style.width = `${totalSize(width)}px`;
  canvas.style.height = `${totalSize(height)}px`;
  // Keep the CSS offset stable
  canvas.style.top = `${-FIXED_PADDING}px`;
  canvas.style.left = `${-FIXED_PADDING}px`;

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
      const canvas = pixiApp.canvas as HTMLCanvasElement;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      pixiApp.destroy(true, { children: true, texture: true });
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
  pixiApp.render();
}
