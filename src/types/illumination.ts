/**
 * Unified Illumination System Types
 * All light sources (token vision, placed lights) use this unified model
 */

export type IlluminationAnimationType = 'none' | 'flicker' | 'pulse' | 'candle';

export interface IlluminationSource {
  id: string;
  name: string;
  enabled: boolean;
  
  // Position (world coordinates, in pixels)
  position: { x: number; y: number };
  
  // Range settings (in grid units)
  range: number;                    // Max illumination distance
  brightZone: number;               // 0-1, where bright zone ends (as % of range)
  
  // Intensity settings (fog removal amount)
  brightIntensity: number;          // 0-1, how much fog to remove in bright zone
  dimIntensity: number;             // 0-1, how much fog to remove in dim zone
  
  // Visual settings
  color: string;                    // Tint color (hex)
  colorEnabled: boolean;            // Whether to apply color tinting (default: false)
  colorIntensity: number;           // 0-1, how strong the color tint is
  softEdge: boolean;                // Whether to blur the outer edge
  softEdgeRadius: number;           // Blur amount (0-20 pixels)
  
  // Animation settings
  animation: IlluminationAnimationType;  // Type of animation effect
  animationSpeed: number;           // Animation speed multiplier (0.5-2.0)
  animationIntensity: number;       // How strong the animation effect is (0-1)
  
  // Pre-computed visibility polygon (set by visibility engine)
  visibilityPolygon?: Path2D;
}

/**
 * Template for creating illumination sources
 * Used by vision profiles to provide preset configurations
 */
export interface IlluminationTemplate {
  id: string;
  name: string;
  range: number;
  brightZone: number;
  brightIntensity: number;
  dimIntensity: number;
  color: string;
  colorEnabled: boolean;
  colorIntensity: number;
  softEdge: boolean;
  softEdgeRadius: number;
  animation: IlluminationAnimationType;
  animationSpeed: number;
  animationIntensity: number;
}

/**
 * Create a new illumination source from a template
 */
