/**
 * Type definitions for the dd2vtt (Dungeondraft Universal VTT) format.
 * 
 * All coordinates in this format are in grid units.
 * Multiply by `resolution.pixels_per_grid` to convert to pixel space.
 */

export interface DD2VTTPoint {
  x: number;
  y: number;
}

export interface DD2VTTResolution {
  map_origin: DD2VTTPoint;
  map_size: DD2VTTPoint;    // Width and height in grid units
  pixels_per_grid: number;   // e.g. 70 or 50
}

export interface DD2VTTPortal {
  position: DD2VTTPoint;
  bounds: [DD2VTTPoint, DD2VTTPoint]; // Two endpoints defining the doorway
  rotation: number;                    // Rotation in degrees
  closed: boolean;
  freestanding: boolean;
}

export interface DD2VTTLight {
  position: DD2VTTPoint;
  range: number;      // Range in grid units
  intensity: number;  // 0-1
  color: string;      // ARGB hex string, e.g. "ffeccd8b"
  shadows: boolean;
}

export interface DD2VTTEnvironment {
  baked_lighting: boolean;
  ambient_light: string; // ARGB hex string
}

export interface DD2VTTFile {
  format: number;                           // e.g. 0.2
  resolution: DD2VTTResolution;
  line_of_sight: DD2VTTPoint[][];           // Arrays of polylines (wall geometry)
  objects_line_of_sight?: DD2VTTPoint[][];  // Additional vision-blocking lines from objects
  portals: DD2VTTPortal[];
  environment: DD2VTTEnvironment;
  lights: DD2VTTLight[];
  image: string;                            // Base64-encoded PNG
}
