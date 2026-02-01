/**
 * MapObject type definitions for interactive static map features
 * (columns, statues, furniture, etc.)
 */

export type MapObjectShape = 'circle' | 'rectangle' | 'custom';

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
  
  // Selection state
  selected: boolean;
  
  // Metadata
  label?: string;
  category: MapObjectCategory;
  
  // For linking to imported terrain features
  terrainFeatureId?: string;
}

export type MapObjectCategory = 
  | 'column'
  | 'statue'
  | 'furniture'
  | 'debris'
  | 'trap'
  | 'decoration'
  | 'obstacle'
  | 'custom';

export const MAP_OBJECT_CATEGORY_LABELS: Record<MapObjectCategory, string> = {
  column: 'Column',
  statue: 'Statue',
  furniture: 'Furniture',
  debris: 'Debris',
  trap: 'Trap',
  decoration: 'Decoration',
  obstacle: 'Obstacle',
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
    castsShadow: true,
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
    shape: 'rectangle',
    width: 50,
    height: 50,
    fillColor: '#dc2626',
    strokeColor: '#b91c1c',
    strokeWidth: 2,
    opacity: 0.3,
    castsShadow: false,
    blocksMovement: false,
    blocksVision: false,
    revealedByLight: true,
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
};
