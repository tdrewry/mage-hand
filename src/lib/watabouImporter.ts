import { WatabouJSON } from './dungeonTypes';
import { CanvasRegion } from '@/stores/regionStore';
import { DoorConnection, Annotation } from './dungeonTypes';
import { groupConnectedTiles, generateSimpleContour } from '@/utils/marchingSquares';
import { simplifyPath, smoothPath } from '@/utils/pathSimplification';

// Grid size for conversion (pixels per Watabou grid unit)
const GRID_SIZE = 50;

// Tolerance for detecting adjacency (in grid units)
const CONNECTION_TOLERANCE = 2;

interface ConnectionInfo {
  connectedIndices: number[];
  isRotunda: boolean;
}

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
 * Detect which rects are connected based on door positions
 */
function detectRegionConnections(rects: WatabouJSON['rects'], doors: WatabouJSON['doors']): Map<number, ConnectionInfo> {
  const connections = new Map<number, ConnectionInfo>();
  
  // Initialize connection info for each rect
  rects.forEach((rect, index) => {
    connections.set(index, {
      connectedIndices: [],
      isRotunda: rect.rotunda || false,
    });
  });
  
  // For each door, find which rects it connects
  doors.forEach(door => {
    const connectedRects: number[] = [];
    
    rects.forEach((rect, index) => {
      // Check if door is adjacent to this rect's boundaries
      const rectLeft = rect.x;
      const rectRight = rect.x + rect.w;
      const rectTop = rect.y;
      const rectBottom = rect.y + rect.h;
      
      const isAdjacent = (
        (Math.abs(door.x - rectLeft) < CONNECTION_TOLERANCE || 
         Math.abs(door.x - rectRight) < CONNECTION_TOLERANCE) &&
        door.y >= rectTop - CONNECTION_TOLERANCE && 
        door.y <= rectBottom + CONNECTION_TOLERANCE
      ) || (
        (Math.abs(door.y - rectTop) < CONNECTION_TOLERANCE || 
         Math.abs(door.y - rectBottom) < CONNECTION_TOLERANCE) &&
        door.x >= rectLeft - CONNECTION_TOLERANCE && 
        door.x <= rectRight + CONNECTION_TOLERANCE
      );
      
      if (isAdjacent) {
        connectedRects.push(index);
      }
    });
    
    // Create bidirectional connections
    for (let i = 0; i < connectedRects.length; i++) {
      for (let j = i + 1; j < connectedRects.length; j++) {
        const info1 = connections.get(connectedRects[i])!;
        const info2 = connections.get(connectedRects[j])!;
        
        if (!info1.connectedIndices.includes(connectedRects[j])) {
          info1.connectedIndices.push(connectedRects[j]);
        }
        if (!info2.connectedIndices.includes(connectedRects[i])) {
          info2.connectedIndices.push(connectedRects[i]);
        }
      }
    }
  });
  
  return connections;
}

/**
 * Convert Watabou rect to CanvasRegion
 */
