/**
 * MapObject type definitions for interactive static map features
 * (columns, statues, furniture, doors, etc.)
 */

export type MapObjectShape = 'circle' | 'rectangle' | 'custom' | 'door' | 'stairs' | 'wall' | 'light' | 'annotation';

export interface MapObject {
  id: string;
  
  // Position and dimensions
  position: { x: number; y: number };
  width: number;
  height: number;
  rotation?: number; // Degrees
  
  // Visual
  shape: MapObjectShape;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  
  // Custom path for complex shapes
  customPath?: { x: number; y: number }[];
  
  // Texture/image support
  imageUrl?: string;
  imageHash?: string; // For texture sync
  
  // Behavior flags
  castsShadow: boolean; // Like negative regions
  blocksMovement: boolean;
  blocksVision: boolean;
  revealedByLight: boolean; // Interior revealed when lit (like tokens)
  
  // Door-specific properties
  isOpen?: boolean; // For doors: true = open (doesn't block light), false = closed (blocks light)
  doorType?: number; // Watabou door type (0-9)
  doorDirection?: { x: number; y: number }; // Direction the door faces
  
  // Selection state
  selected: boolean;
  
  // Metadata
  label?: string;
  category: MapObjectCategory;
  
  // Wall-specific properties (polyline shape)
  wallPoints?: { x: number; y: number }[]; // Points defining the wall polyline
  
  // Light-specific properties (embedded light data)
  lightColor?: string; // Hex color for the light
  lightRadius?: number; // Maximum visibility distance in pixels (dim zone outer edge)
  lightBrightRadius?: number; // Bright zone radius in pixels (defaults to lightRadius * 0.5)
  lightIntensity?: number; // 0-1, affects brightness
  lightEnabled?: boolean; // Whether the light is currently active
  
  // Lock state
  locked?: boolean; // Prevents all transformations when true
  
  // For linking to imported terrain features
  terrainFeatureId?: string;

  // Annotation-specific properties (category: 'annotation')
  annotationText?: string;     // Full descriptive text shown in popup
  annotationReference?: string; // Short label drawn on the circle badge (e.g. "1", "A")
}

export type MapObjectCategory = 
  | 'column'
  | 'statue'
  | 'furniture'
  | 'debris'
  | 'trap'
  | 'water'
  | 'annotation'
  | 'decoration'
  | 'obstacle'
  | 'door'
  | 'stairs'
  | 'wall'
  | 'imported-obstacle'
  | 'light'
  | 'custom';

export const MAP_OBJECT_CATEGORY_LABELS: Record<MapObjectCategory, string> = {
  column: 'Column',
  statue: 'Statue',
  furniture: 'Furniture',
  debris: 'Debris',
  trap: 'Trap',
  water: 'Water',
  annotation: 'Annotation Marker',
  decoration: 'Decoration',
  obstacle: 'Obstacle',
  door: 'Door',
  stairs: 'Stairs',
  wall: 'Wall',
  'imported-obstacle': 'Imported Obstacle',
  light: 'Light Source',
  custom: 'Custom',
};

