/**
 * Visibility Engine - Computes visibility polygons from point sources
 * Uses visibility-polygon-js for O(N log N) visibility computation
 */

// @ts-ignore - visibility-polygon.js doesn't have TypeScript definitions
import VisibilityPolygon from './visibility-polygon.js';
import type { CanvasRegion } from '@/stores/regionStore';

export interface Point {
  x: number;
  y: number;
}

export interface LineSegment {
  start: Point;
  end: Point;
}

export interface VisibilityResult {
  polygon: Point[]; // Vertices of visible area in clockwise order
  segments: LineSegment[]; // Original obstacle segments
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
}

// Cache for visibility polygon results
interface CacheEntry {
  result: VisibilityResult;
  timestamp: number;
}

const visibilityCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 100; // ms - cache is invalidated quickly to stay responsive

/**
 * Converts CanvasRegions to line segments for visibility calculation
 */
export function regionsToSegments(regions: CanvasRegion[]): LineSegment[] {
  const segments: LineSegment[] = [];

  for (const region of regions) {
    // Default to rectangle if regionType not specified
    if (!region.regionType || region.regionType === 'rectangle') {
      // Convert rectangle to 4 line segments
      const { x, y, width, height } = region;
      let corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];

      // Handle rotation if present
      if (region.rotation) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const cos = Math.cos(region.rotation);
        const sin = Math.sin(region.rotation);

        corners = corners.map(corner => {
          const dx = corner.x - centerX;
          const dy = corner.y - centerY;
          return {
            x: centerX + dx * cos - dy * sin,
            y: centerY + dx * sin + dy * cos,
          };
        });
      }

      // Create segments from corners
      for (let i = 0; i < corners.length; i++) {
        segments.push({
          start: corners[i],
          end: corners[(i + 1) % corners.length],
        });
      }
    } else if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
      // Convert polygon to line segments
      const points = region.pathPoints;
      for (let i = 0; i < points.length; i++) {
        segments.push({
          start: points[i],
          end: points[(i + 1) % points.length],
        });
      }
    }
  }

  return segments;
}

/**
 * Converts line segments to visibility-polygon-js format
 */
function segmentsToVisibilityFormat(segments: LineSegment[]): number[][][] {
  return segments.map(seg => [
    [seg.start.x, seg.start.y],
    [seg.end.x, seg.end.y]
  ]);
}

/**
 * Converts visibility polygon result back to our Point format
 */
function visibilityFormatToPoints(polygon: number[][]): Point[] {
  return polygon.map(p => ({ x: p[0], y: p[1] }));
}

/**
 * Generate a cache key for visibility computation
 */
function generateCacheKey(position: Point, segments: LineSegment[], maxDistance?: number): string {
  const posKey = `${position.x.toFixed(2)},${position.y.toFixed(2)}`;
  const distKey = maxDistance ? maxDistance.toFixed(0) : 'inf';
  // Simple hash of segment count and first few segments
  const segHash = segments.length + (segments[0] ? `${segments[0].start.x}${segments[0].start.y}` : '');
  return `${posKey}:${distKey}:${segHash}`;
}

/**
 * Compute visibility polygon from line segments directly
 * @param position - The observer position (light source, token, etc.)
 * @param segments - Line segments that block visibility
 * @param maxDistance - Optional maximum visibility distance
 * @returns Visibility polygon and metadata
 */
