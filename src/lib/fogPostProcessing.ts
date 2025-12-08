/**
 * Fog Post-Processing Effects
 * Specialized effects for fog of war rendering using PixiJS GPU acceleration
 */

import {
  updateFogTexture,
  updateIlluminationTexture,
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
let illuminationCanvas: HTMLCanvasElement | null = null;
let illuminationCtx: CanvasRenderingContext2D | null = null;
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
  
  // Initialize illumination canvas at same size
  if (!illuminationCanvas) {
    illuminationCanvas = document.createElement('canvas');
  }
  illuminationCanvas.width = width + padding * 2;
  illuminationCanvas.height = height + padding * 2;
  illuminationCtx = illuminationCanvas.getContext('2d', { willReadFrequently: false });
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
  if (illuminationCanvas) {
    illuminationCanvas.width = width + padding * 2;
    illuminationCanvas.height = height + padding * 2;
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
 * Parse color string to RGB values (0-1 range)
 */
function parseColorToRGB(color: string): { r: number; g: number; b: number } {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const bigint = parseInt(hex, 16);
    return {
      r: ((bigint >> 16) & 255) / 255,
      g: ((bigint >> 8) & 255) / 255,
      b: (bigint & 255) / 255,
    };
  }
  // Default to white
  return { r: 1, g: 1, b: 1 };
}

/**
 * Render per-source illumination colors to the illumination canvas
 * Each source's color is clipped to its visibility polygon
 * The tint fills the entire visibility polygon with gradient from center
 */
function renderIlluminationOverlay(
  sources: IlluminationSource[],
  transform: { x: number; y: number; zoom: number },
  padding: number,
  gridSize: number
): void {
  if (!illuminationCtx || !illuminationCanvas) return;
  
  const ctx = illuminationCtx;
  const width = illuminationCanvas.width;
  const height = illuminationCanvas.height;
  
  // Clear the illumination canvas
  ctx.clearRect(0, 0, width, height);
  
  // Use lighter blend mode to stack colors additively
  ctx.globalCompositeOperation = 'lighter';
  
  for (const source of sources) {
    if (!source.enabled || !source.colorEnabled || !source.visibilityPolygon) continue;
    
    ctx.save();
    
    // Apply transform with padding offset
    ctx.translate(padding + transform.x, padding + transform.y);
    ctx.scale(transform.zoom, transform.zoom);
    
    // Clip to this source's visibility polygon
    ctx.beginPath();
    ctx.clip(source.visibilityPolygon);
    
    // Create radial gradient from source position covering the full range
    // source.range is already in pixels, gridSize is 1
    // Don't apply gridSize here since range is pre-calculated in pixels
    const rangePixels = source.range;
    const brightZone = source.brightZone ?? 0.5;
    const pos = source.position;
    
    const gradient = ctx.createRadialGradient(
      pos.x, pos.y, 0,
      pos.x, pos.y, rangePixels
    );
    
    const rgb = parseColorToRGB(source.color);
    
    // Color tint intensity - use the source's colorIntensity setting
    const intensity = source.colorIntensity ?? 0.5;
    const brightAlpha = intensity * 0.7; // Scale to max 0.7 alpha
    const dimAlpha = intensity * 0.3;    // Dim zone is ~40% of bright
    
    gradient.addColorStop(0, `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${brightAlpha})`);
    gradient.addColorStop(brightZone, `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${brightAlpha})`);
    gradient.addColorStop(1, `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${dimAlpha})`);
    
    // Fill the full area - clipping will constrain to visibility polygon
    ctx.fillStyle = gradient;
    ctx.fillRect(pos.x - rangePixels, pos.y - rangePixels, rangePixels * 2, rangePixels * 2)
    
    ctx.restore();
  }
  
  // Reset composite operation
  ctx.globalCompositeOperation = 'source-over';
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

  // Render fog layers to off-screen canvas
  fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
  fogCtx.fill(fogMasks.unexploredMask);

  fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  fogCtx.fill(fogMasks.exploredOnlyMask);

  // CRITICAL: Cut out visibility polygons from fog using radial gradients
  // that respect bright/dim zones. Each source is clipped to its visibility
  // polygon, ensuring light is blocked by walls.
  // 
  // Model:
  // - Bright zone (inner circle): fully clears fog (alpha = 1)
  // - Dim zone (outer ring): partially clears fog (alpha = dimIntensity)
  if (illuminationData && illuminationData.sources.length > 0) {
    const gridSize = illuminationData.gridSize;
    fogCtx.globalCompositeOperation = 'destination-out';
    
    for (const source of illuminationData.sources) {
      if (!source.enabled || !source.visibilityPolygon) continue;
      
      const pos = source.position;
      // source.range is already in pixels when gridSize is 1
      const rangePixels = source.range;
      const brightZone = source.brightZone ?? 0.5;
      const dimIntensity = source.dimIntensity ?? 0.4;
      
      // Save context and clip to this source's visibility polygon
      fogCtx.save();
      fogCtx.clip(source.visibilityPolygon);
      
      // First, fully remove fog in the entire visible area
      fogCtx.fillStyle = 'rgba(255, 255, 255, 1)';
      fogCtx.fillRect(pos.x - rangePixels, pos.y - rangePixels, rangePixels * 2, rangePixels * 2);
      
      fogCtx.restore();
      
      // Now ADD BACK fog in the dim zone (outside bright zone but inside range)
      // This creates the "dim ring" effect - the outer area should be visibly darker
      if (dimIntensity < 1.0) {
        fogCtx.save();
        fogCtx.globalCompositeOperation = 'source-over'; // Add fog back
        fogCtx.clip(source.visibilityPolygon);
        
        // Create a donut-shaped gradient: transparent in bright zone, foggy in dim zone
        const dimGradient = fogCtx.createRadialGradient(
          pos.x, pos.y, 0,
          pos.x, pos.y, rangePixels
        );
        
        // fogAlpha is how much fog to add back in dim zone
        // At dimIntensity=0.35, we want 65% fog opacity in dim zone
        const fogAlpha = 1.0 - dimIntensity;
        
        // Bright zone stays fully clear (no fog added)
        dimGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        dimGradient.addColorStop(brightZone * 0.95, 'rgba(0, 0, 0, 0)'); // Stay clear until just before bright zone ends
        dimGradient.addColorStop(brightZone, `rgba(0, 0, 0, ${fogAlpha * 0.5})`); // Start transitioning
        dimGradient.addColorStop(Math.min(1, brightZone + 0.15), `rgba(0, 0, 0, ${fogAlpha})`); // Full dim
        dimGradient.addColorStop(1, `rgba(0, 0, 0, ${fogAlpha})`); // Maintain until edge
        
        fogCtx.fillStyle = dimGradient;
        fogCtx.fillRect(pos.x - rangePixels, pos.y - rangePixels, rangePixels * 2, rangePixels * 2);
        
        fogCtx.restore();
      }
    }
    
    fogCtx.globalCompositeOperation = 'source-over';
  }

  fogCtx.restore();

  // Render per-source illumination colors on Canvas 2D
  // Each source's color is clipped to its own visibility polygon
  if (illuminationData && illuminationData.sources.length > 0) {
    renderIlluminationOverlay(illuminationData.sources, transform, padding, illuminationData.gridSize);
    
    // Send illumination overlay to PixiJS
    if (illuminationCanvas) {
      updateIlluminationTexture(illuminationCanvas, padding);
    }
  }

  // Update GPU illumination data for bright/dim zone calculations
  // NOTE: Color is now handled by the illumination texture, but we still
  // need source positions/ranges for dim zone darkening effects
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
  // The illumination filter will apply blur and gradient effects
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
  if (illuminationCanvas) {
    illuminationCanvas = null;
    illuminationCtx = null;
  }
}
