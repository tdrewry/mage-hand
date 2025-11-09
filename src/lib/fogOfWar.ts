/**
 * Fog of War System - Coordinator for fog geometry and rendering
 * Uses paper.js for boolean operations via fogGeometry module
 */

import type { CanvasRegion } from '@/stores/regionStore';
import { computeVisibilityFromSegments, type Point, type LineSegment } from './visibilityEngine';
import { visibilityPolygonToPaperPath } from './fogGeometry';

export interface FogOfWarState {
  exploredAreas: string; // Serialized Path2D data
  enabled: boolean;
  revealAll: boolean; // DM mode - reveal entire map
}

export interface Token {
  id: string;
  x: number;
  y: number;
  gridWidth: number;
  gridHeight: number;
  ownerId?: string;
}

/**
 * Compute current visibility from token positions with circular vision
 * Uses wall geometry (negative space) to filter out tokens in walls,
 * and uses wall segments as obstacles for visibility calculation
 * @param visionRangePixels Vision range in pixels (already converted from grid units)
 * @returns paper.js Path (not Path2D) for boolean operations
 */
export async function computeTokenVisibilityPaper(
  tokens: Token[],
  wallSegments: LineSegment[],
  wallGeometry: any | null,
  visionRangePixels: number = 300
): Promise<any> {
  const paper = await import('paper');
  
  if (tokens.length === 0) {
    return new paper.Path() as any;
  }

  // Filter out tokens that are inside walls (shouldn't cast light)
  let validTokens = tokens;
  if (wallGeometry) {
    // Create a temporary canvas context to test if tokens are in walls
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      validTokens = tokens.filter(token => {
        // Check if token center is inside wall geometry (negative space)
        const isInWall = tempCtx.isPointInPath(wallGeometry.wallPath, token.x, token.y, 'evenodd');
        return !isInWall; // Only include tokens NOT in walls
      });
    }
  }

  if (validTokens.length === 0) {
    return new paper.Path() as any;
  }

  // Compute visibility for each token and merge using paper.js union
  let combinedVisibility: any = null;
  
  for (const token of validTokens) {
    const visibility = computeVisibilityFromSegments(
      { x: token.x, y: token.y },
      wallSegments,
      visionRangePixels
    );
    
    // Convert visibility polygon to paper.js path
    const paperPath = visibilityPolygonToPaperPath(visibility.polygon);
    
    // Create circular clipping mask for this token
    const circle = new paper.Path.Circle({
      center: new paper.Point(token.x, token.y),
      radius: visionRangePixels,
    });
    
    // Intersect visibility polygon with circle to create circular vision
    const circularVision = paperPath.intersect(circle, { insert: false });
    
    // Clean up temporary paths
    if (paperPath.remove) paperPath.remove();
    if (circle.remove) circle.remove();
    
    if (!combinedVisibility) {
      combinedVisibility = circularVision;
    } else {
      // Union with previous visibility
      const united = combinedVisibility.unite(circularVision, { insert: false });
      if (combinedVisibility.remove) combinedVisibility.remove();
      if (circularVision.remove) circularVision.remove();
      combinedVisibility = united;
    }
  }
  
  return combinedVisibility || new paper.Path();
}

/**
 * Merge current visibility into explored areas
 */
export function mergeExploredAreas(
  currentVisibility: Path2D,
  previousExplored: Path2D
): Path2D {
  // In a full implementation, this would perform a union operation on the paths
  // For now, we'll return the current visibility since Path2D doesn't support union directly
  // A proper implementation would use a library like paper.js or perform polygon union
  
  // Simple approach: render both to an offscreen canvas and extract the combined path
  // For now, just return current (will be improved in future iterations)
  return currentVisibility;
}

/**
 * Render fog of war overlay
 */
export function renderFogOfWar(
  ctx: CanvasRenderingContext2D,
  visibleArea: Path2D,
  exploredArea: Path2D,
  canvasBounds: { x: number; y: number; width: number; height: number },
  fogEnabled: boolean,
  revealAll: boolean
) {
  if (!fogEnabled || revealAll) return;

  ctx.save();

  // Create full canvas path
  const fullCanvas = new Path2D();
  fullCanvas.rect(canvasBounds.x, canvasBounds.y, canvasBounds.width, canvasBounds.height);

  // 1. Draw unexplored areas (full black)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fill(fullCanvas, 'evenodd');

  // 2. Draw explored but not visible areas (dimmed)
  if (exploredArea) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent to create dimmed effect
    ctx.fill(exploredArea);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 3. Reveal currently visible areas (fully clear)
  if (visibleArea) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Full opacity to fully reveal
    ctx.fill(visibleArea);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

/**
 * Create a fog overlay with three visibility states:
 * 1. Unexplored (completely black)
 * 2. Explored but not visible (semi-transparent)
 * 3. Currently visible (no fog)
 */
export function renderSimpleFog(
  ctx: CanvasRenderingContext2D,
  visibleArea: Path2D,
  exploredArea: Path2D | null,
  canvasBounds: { x: number; y: number; width: number; height: number },
  fogEnabled: boolean,
  revealAll: boolean,
  unexploredOpacity: number = 0.95,
  exploredOpacity: number = 0.4
) {
  if (!fogEnabled || revealAll) return;

  ctx.save();

  // Build fog mask: Start with full opacity, cut out explored, then cut out visible
  // 1. Draw fully opaque unexplored fog
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(canvasBounds.x, canvasBounds.y, canvasBounds.width, canvasBounds.height);

  // 2. Cut out explored areas and replace with semi-transparent fog
  if (exploredArea) {
    // Punch hole in the opaque fog
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(exploredArea);
    
    // Fill the hole with semi-transparent fog
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
    ctx.fill(exploredArea);
  }

  // 3. Cut out currently visible areas completely (no fog)
  if (visibleArea) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(visibleArea);
  }

  ctx.restore();
}

/**
 * Serialize Path2D to string (for storage)
 * Note: Path2D doesn't have native serialization, so we'd need to track points separately
 */
export function serializePath2D(path: Path2D): string {
  // Placeholder - would need to track polygon points separately for real serialization
  return '';
}

/**
 * Deserialize Path2D from string
 */
export function deserializePath2D(data: string): Path2D {
  // Placeholder - would reconstruct from stored polygon points
  return new Path2D();
}

/**
 * Calculate vision range based on token properties
 */
export function getTokenVisionRange(token: Token, defaultRange: number = 300): number {
  // Could be extended to read from token properties (darkvision, etc.)
  return defaultRange;
}

/**
 * Check if a point is in fog (not visible and not explored)
 */
export function isPointInFog(
  point: Point,
  visibleArea: Path2D,
  exploredArea: Path2D,
  ctx: CanvasRenderingContext2D
): boolean {
  const isVisible = ctx.isPointInPath(visibleArea, point.x, point.y);
  const isExplored = ctx.isPointInPath(exploredArea, point.x, point.y);
  
  return !isVisible && !isExplored;
}

/**
 * Render fog edge softening (optional visual enhancement)
 */
export function renderFogEdges(
  ctx: CanvasRenderingContext2D,
  visibleArea: Path2D,
  edgeWidth: number = 20
) {
  ctx.save();
  
  // Create gradient edge effect
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = edgeWidth;
  ctx.stroke(visibleArea);
  
  ctx.restore();
}