export const MAP_OBJECT_PRESETS: Record<MapObjectCategory, Partial<MapObject>> = {
  column: {
    shape: 'circle',
    width: 16,
    height: 16,
    fillColor: '#71717a',
    strokeColor: '#52525b',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false, // Columns don't cast visual shadows (matches original terrain rendering)
    blocksMovement: true,
    blocksVision: true,
    revealedByLight: true,
  },
  statue: {
    shape: 'circle',
    width: 24,
    height: 24,
    fillColor: '#a1a1aa',
    strokeColor: '#71717a',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: true,
    blocksMovement: true,
    blocksVision: false,
    revealedByLight: true,
  },
  furniture: {
    shape: 'rectangle',
    width: 40,
    height: 30,
    fillColor: '#a16207',
    strokeColor: '#713f12',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: true,
    blocksMovement: true,
    blocksVision: false,
    revealedByLight: true,
  },
  debris: {
    shape: 'custom',
    width: 30,
    height: 30,
    fillColor: '#78716c',
    strokeColor: '#57534e',
    strokeWidth: 1,
    opacity: 0.8,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: true,
  },
  trap: {
    shape: 'custom',
    width: 50,
    height: 50,
    fillColor: 'rgba(220, 38, 38, 0.2)',
    strokeColor: '#dc2626',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: true,
  },
  water: {
    shape: 'custom',
    width: 100,
    height: 100,
    fillColor: 'rgba(59, 130, 246, 0.35)',
    strokeColor: 'rgba(96, 165, 250, 0.6)',
    strokeWidth: 1,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: false,
  },
  decoration: {
    shape: 'circle',
    width: 20,
    height: 20,
    fillColor: '#0ea5e9',
    strokeColor: '#0284c7',
    strokeWidth: 1,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: true,
  },
  obstacle: {
    shape: 'rectangle',
    width: 40,
    height: 40,
    fillColor: '#525252',
    strokeColor: '#404040',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: true,
    blocksMovement: true,
    blocksVision: true,
    revealedByLight: true,
  },
  door: {
    shape: 'door',
    width: 50, // Width of doorway
    height: 8, // Thickness of door
    fillColor: '#8b4513', // Saddle brown for wood
    strokeColor: '#5d2e0c',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false, // Doors don't block movement by default
    blocksVision: true, // Closed doors block vision
    revealedByLight: true,
    isOpen: false,
  },
  stairs: {
    shape: 'stairs',
    width: 50, // One grid cell wide
    height: 100, // Two grid cells long
    fillColor: 'transparent',
    strokeColor: '#2C241D', // Ink color
    strokeWidth: 1.5,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: true,
  },
  custom: {
    shape: 'rectangle',
    width: 30,
    height: 30,
    fillColor: '#6b7280',
    strokeColor: '#4b5563',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: true,
  },
  wall: {
    shape: 'wall',
    width: 0,
    height: 0,
    fillColor: 'transparent',
    strokeColor: '#ef4444',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false,
    blocksMovement: true,
    blocksVision: true,
    revealedByLight: false,
  },
  'imported-obstacle': {
    shape: 'wall',
    width: 0,
    height: 0,
    fillColor: 'transparent',
    strokeColor: '#f97316',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: true,
    revealedByLight: false,
  },
  light: {
    shape: 'light',
    width: 20,
    height: 20,
    fillColor: '#fbbf24',
    strokeColor: '#f59e0b',
    strokeWidth: 1,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: false,
  },
  annotation: {
    shape: 'annotation',
    width: 24,
    height: 24,
    fillColor: '#3b82f6',
    strokeColor: '#ffffff',
    strokeWidth: 2,
    opacity: 1,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: false,
  },
};

// Door type visual styles (from Watabou)
export const DOOR_TYPE_STYLES: Record<number, { fillColor: string; strokeColor: string; label: string }> = {
  0: { fillColor: '#8b4513', strokeColor: '#5d2e0c', label: 'Normal' },
  1: { fillColor: '#a0522d', strokeColor: '#6b3810', label: 'Double' },
  2: { fillColor: '#4a5568', strokeColor: '#2d3748', label: 'Secret' },
  3: { fillColor: '#718096', strokeColor: '#4a5568', label: 'Portcullis' },
  4: { fillColor: '#8b4513', strokeColor: '#c9a227', label: 'Locked' }, // Gold stroke for locked
  5: { fillColor: '#991b1b', strokeColor: '#7f1d1d', label: 'Trapped' },
  6: { fillColor: '#78716c', strokeColor: '#57534e', label: 'Archway' },
  7: { fillColor: '#6b7280', strokeColor: '#4b5563', label: 'Bars' },
  8: { fillColor: '#7c3aed', strokeColor: '#5b21b6', label: 'Curtain' },
  9: { fillColor: '#374151', strokeColor: '#1f2937', label: 'Hidden' },
};
