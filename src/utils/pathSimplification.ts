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

/**
 * Convert a path to smooth curves using Catmull-Rom spline interpolation
 * @param points - Array of points to convert to curves
 * @param tension - Curve tension (0 = tight, 0.5 = normal, 1 = loose)
 * @param segmentsPerCurve - Number of interpolated points per curve segment
 * @returns Array of interpolated curve points
 */
export function pathToCurve(points: Point[], tension: number = 0.5, segmentsPerCurve: number = 10): Point[] {
  if (points.length < 3) return points;
  
  const curvePoints: Point[] = [];
  
  // Add first point
  curvePoints.push(points[0]);
  
  // For each segment between control points
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
    
    // Generate interpolated points for this curve segment
    for (let t = 0; t < segmentsPerCurve; t++) {
      const tNorm = t / segmentsPerCurve;
      const point = catmullRomPoint(p0, p1, p2, p3, tNorm, tension);
      curvePoints.push(point);
    }
  }
  
  // Add last point
  curvePoints.push(points[points.length - 1]);
  
  return curvePoints;
}

/**
 * Calculate a point on a Catmull-Rom spline curve
 */
function catmullRomPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number, tension: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  
  // Catmull-Rom basis functions
  const v0 = (2 * p1.x);
  const v1 = (-p0.x + p2.x) * tension;
  const v2 = (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tension;
  const v3 = (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tension;
  
  const x = 0.5 * (v0 + v1 * t + v2 * t2 + v3 * t3);
  
  const w0 = (2 * p1.y);
  const w1 = (-p0.y + p2.y) * tension;
  const w2 = (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tension;
  const w3 = (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tension;
  
  const y = 0.5 * (w0 + w1 * t + w2 * t2 + w3 * t3);
  
  return { x, y };
}