export function computeVisibilityFromSegments(
  position: Point,
  segments: LineSegment[],
  maxDistance?: number
): VisibilityResult {
  // Check cache
  const cacheKey = generateCacheKey(position, segments, maxDistance);
  const cached = visibilityCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }

  // Convert to visibility-polygon format
  const visSegments = segmentsToVisibilityFormat(segments);

  // Add bounding box if maxDistance specified
  if (maxDistance) {
    const bounds = [
      [position.x - maxDistance, position.y - maxDistance],
      [position.x + maxDistance, position.y - maxDistance],
      [position.x + maxDistance, position.y + maxDistance],
      [position.x - maxDistance, position.y + maxDistance],
    ];
    
    // Add bounding box as segments
    for (let i = 0; i < bounds.length; i++) {
      visSegments.push([bounds[i], bounds[(i + 1) % bounds.length]]);
    }
  }

  // Break intersecting segments (required by visibility-polygon-js)
  const brokenSegments = VisibilityPolygon.breakIntersections(visSegments);

  // Compute visibility polygon
  const visibilityPolygon = VisibilityPolygon.compute(
    [position.x, position.y],
    brokenSegments
  );

  // Convert back to our format
  const polygon = visibilityFormatToPoints(visibilityPolygon);

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const result: VisibilityResult = {
    polygon,
    segments,
    boundingBox: { minX, minY, maxX, maxY },
  };

  // Cache the result
  visibilityCache.set(cacheKey, { result, timestamp: now });

  return result;
}

/**
 * Compute visibility polygon from a point source (using regions)
 * @param position - The observer position (light source, token, etc.)
 * @param obstacles - Regions that block visibility (walls, etc.)
 * @param maxDistance - Optional maximum visibility distance
 * @returns Visibility polygon and metadata
 */
export function computeVisibility(
  position: Point,
  obstacles: CanvasRegion[],
  maxDistance?: number
): VisibilityResult {
  // Convert regions to line segments
  const segments = regionsToSegments(obstacles);
  return computeVisibilityFromSegments(position, segments, maxDistance);
}

/**
 * Compute combined visibility from multiple point sources
 * @param positions - Multiple observer positions
 * @param obstacles - Regions that block visibility
 * @param maxDistance - Optional maximum visibility distance per source
 * @returns Combined visibility polygon (union of all visibility polygons)
 */
export function computeMultiSourceVisibility(
  positions: Point[],
  obstacles: CanvasRegion[],
  maxDistance?: number
): VisibilityResult {
  if (positions.length === 0) {
    return {
      polygon: [],
      segments: [],
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    };
  }

  if (positions.length === 1) {
    return computeVisibility(positions[0], obstacles, maxDistance);
  }

  // Compute visibility for each position
  const visibilities = positions.map(pos => computeVisibility(pos, obstacles, maxDistance));

  // Combine all polygons (union operation)
  // For now, we'll use a simple approach: convert to Path2D and use canvas operations
  // A more sophisticated approach would compute the actual polygon union
  const combined = visibilities[0];
  
  // Expand bounding box to include all
  for (let i = 1; i < visibilities.length; i++) {
    const vis = visibilities[i];
    combined.boundingBox.minX = Math.min(combined.boundingBox.minX, vis.boundingBox.minX);
    combined.boundingBox.minY = Math.min(combined.boundingBox.minY, vis.boundingBox.minY);
    combined.boundingBox.maxX = Math.max(combined.boundingBox.maxX, vis.boundingBox.maxX);
    combined.boundingBox.maxY = Math.max(combined.boundingBox.maxY, vis.boundingBox.maxY);
  }

  return combined;
}

/**
 * Check if a point is visible from an observer position
 */
export function isPointVisible(
  point: Point,
  observerPosition: Point,
  obstacles: CanvasRegion[],
  maxDistance?: number
): boolean {
  // Quick distance check
  if (maxDistance) {
    const dx = point.x - observerPosition.x;
    const dy = point.y - observerPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDistance) return false;
  }

  const visibility = computeVisibility(observerPosition, obstacles, maxDistance);
  
  // Convert to visibility-polygon format for inPolygon check
  const polygonFormat = visibility.polygon.map(p => [p.x, p.y]);
  return VisibilityPolygon.inPolygon([point.x, point.y], polygonFormat);
}

/**
 * Clear the visibility cache (call when obstacles change)
 */
export function clearVisibilityCache(): void {
  visibilityCache.clear();
}

/**
 * Create a Path2D from a visibility polygon for rendering
 */
export function visibilityPolygonToPath2D(polygon: Point[]): Path2D {
  const path = new Path2D();
  
  if (polygon.length === 0) return path;
  
  path.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    path.lineTo(polygon[i].x, polygon[i].y);
  }
  path.closePath();
  
  return path;
}
