/**
 * Movement Collision Detection System
 * 
 * Provides collision detection for token movement against MapObjects and region boundaries.
 * Tokens are prevented from passing through movement-blocking objects (columns, closed doors)
 * and optionally constrained to stay within region boundaries.
 */

import { MapObject } from '@/types/mapObjectTypes';
import { CanvasRegion } from '@/stores/regionStore';

interface Point {
  x: number;
  y: number;
}

interface LineSegment {
  start: Point;
  end: Point;
}

interface CollisionResult {
  blocked: boolean;
  validPosition: Point;
  collidedWith?: string; // ID of blocking object
}

/**
 * Main collision check function.
 * Checks if movement from startPos to endPos collides with any blocking objects or exits region bounds.
 */
export function checkMovementCollision(
  startPos: Point,
  endPos: Point,
  tokenRadius: number,
  blockingObjects: MapObject[],
  regions: CanvasRegion[],
  options: {
    enforceRegionBounds: boolean;
    enforceMovementBlocking: boolean;
  }
): CollisionResult {
  // If no enforcement, allow free movement
  if (!options.enforceMovementBlocking && !options.enforceRegionBounds) {
    return { blocked: false, validPosition: endPos };
  }

  // Start with the desired end position
  let validPosition = { ...endPos };
  let blocked = false;
  let collidedWith: string | undefined;

  // Check MapObject collisions if enabled
  if (options.enforceMovementBlocking && blockingObjects.length > 0) {
    const objectResult = checkObjectCollisions(startPos, endPos, tokenRadius, blockingObjects);
    if (objectResult.blocked) {
      blocked = true;
      validPosition = objectResult.validPosition;
      collidedWith = objectResult.collidedWith;
    }
  }

  // Check region bounds if enabled - ONE-WAY enforcement:
  // - Tokens INSIDE a region cannot leave (blocked)
  // - Tokens OUTSIDE regions can enter freely (useful for DM bringing monsters into play)
  if (options.enforceRegionBounds && regions.length > 0) {
    const regionResult = checkRegionBoundsOneWay(startPos, validPosition, tokenRadius, regions);
    if (regionResult.blocked) {
      blocked = true;
      validPosition = regionResult.validPosition;
      // Set a marker indicating this was a region bounds violation
      if (!collidedWith) {
        collidedWith = 'region_bounds';
      }
    }
  }

  return { blocked, validPosition, collidedWith };
}

/**
 * Check collisions against all blocking MapObjects.
 * Returns the furthest valid position along the movement path.
 */
function checkObjectCollisions(
  startPos: Point,
  endPos: Point,
  tokenRadius: number,
  blockingObjects: MapObject[]
): { blocked: boolean; validPosition: Point; collidedWith?: string } {
  let closestT = 1.0; // Parametric position along movement line (0 = start, 1 = end)
  let collidedWith: string | undefined;

  for (const obj of blockingObjects) {
    let result: { intersects: boolean; t?: number };

    if (obj.shape === 'circle') {
      // Circle collision (columns)
      const objRadius = Math.max(obj.width, obj.height) / 2;
      result = lineIntersectsCircle(
        startPos,
        endPos,
        obj.position,
        objRadius + tokenRadius
      );
    } else {
      // Rectangle collision (doors, furniture, stairs)
      result = lineIntersectsRectangle(
        startPos,
        endPos,
        {
          x: obj.position.x,
          y: obj.position.y,
          width: obj.width,
          height: obj.height,
          rotation: obj.rotation || 0,
        },
        tokenRadius
      );
    }

    if (result.intersects && result.t !== undefined && result.t < closestT) {
      closestT = result.t;
      collidedWith = obj.id;
    }
  }

  if (closestT < 1.0) {
    // Apply a small buffer to prevent tokens from touching the edge
    const safeT = Math.max(0, closestT - 0.02);
    const validPosition = {
      x: startPos.x + (endPos.x - startPos.x) * safeT,
      y: startPos.y + (endPos.y - startPos.y) * safeT,
    };
    return { blocked: true, validPosition, collidedWith };
  }

  return { blocked: false, validPosition: endPos };
}

/**
 * Check if movement line intersects a circle (for columns).
 * Uses point-to-segment distance with combined radius.
 */
export function lineIntersectsCircle(
  lineStart: Point,
  lineEnd: Point,
  circleCenter: Point,
  combinedRadius: number
): { intersects: boolean; t?: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const fx = lineStart.x - circleCenter.x;
  const fy = lineStart.y - circleCenter.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - combinedRadius * combinedRadius;

  // No movement
  if (a < 0.0001) {
    return { intersects: c < 0, t: 0 };
  }

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return { intersects: false };
  }

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  // Find the first intersection point along the path (t in [0, 1])
  if (t1 >= 0 && t1 <= 1) {
    return { intersects: true, t: t1 };
  }
  if (t2 >= 0 && t2 <= 1) {
    return { intersects: true, t: t2 };
  }
  // Check if we're inside the circle at start (t1 < 0 && t2 > 0)
  if (t1 < 0 && t2 > 0) {
    return { intersects: true, t: 0 };
  }

  return { intersects: false };
}

