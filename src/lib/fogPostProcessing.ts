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

/**
 * Initialize the fog canvas used for capturing fog state
 */
export function initFogCanvas(width: number, height: number): void {
  if (!fogCanvas) {
    fogCanvas = document.createElement('canvas');
  }
  fogCanvas.width = width;
  fogCanvas.height = height;
  fogCtx = fogCanvas.getContext('2d', { willReadFrequently: false });
}

/**
 * Resize the fog canvas
 */
export function resizeFogCanvas(width: number, height: number): void {
  if (fogCanvas) {
    fogCanvas.width = width;
    fogCanvas.height = height;
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
  // Initialize fog canvas if needed
  if (!fogCanvas || fogCanvas.width !== canvasWidth || fogCanvas.height !== canvasHeight) {
    initFogCanvas(canvasWidth, canvasHeight);
  }
  
  if (!isPostProcessingReady() || !fogMasks || !fogCanvas || !fogCtx) {
    return;
  }

  // Throttle updates for performance
  const now = performance.now();
  if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) return;
  lastUpdateTime = now;

  // Clear fog canvas
  fogCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Apply the same transform as main canvas
  fogCtx.save();
  fogCtx.translate(transform.x, transform.y);
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

  // Draw black perimeter to prevent edge blur bleeding
  // The perimeter must be wider than the blur radius and FULLY OPAQUE
  const blurRadius = getEffectSettings().edgeBlur;
  const perimeterWidth = Math.max(blurRadius * 2, 40); // At least 40px or 2x blur

  // Use full opacity for perimeter to ensure complete blackout at edges
  fogCtx.fillStyle = 'rgba(0, 0, 0, 1)';

  // Top edge
  fogCtx.fillRect(0, 0, canvasWidth, perimeterWidth);
  // Bottom edge
  fogCtx.fillRect(0, canvasHeight - perimeterWidth, canvasWidth, perimeterWidth);
  // Left edge
  fogCtx.fillRect(0, 0, perimeterWidth, canvasHeight);
  // Right edge
  fogCtx.fillRect(canvasWidth - perimeterWidth, 0, perimeterWidth, canvasHeight);

  // Send to PixiJS for post-processing
  updateFogTexture(fogCanvas);
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
