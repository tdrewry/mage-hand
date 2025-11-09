import { WatabouJSON } from './dungeonTypes';
import { CanvasRegion } from '@/stores/regionStore';
import { DoorConnection, Annotation, TerrainFeature } from './dungeonTypes';

// Grid size for conversion (pixels per Watabou grid unit)
const GRID_SIZE = 50;

/**
 * Generate circular path points for rotunda rooms
 */
function generateCirclePath(
  centerX: number,
  centerY: number,
  radius: number,
  segments: number = 32
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  }
  
  return points;
}

/**
 * Convert Watabou rect to CanvasRegion
 */
function convertRect(rect: WatabouJSON['rects'][0]): Omit<CanvasRegion, 'id'> {
  const x = rect.x * GRID_SIZE;
  const y = rect.y * GRID_SIZE;
  const width = rect.w * GRID_SIZE;
  const height = rect.h * GRID_SIZE;
  
  if (rect.rotunda) {
    // Create circular region for rotunda
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 2;
    
    return {
      x,
      y,
      width,
      height,
      selected: false,
      color: rect.ending ? 'hsl(0, 70%, 50%)' : 'hsl(210, 20%, 50%)',
      gridType: 'square',
      gridSize: GRID_SIZE,
      gridScale: 1,
      gridSnapping: true,
      gridVisible: true,
      regionType: 'path',
      pathPoints: generateCirclePath(centerX, centerY, radius),
      smoothing: false, // Keep circles precise
    };
  }
  
  // Regular rectangular region
  return {
    x,
    y,
    width,
    height,
    selected: false,
    color: rect.ending ? 'hsl(0, 70%, 50%)' : 'hsl(210, 20%, 50%)',
    gridType: 'square',
    gridSize: GRID_SIZE,
    gridScale: 1,
    gridSnapping: true,
    gridVisible: true,
    regionType: 'rectangle',
  };
}

/**
 * Convert Watabou door to DoorConnection
 */
function convertDoor(door: WatabouJSON['doors'][0]): Omit<DoorConnection, 'id'> {
  return {
    position: {
      x: door.x * GRID_SIZE,
      y: door.y * GRID_SIZE,
    },
    direction: door.dir,
    type: door.type,
  };
}

/**
 * Convert Watabou note to Annotation
 */
function convertNote(note: WatabouJSON['notes'][0]): Omit<Annotation, 'id'> {
  return {
    text: note.text,
    reference: note.ref,
    position: {
      x: note.pos.x * GRID_SIZE,
      y: note.pos.y * GRID_SIZE,
    },
  };
}

/**
 * Convert Watabou water tiles to TerrainFeature
 */
function convertWater(waterTiles: { x: number; y: number }[]): Omit<TerrainFeature, 'id'> {
  return {
    type: 'water',
    tiles: waterTiles.map((tile) => ({
      x: tile.x * GRID_SIZE,
      y: tile.y * GRID_SIZE,
    })),
  };
}

/**
 * Convert Watabou columns to TerrainFeature
 */
function convertColumns(columnTiles: { x: number; y: number }[]): Omit<TerrainFeature, 'id'> {
  return {
    type: 'column',
    tiles: columnTiles.map((tile) => ({
      x: tile.x * GRID_SIZE,
      y: tile.y * GRID_SIZE,
    })),
  };
}

export interface ImportedDungeon {
  regions: Omit<CanvasRegion, 'id'>[];
  doors: Omit<DoorConnection, 'id'>[];
  annotations: Omit<Annotation, 'id'>[];
  terrainFeatures: Omit<TerrainFeature, 'id'>[];
  metadata: {
    title?: string;
    story?: string;
    version: string;
  };
}

/**
 * Import a Watabou dungeon JSON and convert to our format
 */
export function importWatabouDungeon(json: WatabouJSON): ImportedDungeon {
  const regions = json.rects.map(convertRect);
  const doors = json.doors.map(convertDoor);
  const annotations = json.notes.map(convertNote);
  
  const terrainFeatures: Omit<TerrainFeature, 'id'>[] = [];
  
  if (json.water && json.water.length > 0) {
    terrainFeatures.push(convertWater(json.water));
  }
  
  if (json.columns && json.columns.length > 0) {
    terrainFeatures.push(convertColumns(json.columns));
  }
  
  return {
    regions,
    doors,
    annotations,
    terrainFeatures,
    metadata: {
      title: json.title,
      story: json.story,
      version: json.version,
    },
  };
}

/**
 * Parse Watabou JSON from file
 */
export async function parseWatabouFile(file: File): Promise<WatabouJSON> {
  const text = await file.text();
  const json = JSON.parse(text);
  
  // Basic validation
  if (!json.rects || !Array.isArray(json.rects)) {
    throw new Error('Invalid Watabou JSON: missing rects array');
  }
  
  if (!json.doors || !Array.isArray(json.doors)) {
    throw new Error('Invalid Watabou JSON: missing doors array');
  }
  
  return json as WatabouJSON;
}