export function createIlluminationFromTemplate(
  template: IlluminationTemplate,
  position: { x: number; y: number },
  id?: string
): IlluminationSource {
  return {
    id: id || `illum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: template.name,
    enabled: true,
    position,
    range: template.range,
    brightZone: template.brightZone,
    brightIntensity: template.brightIntensity,
    dimIntensity: template.dimIntensity,
    color: template.color,
    colorEnabled: template.colorEnabled,
    colorIntensity: template.colorIntensity,
    softEdge: template.softEdge,
    softEdgeRadius: template.softEdgeRadius,
    animation: template.animation,
    animationSpeed: template.animationSpeed,
    animationIntensity: template.animationIntensity,
  };
}

/**
 * Default illumination template values
 */
export const DEFAULT_ILLUMINATION: Omit<IlluminationSource, 'id' | 'position'> = {
  name: 'Light',
  enabled: true,
  range: 12,          // 60ft (12 grid squares * 5ft)
  brightZone: 0.5,    // Inner 50% is bright
  brightIntensity: 1.0,
  dimIntensity: 0.6,
  color: '#FFD700',
  colorEnabled: false, // Color tinting disabled by default
  colorIntensity: 0.15, // Default 15% intensity when enabled
  softEdge: true,
  softEdgeRadius: 8,
  animation: 'none',
  animationSpeed: 1.0,
  animationIntensity: 0.3,
};

/**
 * Calculate animated intensity multiplier based on time and animation type
 * Returns a value between 0 and 1 that should be applied to intensity values
 */
export function calculateAnimatedIntensity(
  animation: IlluminationAnimationType,
  animationSpeed: number,
  animationIntensity: number,
  time: number,
  sourceId: string
): number {
  if (animation === 'none') return 1.0;
  
  // Use source ID to create phase offset so lights don't flicker in sync
  const phaseOffset = hashStringToNumber(sourceId) * Math.PI * 2;
  const t = time * animationSpeed * 0.001; // Convert to seconds
  
  switch (animation) {
    case 'flicker': {
      // Irregular flickering using multiple sine waves
      const flicker1 = Math.sin(t * 12 + phaseOffset) * 0.5;
      const flicker2 = Math.sin(t * 23 + phaseOffset * 1.3) * 0.3;
      const flicker3 = Math.sin(t * 37 + phaseOffset * 0.7) * 0.2;
      // Random-ish spikes
      const spike = Math.pow(Math.sin(t * 5 + phaseOffset), 8) * 0.4;
      const combined = (flicker1 + flicker2 + flicker3 + spike) * animationIntensity;
      return Math.max(0.3, Math.min(1.0, 1.0 - combined * 0.5));
    }
    
    case 'candle': {
      // Gentler, more organic flicker with occasional dips
      const base = Math.sin(t * 8 + phaseOffset) * 0.15;
      const gentle = Math.sin(t * 3 + phaseOffset * 1.5) * 0.1;
      const occasional = Math.pow(Math.sin(t * 1.5 + phaseOffset), 12) * 0.3;
      const combined = (base + gentle + occasional) * animationIntensity;
      return Math.max(0.5, Math.min(1.0, 1.0 - combined));
    }
    
    case 'pulse': {
      // Smooth sinusoidal pulsing
      const pulse = (Math.sin(t * 2 + phaseOffset) + 1) * 0.5;
      return 1.0 - (pulse * animationIntensity * 0.4);
    }
    
    default:
      return 1.0;
  }
}

/**
 * Simple hash function to convert string to number (for phase offset)
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return (hash >>> 0) / 0xFFFFFFFF; // Normalize to 0-1
}

/**
 * GPU shader data structure for passing to PixiJS
 * Limited to 16 sources for uniform array performance
 */
export const MAX_ILLUMINATION_SOURCES = 16;

export interface IlluminationShaderData {
  sourceCount: number;
  positions: Float32Array;      // vec2 array [x1, y1, x2, y2, ...]
  ranges: Float32Array;         // float array
  brightZones: Float32Array;    // float array
  brightIntensities: Float32Array;
  dimIntensities: Float32Array;
  softEdgeRadii: Float32Array;
  colors: Float32Array;         // vec3 array [r1, g1, b1, r2, g2, b2, ...]
  colorEnabled: Float32Array;   // float array (0.0 = disabled, 1.0 = enabled)
}

/**
 * Create shader data from illumination sources
 */
/**
 * Create shader data from illumination sources
 * 
 * IMPORTANT: Positions are transformed to match the fog canvas coordinate system.
 * The fog canvas applies: translate(padding + transform.x, padding + transform.y) then scale(zoom)
 * So world coordinates become: worldPos * zoom + (padding + transform.x/y)
 * 
 * The transform.x/y passed here should already include the padding offset.
 */
export function createShaderData(
  sources: IlluminationSource[],
  gridSize: number,
  transform: { x: number; y: number; zoom: number }
): IlluminationShaderData {
  const activeCount = Math.min(sources.filter(s => s.enabled).length, MAX_ILLUMINATION_SOURCES);
  
  const data: IlluminationShaderData = {
    sourceCount: activeCount,
    positions: new Float32Array(MAX_ILLUMINATION_SOURCES * 2),
    ranges: new Float32Array(MAX_ILLUMINATION_SOURCES),
    brightZones: new Float32Array(MAX_ILLUMINATION_SOURCES),
    brightIntensities: new Float32Array(MAX_ILLUMINATION_SOURCES),
    dimIntensities: new Float32Array(MAX_ILLUMINATION_SOURCES),
    softEdgeRadii: new Float32Array(MAX_ILLUMINATION_SOURCES),
    colors: new Float32Array(MAX_ILLUMINATION_SOURCES * 3),
    colorEnabled: new Float32Array(MAX_ILLUMINATION_SOURCES),
  };
  
  const activeSources = sources.filter(s => s.enabled).slice(0, MAX_ILLUMINATION_SOURCES);
  
  activeSources.forEach((source, i) => {
    // Transform world position to fog canvas coordinates
    // The fog canvas uses: ctx.translate(offset.x, offset.y); ctx.scale(zoom, zoom);
    // So a world point P appears at: P * zoom + offset
    const screenX = (source.position.x * transform.zoom) + transform.x;
    const screenY = (source.position.y * transform.zoom) + transform.y;
    
    data.positions[i * 2] = screenX;
    data.positions[i * 2 + 1] = screenY;
    
    // Range is stored in grid units, convert to screen pixels
    data.ranges[i] = source.range * gridSize * transform.zoom;
    data.brightZones[i] = source.brightZone;
    data.brightIntensities[i] = source.brightIntensity;
    data.dimIntensities[i] = source.dimIntensity;
    data.softEdgeRadii[i] = source.softEdgeRadius * transform.zoom;
    
    // Parse hex color to RGB (0-1 range)
    const hex = source.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    data.colors[i * 3] = r;
    data.colors[i * 3 + 1] = g;
    data.colors[i * 3 + 2] = b;
    
    // Color enabled flag
    data.colorEnabled[i] = source.colorEnabled ? 1.0 : 0.0;
  });
  
  return data;
}
