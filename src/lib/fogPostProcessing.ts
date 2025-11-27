/**
 * Fog Post-Processing Effects
 * Specialized effects for fog of war rendering using PixiJS
 */

import {
  updateFogTexture,
  updateEffectSettings,
  getEffectSettings,
  isPostProcessingReady,
  renderPostProcessing,
  type EffectSettings,
} from './postProcessingLayer';

export interface FogEffectConfig {
  enabled: boolean;
  edgeBlur: number;
  bloomIntensity: number;
  volumetricEnabled: boolean;
  effectQuality: 'performance' | 'balanced' | 'cinematic';
}

export const DEFAULT_FOG_EFFECTS: FogEffectConfig = {
  enabled: true,
  edgeBlur: 8,
  bloomIntensity: 0.5,
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
 * Token visibility data for rendering cutouts
 */
interface TokenVisibilityData {
  position: { x: number; y: number };
  visionRange: number;
  visibilityPath: Path2D;
}

/**
 * Capture fog state from the main canvas and apply post-processing
 * This is called during the render loop when fog changes
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
  tokenVisibilityData: TokenVisibilityData[] = []
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

  // Render fog layers to off-screen canvas
  fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
  fogCtx.fill(fogMasks.unexploredMask);

  fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  fogCtx.fill(fogMasks.exploredOnlyMask);

  // Cut out token visibility areas
  if (tokenVisibilityData.length > 0) {
    fogCtx.globalCompositeOperation = "destination-out";
    
    tokenVisibilityData.forEach(({ visibilityPath }) => {
      fogCtx.fillStyle = "rgba(255, 255, 255, 1)";
      fogCtx.fill(visibilityPath);
    });
    
    fogCtx.globalCompositeOperation = "source-over";
  }

  fogCtx.restore();

  // Send to PixiJS for post-processing
  // The padding will be positioned off-screen by the PixiJS layer
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
  if (config.bloomIntensity !== undefined) {
    effectSettings.bloomIntensity = config.bloomIntensity;
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
    bloomIntensity: settings.bloomIntensity,
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
