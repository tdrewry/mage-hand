// Type definitions for dungeon-specific features

export interface DoorConnection {
  id: string;
  position: { x: number; y: number };
  direction: { x: number; y: number };
  type: number; // 0-9 for different door types
  regionIds?: string[]; // Regions connected by this door
}

export interface Annotation {
  id: string;
  text: string;
  reference: string; // "1", "2", etc.
  position: { x: number; y: number };
  regionId?: string; // Optional association with a region
}

export interface LightSource {
  id: string;
  position: { x: number; y: number };
  color: string;
  intensity: number; // 0-1
  radius: number; // in grid units
}

// Watabou JSON format types
export interface WatabouRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotunda?: boolean;
  ending?: boolean;
}

export interface WatabouDoor {
  x: number;
  y: number;
  dir: { x: number; y: number };
  type: number;
}

export interface WatabouNote {
  text: string;
  ref: string;
  pos: { x: number; y: number };
}

export interface WatabouJSON {
  version: string;
  title?: string;
  story?: string;
  rects: WatabouRect[];
  doors: WatabouDoor[];
  notes: WatabouNote[];
  columns: { x: number; y: number }[];
  water: { x: number; y: number }[];
}

// Door type labels for UI
export const DOOR_TYPE_LABELS: Record<number, string> = {
  0: 'Normal',
  1: 'Double',
  2: 'Secret',
  3: 'Portcullis',
  4: 'Locked',
  5: 'Trapped',
  6: 'Archway',
  7: 'Bars',
  8: 'Curtain',
  9: 'Hidden'
};
