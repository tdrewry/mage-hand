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
}

const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  edgeBlur: 8,
  lightFalloff: 0.5,
  bloomThreshold: 0.7,
  volumetricEnabled: false,
  effectQuality: 'balanced',
};

let pixiApp: PIXI.Application | null = null;
let fogSprite: PIXI.Sprite | null = null;
let fogTexture: PIXI.Texture | null = null;
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
    // Apply both blur and illumination filters
    fogContainer.filters = [illuminationFilter, blurFilter];
    pixiApp.stage.addChild(fogContainer);

    // Create fog sprite (will be updated with fog texture)
    fogSprite = new PIXI.Sprite();
    fogSprite.width = effectiveWidth;
    fogSprite.height = effectiveHeight;
    fogContainer.addChild(fogSprite);

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
 * The source canvas may be larger than the viewport to allow blur edges off-screen
 */
export function updateFogTexture(sourceCanvas: HTMLCanvasElement, padding: number = 0): void {
  if (!pixiApp || !fogSprite || !isInitialized) return;

  try {
    currentPadding = padding;
    
    // Check if we can update the existing texture or need to create a new one
    if (fogTexture && fogTexture.source && 
        fogTexture.source.width === sourceCanvas.width && 
        fogTexture.source.height === sourceCanvas.height) {
      // Update existing texture in-place (much faster than recreating)
      fogTexture.source.resource = sourceCanvas;
      fogTexture.source.update();
    } else {
      // Size changed or no texture exists - need to create new texture
      if (fogTexture) {
        fogTexture.destroy(true);
      }
      fogTexture = PIXI.Texture.from(sourceCanvas);
      fogSprite.texture = fogTexture;
    }
    
    // The fog canvas is larger than viewport by 2*padding (padding on each side).
    // The fog content (and illumination positions) are in fog canvas coordinates,
    // with the visible viewport area starting at (padding, padding) in those coords.
    // 
    // By positioning the sprite at (-padding, -padding), we offset it so that:
    // - Fog canvas position (padding, padding) aligns with PixiJS stage position (0, 0)
    // - Fog canvas position (0, 0) is at stage position (-padding, -padding) - off-screen
    // 
    // This ensures the visible fog area aligns with the viewport while allowing
    // blur effects to extend into the padding area without hard edges.
    fogSprite.width = sourceCanvas.width;
    fogSprite.height = sourceCanvas.height;
    fogSprite.x = -padding;
    fogSprite.y = -padding;
  } catch (error) {
    console.error('Failed to update fog texture:', error);
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
 */
export function updateIlluminationData(data: IlluminationShaderData): void {
  if (!illuminationFilter || !isInitialized) return;
  illuminationFilter.updateIllumination(data);
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
