// Utility functions for path-based regions

export interface Point {
  x: number;
  y: number;
}

/**
 * Compute an inset path by moving each point toward the centroid.
 * Creates concentric ripple lines that follow the boundary shape.
 * Used for water shore-ripple rendering.
 */
export function computeInsetPath(
  boundary: Point[],
  insetDistance: number
): Point[] {
  if (boundary.length < 3) return [];

  // Calculate centroid
  const centroid: Point = {
    x: boundary.reduce((sum, p) => sum + p.x, 0) / boundary.length,
    y: boundary.reduce((sum, p) => sum + p.y, 0) / boundary.length,
  };

  const insetPath: Point[] = [];
  for (const point of boundary) {
    const dx = centroid.x - point.x;
    const dy = centroid.y - point.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= insetDistance) continue; // Would collapse past centroid
    const ratio = insetDistance / dist;
    insetPath.push({ x: point.x + dx * ratio, y: point.y + dy * ratio });
  }

  return insetPath;
}

/**
 * Check if a point is inside a polygon using the ray casting algorithm.
 * @param point The point to check.
 * @param polygon An array of points defining the polygon vertices.
 * @returns True if the point is inside the polygon, false otherwise.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  const { x, y } = point;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Calculates the bounding box of a polygon.
 * @param points An array of points defining the polygon vertices.
 * @returns An object representing the bounding box {x, y, width, height}.
 */
export function getPolygonBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  
  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    maxX = Math.max(maxX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxY = Math.max(maxY, points[i].y);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculates the shortest distance from a point to a line segment.
 * @param point The point to check.
 * @param lineStart The start point of the line segment.
 * @param lineEnd The end point of the line segment.
 * @returns The shortest distance from the point to the line segment.
 */
export function distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    return Math.sqrt(A * A + B * B);
  }
  
  let param = dot / lenSq;
  
  let xx: number, yy: number;
  
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if a point is within a certain tolerance of any edge of a polygon.
 * @param point The point to check.
 * @param polygon An array of points defining the polygon vertices.
 * @param tolerance The distance tolerance for being considered "near" an edge.
 * @returns True if the point is near an edge, false otherwise.
 */
export function isPointNearPolygonEdge(point: Point, polygon: Point[], tolerance: number = 5): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const distance = distanceToLineSegment(point, polygon[i], polygon[j]);
    if (distance <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the index of the nearest vertex to a given point within a tolerance.
 * @param point The point to check from.
 * @param polygon An array of points defining the polygon vertices.
 * @param tolerance The distance tolerance for being considered a match.
 * @returns The index of the nearest vertex, or null if no vertex is within tolerance.
 */
export function findNearestVertex(point: Point, polygon: Point[], tolerance: number = 8): number | null {
  let nearestIndex = -1;
  let nearestDistance = Infinity;
  
  for (let i = 0; i < polygon.length; i++) {
    const dx = point.x - polygon[i].x;
    const dy = point.y - polygon[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < tolerance && distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  
  return nearestIndex >= 0 ? nearestIndex : null;
}