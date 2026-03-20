/**
 * Light Map Object Utilities
 * 
 * Helper functions for converting light-category MapObjects to/from IlluminationSource,
 * bridging the legacy shallow fields (lightColor, lightRadius) with the unified system.
 */

import type { MapObject } from '@/types/mapObjectTypes';
import type { IlluminationSource } from '@/types/illumination';
import { DEFAULT_ILLUMINATION } from '@/types/illumination';

const GRID_PX = 50; // Grid pixels per unit, matches the project-wide convention

/**
 * Derive a full IlluminationSource from a light-category MapObject.
 * Prefers the stored `illuminationSource` field; falls back to converting the
 * legacy lightColor/lightRadius fields for backward compatibility.
 */
export function mapObjectToIlluminationSource(obj: MapObject): IlluminationSource {
  // Use stored full source if available
  if (obj.illuminationSource) {
    return {
      ...obj.illuminationSource,
      id: `mo-light-${obj.id}`,
      position: obj.position,
      enabled: obj.illuminationSource.enabled !== false && obj.lightEnabled !== false,
    };
  }

  // Legacy fallback: convert shallow fields
  const lightRadius = obj.lightRadius ?? 100;        // pixels
  const brightRadius = obj.lightBrightRadius ?? lightRadius * 0.5;
  const rangeInUnits = lightRadius / GRID_PX;
  const brightZone = lightRadius > 0 ? brightRadius / lightRadius : 0.5;

  return {
    id: `mo-light-${obj.id}`,
    name: obj.label || 'Light Source',
    enabled: obj.lightEnabled !== false,
    position: obj.position,
    range: rangeInUnits,
    brightZone,
    brightIntensity: 1.0,
    dimIntensity: obj.lightIntensity ?? DEFAULT_ILLUMINATION.dimIntensity,
    color: obj.lightColor ?? DEFAULT_ILLUMINATION.color,
    colorEnabled: !!obj.lightColor && obj.lightColor !== '#fbbf24',
    colorIntensity: DEFAULT_ILLUMINATION.colorIntensity,
    softEdge: DEFAULT_ILLUMINATION.softEdge,
    softEdgeRadius: DEFAULT_ILLUMINATION.softEdgeRadius,
    animation: 'none',
    animationSpeed: 1.0,
    animationIntensity: 0.0,
  };
}

/**
 * Convert an array of light-category MapObjects into IlluminationSource[] for the fog system.
 */
export function lightMapObjectsToIlluminationSources(
  lightObjects: MapObject[]
): IlluminationSource[] {
  return lightObjects.map(mapObjectToIlluminationSource);
}
