/**
 * DD2VTT (Dungeondraft Universal VTT) file importer.
 * 
 * Converts dd2vtt format data into the application's internal formats:
 * - Region with background image
 * - Wall segments for vision/fog system
 * - Door connections for MapObject creation
 * - Light sources
 */

import { DD2VTTFile, DD2VTTPortal, DD2VTTLight, DD2VTTPoint } from './dd2vttTypes';
import { CanvasRegion } from '@/stores/regionStore';
import { DoorConnection } from './dungeonTypes';
import { LightSource } from '@/stores/lightStore';
import { LineSegment } from './wallGeometry';

export interface ImportedDD2VTTMap {
  region: Omit<CanvasRegion, 'id'>;
  wallSegments: LineSegment[];
  doors: DoorConnection[];
  lights: Omit<LightSource, 'id'>[];
  ambientLight: number; // 0-1 normalized
  imageDataUrl: string; // Full data URI for storage
  metadata: {
    format: number;
    gridSize: number;
    mapWidthPx: number;
    mapHeightPx: number;
  };
}

/**
 * Parse an ARGB hex string (e.g. "ffeccd8b") into components.
 */
export function parseARGBColor(argbHex: string): { r: number; g: number; b: number; a: number } {
  // Normalize: remove leading # if present
  const hex = argbHex.replace(/^#/, '');
  
  if (hex.length === 8) {
    // ARGB format
    const a = parseInt(hex.slice(0, 2), 16) / 255;
    const r = parseInt(hex.slice(2, 4), 16);
    const g = parseInt(hex.slice(4, 6), 16);
    const b = parseInt(hex.slice(6, 8), 16);
    return { r, g, b, a };
  } else if (hex.length === 6) {
    // RGB format (no alpha)
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }
  
  // Fallback: warm white
  return { r: 236, g: 205, b: 139, a: 1 };
}

/**
 * Convert ARGB hex to standard #RRGGBB hex color.
 */
function argbToHex(argbHex: string): string {
  const { r, g, b } = parseARGBColor(argbHex);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Extract wall segments from line_of_sight polylines.
 * Each polyline is an array of points; consecutive points form wall segments.
 */
export function extractWallSegments(
  lineOfSight: DD2VTTPoint[][],
  pixelsPerGrid: number,
  originX: number = 0,
  originY: number = 0
): LineSegment[] {
  const segments: LineSegment[] = [];
  
  for (const polyline of lineOfSight) {
    if (polyline.length < 2) continue;
    
    for (let i = 0; i < polyline.length - 1; i++) {
      segments.push({
        start: {
          x: (polyline[i].x - originX) * pixelsPerGrid,
          y: (polyline[i].y - originY) * pixelsPerGrid,
        },
        end: {
          x: (polyline[i + 1].x - originX) * pixelsPerGrid,
          y: (polyline[i + 1].y - originY) * pixelsPerGrid,
        },
      });
    }
  }
  
  return segments;
}

/**
 * Convert a dd2vtt portal to a DoorConnection.
 */
export function convertPortalToDoor(
  portal: DD2VTTPortal,
  pixelsPerGrid: number,
  originX: number = 0,
  originY: number = 0
): DoorConnection {
  const bound0 = portal.bounds[0];
  const bound1 = portal.bounds[1];
  
  // Position is the midpoint of the bounds in pixel coords
  const posX = ((bound0.x + bound1.x) / 2 - originX) * pixelsPerGrid;
  const posY = ((bound0.y + bound1.y) / 2 - originY) * pixelsPerGrid;
  
  // Determine door direction from bounds
  const dx = bound1.x - bound0.x;
  const dy = bound1.y - bound0.y;
  
  // The door direction is perpendicular to the door span
  // If door spans horizontally (dx > dy), direction is vertical and vice versa
  let direction: { x: number; y: number };
  if (Math.abs(dx) > Math.abs(dy)) {
    // Door spans horizontally, faces vertically
    direction = { x: 0, y: 1 };
  } else {
    // Door spans vertically, faces horizontally
    direction = { x: 1, y: 0 };
  }
  
  return {
    id: `dd2vtt-door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    position: { x: posX, y: posY },
    direction,
    type: 0, // Normal door (dd2vtt doesn't have Watabou-style door types)
  };
}

/**
 * Convert a dd2vtt light to a LightSource.
 */
export function convertDD2VTTLight(
  light: DD2VTTLight,
  pixelsPerGrid: number,
  originX: number = 0,
  originY: number = 0
): Omit<LightSource, 'id'> {
  const color = argbToHex(light.color);
  const { a: alpha } = parseARGBColor(light.color);
  
  return {
    position: {
      x: (light.position.x - originX) * pixelsPerGrid,
      y: (light.position.y - originY) * pixelsPerGrid,
    },
    radius: light.range * pixelsPerGrid,
    intensity: light.intensity * alpha,
    color,
    enabled: true,
    label: 'Imported Light',
  };
}

/**
 * Parse and validate a dd2vtt file.
 */
export async function parseDD2VTTFile(file: File): Promise<DD2VTTFile> {
  const text = await file.text();
  const json = JSON.parse(text);
  
  // Validate required fields
  if (!json.resolution || typeof json.resolution.pixels_per_grid !== 'number') {
    throw new Error('Invalid dd2vtt file: missing or invalid resolution');
  }
  
  if (!json.line_of_sight || !Array.isArray(json.line_of_sight)) {
    throw new Error('Invalid dd2vtt file: missing line_of_sight');
  }
  
  if (!json.image || typeof json.image !== 'string') {
    throw new Error('Invalid dd2vtt file: missing image data');
  }
  
  // Provide defaults for optional fields
  json.portals = json.portals || [];
  json.lights = json.lights || [];
  json.objects_line_of_sight = json.objects_line_of_sight || [];
  json.environment = json.environment || { baked_lighting: false, ambient_light: 'ff808080' };
  
  return json as DD2VTTFile;
}

/**
 * Import a dd2vtt map and convert all data to internal formats.
 */
export function importDD2VTTMap(dd2vtt: DD2VTTFile): ImportedDD2VTTMap {
  const { resolution, line_of_sight, objects_line_of_sight, portals, lights, environment, image } = dd2vtt;
  const ppg = resolution.pixels_per_grid;
  const originX = resolution.map_origin.x;
  const originY = resolution.map_origin.y;
  
  // Map dimensions in pixels
  const mapWidthPx = resolution.map_size.x * ppg;
  const mapHeightPx = resolution.map_size.y * ppg;
  
  // Create a single region covering the full map
  const region: Omit<CanvasRegion, 'id'> = {
    x: 0,
    y: 0,
    width: mapWidthPx,
    height: mapHeightPx,
    selected: false,
    color: 'hsl(210, 20%, 50%)',
    gridType: 'square',
    gridSize: ppg,
    gridScale: 1,
    gridSnapping: true,
    gridVisible: true,
    regionType: 'rectangle',
    backgroundRepeat: 'no-repeat',
    backgroundScale: 1,
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    locked: true, // Lock background region by default to prevent accidental moves
  };

  // Extract wall segments from both line_of_sight and objects_line_of_sight
  const wallSegments = [
    ...extractWallSegments(line_of_sight, ppg, originX, originY),
    ...extractWallSegments(objects_line_of_sight || [], ppg, originX, originY),
  ];
  
  // Convert portals to doors
  const doors = portals.map(portal => convertPortalToDoor(portal, ppg, originX, originY));
  
  // Convert lights
  const convertedLights = lights.map(light => convertDD2VTTLight(light, ppg, originX, originY));
  
  // Parse ambient light level from environment
  const { a: ambientAlpha } = parseARGBColor(environment.ambient_light);
  // Use the brightness of the ambient color as the ambient level
  const { r, g, b } = parseARGBColor(environment.ambient_light);
  const ambientBrightness = (r + g + b) / (3 * 255);
  const ambientLight = ambientAlpha * ambientBrightness;
  
  // Build full data URL for the image
  const imageDataUrl = `data:image/png;base64,${image}`;
  
  return {
    region,
    wallSegments,
    doors,
    lights: convertedLights,
    ambientLight,
    imageDataUrl,
    metadata: {
      format: dd2vtt.format,
      gridSize: ppg,
      mapWidthPx,
      mapHeightPx,
    },
  };
}
