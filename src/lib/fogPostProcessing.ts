/**
 * Fog Post-Processing Effects
 * Specialized effects for fog of war rendering using PixiJS GPU acceleration
 */

import {
  updateFogTexture,
  updateEffectSettings,
  getEffectSettings,
  isPostProcessingReady,
  renderPostProcessing,
  updateIlluminationData,
  type EffectSettings,
} from './postProcessingLayer';
import { createShaderData, type IlluminationSource } from '@/types/illumination';

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
let lastUpdateTime = 0;
const MIN_UPDATE_INTERVAL = 16; // ~60fps max
let currentPadding = 0; // Track current padding for off-screen rendering

/**
 * Get the current edge padding value
 */
export function getEdgePadding(): number {
  return currentPadding;
}

/**
 * Initialize the fog canvas used for capturing fog state
 * Canvas is larger than viewport to allow blur edges to render off-screen
 */
export function initFogCanvas(width: number, height: number, edgeBlur: number = 0): void {
  const padding = edgeBlur * 2;
  currentPadding = padding;
  
  if (!fogCanvas) {
    fogCanvas = document.createElement('canvas');
  }
  // Canvas is larger by 2x padding (padding on each side)
  fogCanvas.width = width + padding * 2;
  fogCanvas.height = height + padding * 2;
  fogCtx = fogCanvas.getContext('2d', { willReadFrequently: false });
}

/**
 * Resize the fog canvas
 */
export function resizeFogCanvas(width: number, height: number, edgeBlur: number = 0): void {
  const padding = edgeBlur * 2;
  currentPadding = padding;
  
  if (fogCanvas) {
    fogCanvas.width = width + padding * 2;
    fogCanvas.height = height + padding * 2;
  }
}

/**
 * Get the fog canvas context
 */
export function getFogCanvasContext(): CanvasRenderingContext2D | null {
  return fogCtx;
}

/**
 * Illumination source data for GPU rendering
 */
interface IlluminationData {
  sources: IlluminationSource[];
  gridSize: number;
  transform: { x: number; y: number; zoom: number };
}

/**
 * Capture fog state from the main canvas and apply GPU post-processing
 * This is called during the render loop when fog changes
 * 
 * The fog mask is rendered on Canvas 2D, then passed to PixiJS GPU shader
 * for illumination calculations (bright/dim zones, soft edges, stacking)
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
  const edgeBlur = getEffectSettings().edgeBlur;
  const padding = edgeBlur * 2;
  const paddedWidth = canvasWidth + padding * 2;
  const paddedHeight = canvasHeight + padding * 2;
  
  // Initialize fog canvas if needed (with padding for off-screen blur)
  if (!fogCanvas || fogCanvas.width !== paddedWidth || fogCanvas.height !== paddedHeight) {
    initFogCanvas(canvasWidth, canvasHeight, edgeBlur);
  }
  
  if (!isPostProcessingReady() || !fogMasks || !fogCanvas || !fogCtx) {
    return;
  }

  // Throttle updates for performance
  const now = performance.now();
  if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) return;
  lastUpdateTime = now;

  // Clear fog canvas (including padding area)
  fogCtx.clearRect(0, 0, paddedWidth, paddedHeight);

  // Apply transform with padding offset
  // Content is rendered with padding offset so blur edges are outside viewport
  fogCtx.save();
  fogCtx.translate(padding + transform.x, padding + transform.y);
  fogCtx.scale(transform.zoom, transform.zoom);

  // Render fog layers to off-screen canvas (just the masks, no cutouts)
  // The GPU shader will handle illumination cutouts
  fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
  fogCtx.fill(fogMasks.unexploredMask);

  fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  fogCtx.fill(fogMasks.exploredOnlyMask);

  fogCtx.restore();

  // Update GPU illumination data if provided
  if (illuminationData && illuminationData.sources.length > 0) {
    const shaderData = createShaderData(
      illuminationData.sources,
      illuminationData.gridSize,
      { 
        x: padding + transform.x, 
        y: padding + transform.y, 
        zoom: transform.zoom 
      }
    );
    updateIlluminationData(shaderData);
  }

  // Send fog mask to PixiJS for GPU post-processing
  // The illumination filter will handle bright/dim zones and soft edges
  updateFogTexture(fogCanvas, padding);
  renderPostProcessing();
}

/**
 * Update fog effect settings
 */
export function updateFogEffects(config: Partial<FogEffectConfig>): void {
  const effectSettings: Partial<EffectSettings> = {};

  if (config.edgeBlur !== undefined) {
    effectSettings.edgeBlur = config.edgeBlur;
  }
  if (config.lightFalloff !== undefined) {
    effectSettings.lightFalloff = config.lightFalloff;
  }
  if (config.volumetricEnabled !== undefined) {
    effectSettings.volumetricEnabled = config.volumetricEnabled;
  }
  if (config.effectQuality !== undefined) {
    effectSettings.effectQuality = config.effectQuality;
  }

  updateEffectSettings(effectSettings);
}

/**
 * Get current fog effect configuration
 */
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

/**
 * Quality presets for fog effects
 */
export const FOG_EFFECT_PRESETS = {
  performance: {
    edgeBlur: 4,
    bloomIntensity: 0,
    volumetricEnabled: false,
    effectQuality: 'performance' as const,
  },
  balanced: {
    edgeBlur: 8,
    bloomIntensity: 0.5,
    volumetricEnabled: false,
    effectQuality: 'balanced' as const,
  },
  cinematic: {
    edgeBlur: 12,
    bloomIntensity: 0.8,
    volumetricEnabled: true,
    effectQuality: 'cinematic' as const,
  },
};

/**
 * Apply a preset configuration
 */
export function applyFogEffectPreset(preset: keyof typeof FOG_EFFECT_PRESETS): void {
  const config = FOG_EFFECT_PRESETS[preset];
  updateFogEffects(config);
}

/**
 * Cleanup fog post-processing resources
 */
export function cleanupFogPostProcessing(): void {
  if (fogCanvas) {
    fogCanvas = null;
    fogCtx = null;
  }
}
