/**
 * Douglas-Peucker algorithm for path simplification
 * Reduces the number of points in a path while maintaining its shape
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  
  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  
  let closestX: number, closestY: number;
  if (u < 0) {
    closestX = lineStart.x;
    closestY = lineStart.y;
  } else if (u > 1) {
    closestX = lineEnd.x;
    closestY = lineEnd.y;
  } else {
    closestX = lineStart.x + u * dx;
    closestY = lineStart.y + u * dy;
  }
  
  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

/**
 * Douglas-Peucker path simplification algorithm
 * @param points - Array of points to simplify
 * @param epsilon - Tolerance threshold (higher = more simplification)
 * @returns Simplified array of points
 */
export function simplifyPath(points: Point[], epsilon: number = 2.0): Point[] {
  if (points.length <= 2) return points;
  
  // Find the point with maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const leftSegment = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const rightSegment = simplifyPath(points.slice(maxIndex), epsilon);
    
    // Combine segments (remove duplicate middle point)
    return [...leftSegment.slice(0, -1), ...rightSegment];
  } else {
    // If max distance is less than epsilon, return just the endpoints
    return [points[0], points[end]];
  }
}

/**
 * Smooth a path by averaging nearby points
 * @param points - Array of points to smooth
 * @param windowSize - Number of nearby points to average (must be odd)
 * @returns Smoothed array of points
 */
export function smoothPath(points: Point[], windowSize: number = 3): Point[] {
  if (points.length <= 2 || windowSize < 3) return points;
  
  const smoothed: Point[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }
    
    smoothed.push({
      x: sumX / count,
      y: sumY / count
    });
  }
  
  return smoothed;
}
