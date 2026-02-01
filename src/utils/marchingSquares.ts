/**
 * Marching Squares algorithm for generating contours from tile coordinates
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Group connected tiles into separate regions
 */
/**
 * Groups adjacent tiles into connected components.
 * @param tiles Array of points representing occupied tiles.
 * @returns An array of arrays, where each inner array contains points of a connected component.
 */
export function groupConnectedTiles(tiles: Point[]): Point[][] {
  const groups: Point[][] = [];
  const visited = new Set<string>();
  
  const key = (p: Point) => `${p.x},${p.y}`;
  
  const getNeighbors = (tile: Point): Point[] => {
    const neighbors: Point[] = [];
    const deltas = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    for (const [dx, dy] of deltas) {
      const neighbor = { x: tile.x + dx * 50, y: tile.y + dy * 50 };
      if (tiles.some(t => t.x === neighbor.x && t.y === neighbor.y)) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  };
  
  const bfs = (start: Point): Point[] => {
    const group: Point[] = [];
    const queue = [start];
    visited.add(key(start));
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);
      
      for (const neighbor of getNeighbors(current)) {
        const k = key(neighbor);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push(neighbor);
        }
      }
    }
    
    return group;
  };
  
  for (const tile of tiles) {
    const k = key(tile);
    if (!visited.has(k)) {
      groups.push(bfs(tile));
    }
  }
  
  return groups;
}

/**
 * Generates a contour for a group of tiles using the Marching Squares algorithm.
 * @param tiles Array of points representing tiles in a connected component.
 * @param gridSize The size of each grid cell (default: 50).
 * @returns An array of points defining the contour of the tiles.
 */
export function generateContour(tiles: Point[], gridSize: number = 50): Point[] {
  if (tiles.length === 0) return [];
  
  // Create a grid map for fast lookup
  const tileSet = new Set(tiles.map(t => `${t.x},${t.y}`));
  
  // Find bounds
  const minX = Math.min(...tiles.map(t => t.x));
  const maxX = Math.max(...tiles.map(t => t.x));
  const minY = Math.min(...tiles.map(t => t.y));
  const maxY = Math.max(...tiles.map(t => t.y));
  
  // Start from top-left corner of the top-left tile
  const startX = minX;
  const startY = minY;
  
  // Trace boundary clockwise
  const boundary: Point[] = [];
  let x = startX;
  let y = startY;
  let direction = 0; // 0=right, 1=down, 2=left, 3=up
  
  const hasTile = (tx: number, ty: number) => tileSet.has(`${tx},${ty}`);
  
  // Direction vectors: right, down, left, up
  const dx = [gridSize, 0, -gridSize, 0];
  const dy = [0, gridSize, 0, -gridSize];
  
  // Maximum iterations to prevent infinite loops
  const maxIterations = tiles.length * 8;
  let iterations = 0;
  
  do {
    boundary.push({ x, y });
    
    // Check cells around current corner
    // Determine which edge to follow based on tile presence
    const rightTile = hasTile(x, y);
    const downRightTile = hasTile(x, y + (direction === 1 ? gridSize : 0));
    
    // Determine next direction based on tiles
    if (direction === 0) { // Coming from left
      if (hasTile(x, y)) {
        direction = 3; // Turn up if tile is present
      } else {
        direction = 0; // Continue right
      }
    } else if (direction === 1) { // Coming from up
      if (hasTile(x - gridSize, y)) {
        direction = 0; // Turn right if tile is present
      } else {
        direction = 1; // Continue down
      }
    } else if (direction === 2) { // Coming from right
      if (hasTile(x - gridSize, y - gridSize)) {
        direction = 1; // Turn down if tile is present
      } else {
        direction = 2; // Continue left
      }
    } else { // Coming from down
      if (hasTile(x, y - gridSize)) {
        direction = 2; // Turn left if tile is present
      } else {
        direction = 3; // Continue up
      }
    }
    
    x += dx[direction];
    y += dy[direction];
    
    iterations++;
  } while ((x !== startX || y !== startY) && iterations < maxIterations);
  
  return boundary;
}

/**
 * Generates a simple contour by finding the outline edges of a set of tiles.
 * @param tiles Array of points representing occupied tiles.
 * @param gridSize The size of each grid cell.
 * @returns An array of points defining the simplified contour.
 */
export function generateSimpleContour(tiles: Point[], gridSize: number = 50): Point[] {
  if (tiles.length === 0) return [];
  
  const tileSet = new Set(tiles.map(t => `${t.x},${t.y}`));
  const hasTile = (x: number, y: number) => tileSet.has(`${x},${y}`);
  
  // Collect all edge segments
  const edges: { p1: Point; p2: Point }[] = [];
  
  tiles.forEach(tile => {
    const { x, y } = tile;
    
    // Check each edge of the tile
    if (!hasTile(x, y - gridSize)) {
      edges.push({ p1: { x, y }, p2: { x: x + gridSize, y } }); // Top
    }
    if (!hasTile(x + gridSize, y)) {
      edges.push({ p1: { x: x + gridSize, y }, p2: { x: x + gridSize, y: y + gridSize } }); // Right
    }
    if (!hasTile(x, y + gridSize)) {
      edges.push({ p1: { x: x + gridSize, y: y + gridSize }, p2: { x, y: y + gridSize } }); // Bottom
    }
    if (!hasTile(x - gridSize, y)) {
      edges.push({ p1: { x, y: y + gridSize }, p2: { x, y } }); // Left
    }
  });
  
  if (edges.length === 0) return [];
  
  // Connect edges into a path
  const path: Point[] = [edges[0].p1];
  let current = edges[0].p2;
  const used = new Set([0]);
  
  while (used.size < edges.length) {
    path.push(current);
    
    // Find next connecting edge
    let found = false;
    for (let i = 0; i < edges.length; i++) {
      if (used.has(i)) continue;
      
      if (edges[i].p1.x === current.x && edges[i].p1.y === current.y) {
        current = edges[i].p2;
        used.add(i);
        found = true;
        break;
      }
    }
    
    if (!found) break;
  }
  
  return path;
}