function convertRect(
  rect: WatabouJSON['rects'][0], 
  rectIndex: number,
  allRects: WatabouJSON['rects'],
  connections: Map<number, ConnectionInfo>
): Omit<CanvasRegion, 'id'> {
  let x = rect.x * GRID_SIZE;
  let y = rect.y * GRID_SIZE;
  let width = rect.w * GRID_SIZE;
  let height = rect.h * GRID_SIZE;
  
  // Check if this rect connects to any rotundas and extend if needed
  if (!rect.rotunda) {
    const myConnections = connections.get(rectIndex);
    if (myConnections) {
      for (const connectedIndex of myConnections.connectedIndices) {
        const connectedRect = allRects[connectedIndex];
        if (connectedRect.rotunda) {
          // Calculate rotunda center and radius
          const rotundaX = connectedRect.x * GRID_SIZE;
          const rotundaY = connectedRect.y * GRID_SIZE;
          const rotundaWidth = connectedRect.w * GRID_SIZE;
          const rotundaHeight = connectedRect.h * GRID_SIZE;
          const rotundaCenterX = rotundaX + rotundaWidth / 2;
          const rotundaCenterY = rotundaY + rotundaHeight / 2;
          const rotundaRadius = Math.min(rotundaWidth, rotundaHeight) / 2;
          
          // Determine which edge to extend
          const rectCenterX = x + width / 2;
          const rectCenterY = y + height / 2;
          
          // Extend toward rotunda by overlapping with radius
          const extendAmount = rotundaRadius * 0.3; // 30% overlap
          
          if (Math.abs(rectCenterY - rotundaCenterY) < height / 2) {
            // Horizontal connection
            if (rectCenterX < rotundaCenterX) {
              // Extend right edge
              width += extendAmount;
            } else {
              // Extend left edge
              x -= extendAmount;
              width += extendAmount;
            }
          } else {
            // Vertical connection
            if (rectCenterY < rotundaCenterY) {
              // Extend bottom edge
              height += extendAmount;
            } else {
              // Extend top edge
              y -= extendAmount;
              height += extendAmount;
            }
          }
        }
      }
    }
  }
  
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
 * 
 * Door positions in Watabou are at cell corners. We need to offset them
 * by half a grid cell in the direction perpendicular to the door facing
 * so they appear centered on the wall between cells.
 */
function convertDoor(door: WatabouJSON['doors'][0]): Omit<DoorConnection, 'id'> {
  // Base position at grid corner
  let x = door.x * GRID_SIZE;
  let y = door.y * GRID_SIZE;
  
  // Offset to center of cell edge based on door direction
  // Door direction points toward the room the door opens into
  // We need to shift perpendicular to the door facing
  if (Math.abs(door.dir.x) > Math.abs(door.dir.y)) {
    // Door faces horizontally (left/right) - shift vertically to center
    y += GRID_SIZE / 2;
  } else {
    // Door faces vertically (up/down) - shift horizontally to center
    x += GRID_SIZE / 2;
  }
  
  return {
    position: { x, y },
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
 * Convert Watabou water tiles to water MapObject data (tiles + fluid boundary)
 */
function convertWater(waterTiles: { x: number; y: number }[]): { tiles: { x: number; y: number }[]; fluidBoundary?: { x: number; y: number }[] } {
  const scaledTiles = waterTiles.map((tile) => ({
    x: tile.x * GRID_SIZE,
    y: tile.y * GRID_SIZE,
  }));

  // Generate fluid boundary using marching squares
  let fluidBoundary: { x: number; y: number }[] | undefined;

  if (scaledTiles.length > 0) {
    const groups = groupConnectedTiles(scaledTiles);
    if (groups.length > 0) {
      const largestGroup = groups.reduce((a, b) => a.length > b.length ? a : b);
      let contour = generateSimpleContour(largestGroup, GRID_SIZE);
      if (contour.length > 0) {
        contour = simplifyPath(contour, 3.0);
        contour = smoothPath(contour, 3);
        fluidBoundary = contour;
      }
    }
  }

  return { tiles: scaledTiles, fluidBoundary };
}

/**
 * Convert Watabou columns to tiles array (for MapObject conversion)
 * Note: Columns are now converted to MapObjects, not TerrainFeatures
 */
function convertColumnTiles(columnTiles: { x: number; y: number }[]): { x: number; y: number }[] {
  return columnTiles.map((tile) => ({
    x: tile.x * GRID_SIZE,
    y: tile.y * GRID_SIZE,
  }));
}

export interface ImportedDungeon {
  regions: Omit<CanvasRegion, 'id'>[];
  doors: Omit<DoorConnection, 'id'>[];
  annotations: Omit<Annotation, 'id'>[];
  /** Water body data for convertWaterToMapObject (null if no water) */
  waterMapObjectData: { tiles: { x: number; y: number }[]; fluidBoundary?: { x: number; y: number }[] } | null;
  /** Trap tiles — each becomes an individual MapObject via convertTrapToMapObject */
  trapTiles: { x: number; y: number }[];
  metadata: {
    title?: string;
    story?: string;
    version: string;
  };
}

/**
 * Import a Watabou dungeon JSON and convert to our format
 *
 * Water and traps are now returned as raw MapObject data (waterMapObjectData / trapTiles)
 * so the caller can create first-class MapObjects that participate in groups, undo, rotation, etc.
 * Columns are returned separately as columnTiles for the same reason.
 */
export function importWatabouDungeon(json: WatabouJSON): ImportedDungeon & { columnTiles: { x: number; y: number }[] } {
  // First pass: detect connections
  const connections = detectRegionConnections(json.rects, json.doors);

  // Second pass: convert rects with connection awareness
  const regions = json.rects.map((rect, index) =>
    convertRect(rect, index, json.rects, connections)
  );
  const doors = json.doors.map(convertDoor);
  const annotations = json.notes.map(convertNote);

  // Water → raw data for MapObject conversion by the caller
  const waterMapObjectData = (json.water && json.water.length > 0)
    ? convertWater(json.water)
    : null;

  // Traps → individual tile coords for MapObject conversion by the caller
  // (Watabou JSON doesn't have a dedicated trap array; traps come from TerrainFeature.type === 'trap'
  //  which was previously injected externally. For now we expose an empty array as the hook point.)
  const trapTiles: { x: number; y: number }[] = [];

  // Columns are returned separately for MapObject conversion
  const columnTiles = json.columns && json.columns.length > 0
    ? convertColumnTiles(json.columns)
    : [];

  return {
    regions,
    doors,
    annotations,
    waterMapObjectData,
    trapTiles,
    columnTiles,
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
