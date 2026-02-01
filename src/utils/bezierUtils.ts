/**
 * Utility functions for working with Bezier curves
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierControlPoint {
  cp1: Point;
  cp2: Point;
}

/**
 * Generates smooth Bezier control points for a path.
 * Uses a simplified version of the Hobby algorithm for aesthetically pleasing curves.
 * @param points An array of points defining the path.
 * @returns An array of Bezier control points for each segment.
 */
export function generateBezierControlPoints(points: Point[]): BezierControlPoint[] {
  if (points.length < 2) return [];
  
  const controlPoints: BezierControlPoint[] = [];
  const tension = 0.3; // Controls curve tightness (0 = tight, 1 = loose)
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
    
    // Calculate tangent vectors
    const t1 = {
      x: (p2.x - p0.x) * tension,
      y: (p2.y - p0.y) * tension
    };
    
    const t2 = {
      x: (p3.x - p1.x) * tension,
      y: (p3.y - p1.y) * tension
    };
    
    // Control points are positioned along tangent vectors
    const cp1 = {
      x: p1.x + t1.x / 3,
      y: p1.y + t1.y / 3
    };
    
    const cp2 = {
      x: p2.x - t2.x / 3,
      y: p2.y - t2.y / 3
    };
    
    controlPoints.push({ cp1, cp2 });
  }
  
  return controlPoints;
}

/**
 * Calculate a point on a cubic Bezier curve
 * @param p0 - Start point
 * @param cp1 - First control point
 * @param cp2 - Second control point
 * @param p1 - End point
 * @param t - Parameter from 0 to 1
 */
export function bezierPoint(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y
  };
}

/**
 * Generates an array of interpolated points along a Bezier curve for rendering.
 * @param p0 Start point.
 * @param cp1 First control point.
 * @param cp2 Second control point.
 * @param p1 End point.
 * @param segments Number of segments to use for interpolation.
 * @returns An array of points along the curve.
 */
export function bezierCurvePoints(
  p0: Point, 
  cp1: Point, 
  cp2: Point, 
  p1: Point, 
  segments: number = 20
): Point[] {
  const points: Point[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(bezierPoint(p0, cp1, cp2, p1, t));
  }
  
  return points;
}

/**
 * Calculates the bounding box for a set of points including their Bezier control points.
 * @param points An array of anchor points.
 * @param controlPoints An array of Bezier control points.
 * @returns An object representing the bounding box {x, y, width, height}.
 */
export function getBezierBounds(
  points: Point[], 
  controlPoints: BezierControlPoint[]
): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  
  // Check anchor points
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  
  // Check control points
  controlPoints.forEach(cp => {
    minX = Math.min(minX, cp.cp1.x, cp.cp2.x);
    minY = Math.min(minY, cp.cp1.y, cp.cp2.y);
    maxX = Math.max(maxX, cp.cp1.x, cp.cp2.x);
    maxY = Math.max(maxY, cp.cp1.y, cp.cp2.y);
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