/**
 * Check if movement line intersects a (potentially rotated) rectangle.
 * Expands the rectangle by tokenRadius for collision detection.
 */
export function lineIntersectsRectangle(
  lineStart: Point,
  lineEnd: Point,
  rect: { x: number; y: number; width: number; height: number; rotation?: number },
  tokenRadius: number
): { intersects: boolean; t?: number } {
  const rotation = rect.rotation || 0;
  const rad = -rotation * (Math.PI / 180); // Negative for inverse transform

  // Transform line points to rectangle's local coordinate system
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localStart = {
    x: (lineStart.x - rect.x) * cos - (lineStart.y - rect.y) * sin,
    y: (lineStart.x - rect.x) * sin + (lineStart.y - rect.y) * cos,
  };

  const localEnd = {
    x: (lineEnd.x - rect.x) * cos - (lineEnd.y - rect.y) * sin,
    y: (lineEnd.x - rect.x) * sin + (lineEnd.y - rect.y) * cos,
  };

  // Expanded rectangle bounds (centered at origin in local space)
  const halfW = rect.width / 2 + tokenRadius;
  const halfH = rect.height / 2 + tokenRadius;

  // Check line-AABB intersection using Liang-Barsky algorithm
  const dx = localEnd.x - localStart.x;
  const dy = localEnd.y - localStart.y;

  const p = [-dx, dx, -dy, dy];
  const q = [
    localStart.x + halfW,
    halfW - localStart.x,
    localStart.y + halfH,
    halfH - localStart.y,
  ];

  let tEnter = 0;
  let tLeave = 1;

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 0.0001) {
      // Line is parallel to this edge
      if (q[i] < 0) {
        return { intersects: false }; // Line is outside
      }
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        tEnter = Math.max(tEnter, t);
      } else {
        tLeave = Math.min(tLeave, t);
      }
    }
  }

  if (tEnter <= tLeave && tEnter <= 1 && tLeave >= 0) {
    const intersectT = Math.max(0, tEnter);
    return { intersects: true, t: intersectT };
  }

  return { intersects: false };
}

/**
 * ONE-WAY region bounds check:
 * - If token STARTS inside a region and ENDS outside, BLOCK the move
 * - If token STARTS outside regions, ALLOW movement (can enter regions freely)
 * 
 * This enables DMs to bring monsters into play from outside regions.
 */
function checkRegionBoundsOneWay(
  startPos: Point,
  endPos: Point,
  tokenRadius: number,
  regions: CanvasRegion[]
): { blocked: boolean; validPosition: Point } {
  // First, check if the token started inside ANY region
  let startedInsideRegion: CanvasRegion | null = null;
  
  for (const region of regions) {
    if (isPointInRegion(startPos, region, tokenRadius)) {
      startedInsideRegion = region;
      break;
    }
  }
  
  // If token started OUTSIDE all regions, allow free movement (can enter regions)
  if (!startedInsideRegion) {
    return { blocked: false, validPosition: endPos };
  }
  
  // Token started INSIDE a region - check if it's still inside ANY region
  for (const region of regions) {
    if (isPointInRegion(endPos, region, tokenRadius)) {
      // Still inside a region (same or different), allow movement
      return { blocked: false, validPosition: endPos };
    }
  }
  
  // Token started inside but ended outside all regions - BLOCK
  return { blocked: true, validPosition: startPos };
}

/**
 * Legacy: Constrain a position to stay within any region.
 * For path-based regions, uses point-in-polygon test.
 * @deprecated Use checkRegionBoundsOneWay for one-way enforcement
 */
function constrainToRegions(
  position: Point,
  tokenRadius: number,
  regions: CanvasRegion[]
): { constrained: boolean; position: Point } {
  // Check if position is inside any region
  for (const region of regions) {
    if (isPointInRegion(position, region, tokenRadius)) {
      return { constrained: false, position };
    }
  }

  // Position is outside all regions - find nearest valid position
  let nearestPosition = position;
  let nearestDistance = Infinity;

  for (const region of regions) {
    const nearest = findNearestPointInRegion(position, region, tokenRadius);
    const dist = distance(position, nearest);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestPosition = nearest;
    }
  }

  return { constrained: true, position: nearestPosition };
}

/**
 * Check if a point is inside a region (with token radius buffer).
 */
