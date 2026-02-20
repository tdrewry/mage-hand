/**
 * Post-Processing Layer using PixiJS
 * Provides WebGL-based effects for fog of war and unified illumination
 */

import * as PIXI from 'pixi.js';
import { Z_INDEX } from './zIndex';
import { IlluminationFilter } from './shaders/illuminationFilter';
import type { IlluminationShaderData } from '@/types/illumination';

export interface PostProcessingConfig {
  width: number;
  height: number;
  resolution?: number;
  antialias?: boolean;
}

export interface EffectSettings {
  edgeBlur: number;        // 0-20 pixels
  lightFalloff: number;    // 0-1, default bright zone for new sources
  bloomThreshold: number;  // 0.5-1 (legacy, unused)
  volumetricEnabled: boolean;
  effectQuality: 'performance' | 'balanced' | 'cinematic';
  dimZoneOpacity: number;  // 0-1, how much fog remains in dim zone (default 0.4)
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

/**
 * Get quality multiplier based on effect quality setting
 */
function getQualityMultiplier(quality: EffectSettings['effectQuality']): number {
  switch (quality) {
    case 'performance': return 0.5;
    case 'balanced': return 0.75;
    case 'cinematic': return 1.0;
    default: return 0.75;
  }
}

/**
 * Initialize the PixiJS post-processing layer
 */
export async function initPostProcessing(
  container: HTMLElement,
  config: PostProcessingConfig
): Promise<boolean> {
  try {
    // Clean up any existing instance
    if (pixiApp) {
      await cleanupPostProcessing();
    }

    const qualityMultiplier = getQualityMultiplier(currentSettings.effectQuality);
    const effectiveWidth = Math.floor(config.width * qualityMultiplier);
    const effectiveHeight = Math.floor(config.height * qualityMultiplier);

    // Create PixiJS application with transparent background
    pixiApp = new PIXI.Application();
    
    await pixiApp.init({
      width: effectiveWidth,
      height: effectiveHeight,
      backgroundAlpha: 0,
      antialias: config.antialias ?? true,
      resolution: config.resolution ?? 1,
      autoDensity: true,
    });

    // Style the canvas for overlay positioning
    const canvas = pixiApp.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = `${config.width}px`;
    canvas.style.height = `${config.height}px`;
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = String(Z_INDEX.CANVAS_ELEMENTS.FOG_POST_PROCESSING);

    // Append to container
    container.appendChild(canvas);
    containerRef = container;

    // Create blur filter for fog edges
    blurFilter = new PIXI.BlurFilter({
      strength: currentSettings.edgeBlur,
      quality: currentSettings.effectQuality === 'performance' ? 2 : 4,
    });
    
    // Create illumination filter for GPU-based light calculations
    illuminationFilter = new IlluminationFilter({
      globalEdgeBlur: currentSettings.edgeBlur,
    });

    // Create a container for the fog sprite
    const fogContainer = new PIXI.Container();
    // Apply blur FIRST, then illumination. This ensures illumination
    // clips to the already-blurred visibility boundaries, preventing
    // color tints and dim effects from bleeding through walls.
    fogContainer.filters = [blurFilter, illuminationFilter];
    pixiApp.stage.addChild(fogContainer);

    // Create fog sprite (will be updated with fog texture)
    fogSprite = new PIXI.Sprite();
    fogSprite.width = effectiveWidth;
    fogSprite.height = effectiveHeight;
    fogContainer.addChild(fogSprite);
    
    // Create illumination overlay sprite (rendered on top with additive blending)
    // IMPORTANT: Must be added to the SAME fogContainer so it shares the same
    // filter coordinate space. Adding it directly to stage causes pixel-offset
    // misalignment because the BlurFilter internally expands its render area
    // (adding internal padding), shifting the fog sprite's effective position
    // relative to anything rendered outside the container.
    illuminationSprite = new PIXI.Sprite();
    illuminationSprite.width = effectiveWidth;
    illuminationSprite.height = effectiveHeight;
    illuminationSprite.blendMode = 'add';
    fogContainer.addChild(illuminationSprite);

    isInitialized = true;
    console.log('✅ PixiJS post-processing initialized with GPU illumination');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize post-processing:', error);
    return false;
  }
}

let currentPadding = 0;

/**
 * Update the fog texture from a Canvas 2D source
 * The source canvas may be larger than the viewport (padded for off-screen blur/light edges).
 * We use a texture frame crop to extract only the viewport-visible region so that
 * sprites are always positioned at (0,0) — avoiding negative-position PixiJS sprites
 * that get clipped by the BlurFilter's internal padding boundary.
 */
export function updateFogTexture(sourceCanvas: HTMLCanvasElement, padding: number = 0): void {
  if (!pixiApp || !fogSprite || !isInitialized) return;

  try {
    currentPadding = padding;
    const qualityMultiplier = getQualityMultiplier(currentSettings.effectQuality);

    // Viewport dimensions (without padding)
    const viewportW = sourceCanvas.width - padding * 2;
    const viewportH = sourceCanvas.height - padding * 2;

    // Always recreate texture when source canvas size or padding changes —
    // PixiJS Texture frames are immutable after creation.
    const needsRecreate = !fogTexture ||
      !fogTexture.source ||
      fogTexture.source.width !== sourceCanvas.width ||
      fogTexture.source.height !== sourceCanvas.height ||
      fogTexture.frame.x !== padding ||
      fogTexture.frame.width !== viewportW;

    if (needsRecreate) {
      if (fogTexture) fogTexture.destroy(true);
      const baseTexture = PIXI.Texture.from(sourceCanvas);
      // Crop to the viewport region (skip the padding border on all sides).
      // This keeps the sprite at position (0,0) — no negative-offset clipping.
      fogTexture = new PIXI.Texture({
        source: baseTexture.source,
        frame: new PIXI.Rectangle(padding, padding, viewportW, viewportH),
      });
      fogSprite.texture = fogTexture;
    } else {
      // In-place update when dimensions haven't changed
      fogTexture.source.resource = sourceCanvas;
      fogTexture.source.update();
    }

    // Sprite always at origin — no negative offsets needed
    fogSprite.width = viewportW * qualityMultiplier;
    fogSprite.height = viewportH * qualityMultiplier;
    fogSprite.x = 0;
    fogSprite.y = 0;
  } catch (error) {
    console.error('Failed to update fog texture:', error);
  }
}

/**
 * Update the illumination overlay texture from a Canvas 2D source
 * This contains pre-rendered per-source color tints clipped to visibility polygons.
 * Uses the same frame-crop technique as updateFogTexture to avoid negative sprite positions.
 */
export function updateIlluminationTexture(sourceCanvas: HTMLCanvasElement, padding: number = 0): void {
  if (!pixiApp || !illuminationSprite || !isInitialized) return;

  try {
    const qualityMultiplier = getQualityMultiplier(currentSettings.effectQuality);

    const viewportW = sourceCanvas.width - padding * 2;
    const viewportH = sourceCanvas.height - padding * 2;

    const needsRecreate = !illuminationTexture ||
      !illuminationTexture.source ||
      illuminationTexture.source.width !== sourceCanvas.width ||
      illuminationTexture.source.height !== sourceCanvas.height ||
      illuminationTexture.frame.x !== padding ||
      illuminationTexture.frame.width !== viewportW;

    if (needsRecreate) {
      if (illuminationTexture) illuminationTexture.destroy(true);
      const baseTexture = PIXI.Texture.from(sourceCanvas);
      illuminationTexture = new PIXI.Texture({
        source: baseTexture.source,
        frame: new PIXI.Rectangle(padding, padding, viewportW, viewportH),
      });
      illuminationSprite.texture = illuminationTexture;
    } else {
      illuminationTexture.source.resource = sourceCanvas;
      illuminationTexture.source.update();
    }

    // Sprite always at origin — no negative offsets needed
    illuminationSprite.width = viewportW * qualityMultiplier;
    illuminationSprite.height = viewportH * qualityMultiplier;
    illuminationSprite.x = 0;
    illuminationSprite.y = 0;
  } catch (error) {
    console.error('Failed to update illumination texture:', error);
  }
}

/**
 * Update effect settings
 */
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

/**
 * Update illumination data for GPU processing
 * Positions must be scaled by quality multiplier to match render resolution
 */
export function updateIlluminationData(data: IlluminationShaderData): void {
  if (!illuminationFilter || !isInitialized) return;
  
  const qualityMultiplier = getQualityMultiplier(currentSettings.effectQuality);
  
  // Scale positions and ranges to match the reduced render resolution
  const scaledData: IlluminationShaderData = {
    ...data,
    positions: new Float32Array(data.positions.length),
    ranges: new Float32Array(data.ranges.length),
    softEdgeRadii: new Float32Array(data.softEdgeRadii.length),
  };
  
  for (let i = 0; i < data.sourceCount; i++) {
    scaledData.positions[i * 2] = data.positions[i * 2] * qualityMultiplier;
    scaledData.positions[i * 2 + 1] = data.positions[i * 2 + 1] * qualityMultiplier;
    scaledData.ranges[i] = data.ranges[i] * qualityMultiplier;
    scaledData.softEdgeRadii[i] = data.softEdgeRadii[i] * qualityMultiplier;
  }
  
  // Copy the rest unchanged
  scaledData.brightZones = data.brightZones;
  scaledData.brightIntensities = data.brightIntensities;
  scaledData.dimIntensities = data.dimIntensities;
  scaledData.colors = data.colors;
  
  illuminationFilter.updateIllumination(scaledData);
}

/**
 * Get current effect settings
 */
export function getEffectSettings(): EffectSettings {
  return { ...currentSettings };
}

/**
 * Resize the post-processing layer
 */
export function resizePostProcessing(width: number, height: number): void {
  if (!pixiApp || !isInitialized) return;

  const qualityMultiplier = getQualityMultiplier(currentSettings.effectQuality);
  const effectiveWidth = Math.floor(width * qualityMultiplier);
  const effectiveHeight = Math.floor(height * qualityMultiplier);

  pixiApp.renderer.resize(effectiveWidth, effectiveHeight);
  
  const canvas = pixiApp.canvas as HTMLCanvasElement;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (fogSprite) {
    fogSprite.width = effectiveWidth;
    fogSprite.height = effectiveHeight;
  }
  
  if (illuminationSprite) {
    illuminationSprite.width = effectiveWidth;
    illuminationSprite.height = effectiveHeight;
  }
}

/**
 * Show/hide the post-processing layer
 */
export function setPostProcessingVisible(visible: boolean): void {
  if (!pixiApp || !isInitialized) return;
  
  const canvas = pixiApp.canvas as HTMLCanvasElement;
  canvas.style.display = visible ? 'block' : 'none';
}

/**
 * Check if post-processing is initialized
 */
export function isPostProcessingReady(): boolean {
  return isInitialized && pixiApp !== null;
}

/**
 * Get the PixiJS canvas element
 */
export function getPostProcessingCanvas(): HTMLCanvasElement | null {
  return pixiApp?.canvas as HTMLCanvasElement ?? null;
}

/**
 * Clean up the post-processing layer
 */
export async function cleanupPostProcessing(): Promise<void> {
  try {
    if (fogTexture) {
      fogTexture.destroy(true);
      fogTexture = null;
    }
    
    if (illuminationTexture) {
      illuminationTexture.destroy(true);
      illuminationTexture = null;
    }

    if (blurFilter) {
      blurFilter.destroy();
      blurFilter = null;
    }
    
    if (illuminationFilter) {
      illuminationFilter.destroy();
      illuminationFilter = null;
    }

    if (fogSprite) {
      fogSprite.destroy();
      fogSprite = null;
    }
    
    if (illuminationSprite) {
      illuminationSprite.destroy();
      illuminationSprite = null;
    }

    if (pixiApp) {
      const canvas = pixiApp.canvas as HTMLCanvasElement;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
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

/**
 * Render one frame of post-processing effects
 */
export function renderPostProcessing(): void {
  if (!pixiApp || !isInitialized) return;
  pixiApp.render();
}