function isPointInRegion(point: Point, region: CanvasRegion, tokenRadius: number): boolean {
  // Small epsilon tolerance to prevent floating-point edge-case failures when a token
  // is snapped to the exact boundary of a region (e.g. grid snapping to x=0 on a
  // region that also starts at x=0). Without this, a token that appears visually
  // "inside" the region can return false and trigger spurious collision blocks.
  const EPSILON = 2;

  if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 3) {
    // Path-based region: use point-in-polygon with inset for token radius
    return isPointInPolygon(point, region.pathPoints, tokenRadius);
  } else {
    // Rectangle region
    const rotation = region.rotation || 0;
    const rad = -rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Transform point to region's local coordinate system
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    const localX = (point.x - centerX) * cos - (point.y - centerY) * sin;
    const localY = (point.x - centerX) * sin + (point.y - centerY) * cos;

    // Check if inside with buffer (plus epsilon to handle grid-snapped edge positions)
    const halfW = region.width / 2 - tokenRadius + EPSILON;
    const halfH = region.height / 2 - tokenRadius + EPSILON;

    return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH;
  }
}

/**
 * Point-in-polygon test using ray casting algorithm.
 */
function isPointInPolygon(point: Point, polygon: Point[], inset: number = 0): boolean {
  // Simple ray casting - doesn't account for inset perfectly but works for most cases
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  // If inside, check distance to edges for inset
  if (inside && inset > 0) {
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const dist = pointToSegmentDistance(
        point,
        polygon[j],
        polygon[i]
      );
      if (dist < inset) {
        return false; // Too close to edge
      }
    }
  }

  return inside;
}

/**
 * Find the nearest point inside a region from an outside point.
 */
function findNearestPointInRegion(point: Point, region: CanvasRegion, tokenRadius: number): Point {
  if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 3) {
    // For path regions, find closest point on polygon edges, then move inside
    return findNearestPointOnPolygonEdge(point, region.pathPoints, tokenRadius);
  } else {
    // For rectangle regions, clamp to bounds
    const rotation = region.rotation || 0;
    const rad = -rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    
    // Transform to local
    const localX = (point.x - centerX) * cos - (point.y - centerY) * sin;
    const localY = (point.x - centerX) * sin + (point.y - centerY) * cos;

    // Clamp
    const halfW = region.width / 2 - tokenRadius;
    const halfH = region.height / 2 - tokenRadius;
    const clampedX = Math.max(-halfW, Math.min(halfW, localX));
    const clampedY = Math.max(-halfH, Math.min(halfH, localY));

    // Transform back
    const invRad = rotation * (Math.PI / 180);
    const invCos = Math.cos(invRad);
    const invSin = Math.sin(invRad);

    return {
      x: clampedX * invCos - clampedY * invSin + centerX,
      y: clampedX * invSin + clampedY * invCos + centerY,
    };
  }
}

/**
 * Find the nearest point on a polygon's edge.
 */
function findNearestPointOnPolygonEdge(point: Point, polygon: Point[], inset: number): Point {
  let nearestPoint = polygon[0];
  let nearestDistance = Infinity;

  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const segmentPoint = closestPointOnSegment(point, polygon[j], polygon[i]);
    const dist = distance(point, segmentPoint);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestPoint = segmentPoint;
    }
  }

  // Move the point inward by the inset amount
  const center = polygonCentroid(polygon);
  const toCenter = {
    x: center.x - nearestPoint.x,
    y: center.y - nearestPoint.y,
  };
  const toCenterDist = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
  
  if (toCenterDist > 0.001) {
    return {
      x: nearestPoint.x + (toCenter.x / toCenterDist) * inset,
      y: nearestPoint.y + (toCenter.y / toCenterDist) * inset,
    };
  }

  return nearestPoint;
}

/**
 * Find the closest point on a line segment to a given point.
 */
function closestPointOnSegment(point: Point, segStart: Point, segEnd: Point): Point {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < 0.0001) {
    return segStart;
  }

  const t = Math.max(0, Math.min(1, 
    ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq
  ));

  return {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };
}

/**
 * Calculate distance from a point to a line segment.
 */
function pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): number {
  const closest = closestPointOnSegment(point, segStart, segEnd);
  return distance(point, closest);
}

/**
 * Calculate centroid of a polygon.
 */
function polygonCentroid(polygon: Point[]): Point {
  let x = 0, y = 0;
  for (const p of polygon) {
    x += p.x;
    y += p.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

/**
 * Calculate Euclidean distance between two points.
 */
function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get movement-blocking MapObjects from a list.
 * Filters to only objects that have blocksMovement = true.
 * For doors, also checks if they are closed.
 */
export function getBlockingObjects(mapObjects: MapObject[]): MapObject[] {
  return mapObjects.filter(obj => {
    // Explicitly blocked
    if (obj.blocksMovement) return true;
    
    // Doors: block when closed, allow when open
    if (obj.category === 'door') {
      return !obj.isOpen;
    }
    
    return false;
  });
}
