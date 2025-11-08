// Wall geometry generation using negative space approach
import { CanvasRegion } from '@/stores/regionStore';
import { WatabouStyle } from './watabouStyles';

export interface LineSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface WallGeometry {
  wallPath: Path2D;
  wallSegments: LineSegment[]; // NEW: Line segments that represent the actual wall boundaries
  bounds: { x: number; y: number; width: number; height: number };
  wallThickness: number;
  margin: number;
}

export interface FloorGeometry {
  floorPath: Path2D;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Generate wall geometry as negative space (bounding box minus all regions)
 */
export function generateWallGeometry(
  regions: CanvasRegion[],
  wallThickness: number,
  margin?: number
): WallGeometry {
  const effectiveMargin = margin ?? wallThickness * 2;
  
  if (regions.length === 0) {
    return {
      wallPath: new Path2D(),
      wallSegments: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      wallThickness,
      margin: effectiveMargin,
    };
  }
  
  // Calculate bounding box for all regions
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  regions.forEach((region) => {
    if (region.regionType === 'rectangle') {
      // Handle rotation if present
      if (region.rotation) {
        const cx = region.x + region.width / 2;
        const cy = region.y + region.height / 2;
        const corners = [
          { x: region.x, y: region.y },
          { x: region.x + region.width, y: region.y },
          { x: region.x + region.width, y: region.y + region.height },
          { x: region.x, y: region.y + region.height },
        ];
        
        corners.forEach((corner) => {
          const dx = corner.x - cx;
          const dy = corner.y - cy;
          const angle = (region.rotation * Math.PI) / 180;
          const rotatedX = cx + dx * Math.cos(angle) - dy * Math.sin(angle);
          const rotatedY = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
          
          minX = Math.min(minX, rotatedX);
          minY = Math.min(minY, rotatedY);
          maxX = Math.max(maxX, rotatedX);
          maxY = Math.max(maxY, rotatedY);
        });
      } else {
        minX = Math.min(minX, region.x);
        minY = Math.min(minY, region.y);
        maxX = Math.max(maxX, region.x + region.width);
        maxY = Math.max(maxY, region.y + region.height);
      }
    } else if (region.regionType === 'path' && region.pathPoints) {
      region.pathPoints.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    }
  });
  
  // Expand bounds by margin
  const bounds = {
    x: minX - effectiveMargin,
    y: minY - effectiveMargin,
    width: maxX - minX + 2 * effectiveMargin,
    height: maxY - minY + 2 * effectiveMargin,
  };
  
  // Track wall segments for light blocking
  // In negative space model: outer box + ALL region boundaries = walls
  const wallSegments: LineSegment[] = [];
  
  // Create compound path: outer rectangle minus all regions
  const wallPath = new Path2D();
  
  // Add outer bounding box (clockwise winding)
  wallPath.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  
  // Add outer bounding box segments - outer walls
  wallSegments.push(
    { start: { x: bounds.x, y: bounds.y }, end: { x: bounds.x + bounds.width, y: bounds.y } },
    { start: { x: bounds.x + bounds.width, y: bounds.y }, end: { x: bounds.x + bounds.width, y: bounds.y + bounds.height } },
    { start: { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, end: { x: bounds.x, y: bounds.y + bounds.height } },
    { start: { x: bounds.x, y: bounds.y + bounds.height }, end: { x: bounds.x, y: bounds.y } }
  );
  
  // Subtract each region as a hole AND add its boundaries as wall segments
  // Regions are holes in the wall - their edges ARE walls
  regions.forEach((region) => {
    if (region.regionType === 'rectangle') {
      if (region.rotation) {
        // For rotated rectangles
        const cx = region.x + region.width / 2;
        const cy = region.y + region.height / 2;
        const angle = (region.rotation * Math.PI) / 180;
        const corners = [
          { x: region.x, y: region.y },
          { x: region.x + region.width, y: region.y },
          { x: region.x + region.width, y: region.y + region.height },
          { x: region.x, y: region.y + region.height },
        ];
        
        const rotatedCorners = corners.map((corner) => {
          const dx = corner.x - cx;
          const dy = corner.y - cy;
          return {
            x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: cy + dx * Math.sin(angle) + dy * Math.cos(angle),
          };
        });
        
        // Add to path (counter-clockwise for hole)
        wallPath.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
        for (let i = rotatedCorners.length - 1; i >= 0; i--) {
          wallPath.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
        }
        wallPath.closePath();
        
        // Add edge segments for light blocking
        for (let i = 0; i < rotatedCorners.length; i++) {
          wallSegments.push({
            start: rotatedCorners[i],
            end: rotatedCorners[(i + 1) % rotatedCorners.length]
          });
        }
      } else {
        // Non-rotated rectangle
        wallPath.moveTo(region.x, region.y);
        wallPath.lineTo(region.x, region.y + region.height);
        wallPath.lineTo(region.x + region.width, region.y + region.height);
        wallPath.lineTo(region.x + region.width, region.y);
        wallPath.closePath();
        
        // Add edge segments for light blocking
        wallSegments.push(
          { start: { x: region.x, y: region.y }, end: { x: region.x + region.width, y: region.y } },
          { start: { x: region.x + region.width, y: region.y }, end: { x: region.x + region.width, y: region.y + region.height } },
          { start: { x: region.x + region.width, y: region.y + region.height }, end: { x: region.x, y: region.y + region.height } },
          { start: { x: region.x, y: region.y + region.height }, end: { x: region.x, y: region.y } }
        );
      }
    } else if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
      // Path-based region
      wallPath.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
      for (let i = region.pathPoints.length - 1; i >= 0; i--) {
        wallPath.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
      }
      wallPath.closePath();
      
      // Add edge segments for light blocking
      for (let i = 0; i < region.pathPoints.length; i++) {
        wallSegments.push({
          start: region.pathPoints[i],
          end: region.pathPoints[(i + 1) % region.pathPoints.length]
        });
      }
    }
  });
  
  // Remove duplicate segments (shared edges between adjacent regions)
  // If a segment appears in both directions, it's an interior edge that shouldn't block light
  const deduplicatedSegments: LineSegment[] = [];
  const segmentMap = new Map<string, { segment: LineSegment; reversed: boolean }>();
  
  for (const segment of wallSegments) {
    // Create keys for both directions
    const forwardKey = `${segment.start.x},${segment.start.y}-${segment.end.x},${segment.end.y}`;
    const reverseKey = `${segment.end.x},${segment.end.y}-${segment.start.x},${segment.start.y}`;
    
    // Check if the reverse segment already exists
    if (segmentMap.has(reverseKey)) {
      // This is a shared interior edge - remove both directions
      segmentMap.delete(reverseKey);
    } else {
      // New segment - add it
      segmentMap.set(forwardKey, { segment, reversed: false });
    }
  }
  
  // Convert map back to array
  const finalWallSegments = Array.from(segmentMap.values()).map(item => item.segment);
  
  console.log('Generated wall geometry:', {
    totalSegments: wallSegments.length,
    afterDeduplication: finalWallSegments.length,
    removedInteriorEdges: wallSegments.length - finalWallSegments.length,
    regions: regions.length
  });

  return {
    wallPath,
    wallSegments: finalWallSegments,
    bounds,
    wallThickness,
    margin: effectiveMargin,
  };
}

/**
 * Generate floor geometry as the inverse of wall geometry
 * This creates a unified navigable space by cutting walls from the bounding box
 */
export function generateFloorGeometry(
  wallGeometry: WallGeometry
): FloorGeometry {
  // Create compound path: outer rectangle minus wall geometry
  const floorPath = new Path2D();
  
  // Add outer bounding box (clockwise winding)
  floorPath.rect(
    wallGeometry.bounds.x,
    wallGeometry.bounds.y,
    wallGeometry.bounds.width,
    wallGeometry.bounds.height
  );
  
  // Add wall geometry as a hole (it's already a compound path with proper winding)
  floorPath.addPath(wallGeometry.wallPath);
  
  return {
    floorPath,
    bounds: wallGeometry.bounds,
  };
}

/**
 * Apply hatching pattern to wall geometry using clipping
 */
export function applyWallHatching(
  ctx: CanvasRenderingContext2D,
  wallGeometry: WallGeometry,
  style: WatabouStyle,
  zoom: number
) {
  ctx.save();
  
  // Clip to wall geometry
  ctx.clip(wallGeometry.wallPath, 'evenodd');
  
  // Draw hatching pattern across entire bounds
  const { bounds } = wallGeometry;
  const hatchSpacing = (style.hatchingDistance * 20) / zoom;
  
  ctx.strokeStyle = style.colorInk;
  ctx.lineWidth = style.strokeHatching / zoom;
  
  if (style.hatchingStyle === 'Stonework') {
    // Stonework pattern - irregular marks
    for (let x = bounds.x; x < bounds.x + bounds.width; x += hatchSpacing) {
      for (let y = bounds.y; y < bounds.y + bounds.height; y += hatchSpacing) {
        ctx.beginPath();
        const angle = Math.random() * Math.PI * 2;
        const len = hatchSpacing * 0.4;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
  } else if (style.hatchingStyle === 'Bricks') {
    // Brick pattern - horizontal and vertical lines
    const brickHeight = hatchSpacing * 1.5;
    const brickWidth = hatchSpacing * 2.5;
    
    for (let y = bounds.y; y < bounds.y + bounds.height; y += brickHeight) {
      const rowOffset = (Math.floor((y - bounds.y) / brickHeight) % 2) * brickWidth / 2;
      
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(bounds.x, y);
      ctx.lineTo(bounds.x + bounds.width, y);
      ctx.stroke();
      
      // Vertical lines
      for (let x = bounds.x + rowOffset; x < bounds.x + bounds.width; x += brickWidth) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + brickHeight);
        ctx.stroke();
      }
    }
  } else {
    // Default diagonal hatching
    const diagonal = Math.sqrt(bounds.width ** 2 + bounds.height ** 2);
    const numLines = Math.floor(diagonal / hatchSpacing);
    
    for (let i = -numLines; i <= numLines; i++) {
      const offset = i * hatchSpacing;
      ctx.beginPath();
      ctx.moveTo(bounds.x + offset, bounds.y);
      ctx.lineTo(bounds.x + offset + bounds.height, bounds.y + bounds.height);
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

/**
 * Generate cache key for wall geometry based on region data
 */
export function generateWallGeometryCacheKey(regions: CanvasRegion[]): string {
  return JSON.stringify(
    regions.map((r) => ({
      id: r.id,
      type: r.regionType,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      rotation: r.rotation,
      pathPoints: r.pathPoints,
    }))
  );
}

/**
 * Generate negative space region data for visualization
 * This creates a special visual representation of walls/negative space
 */
export interface NegativeSpaceRegion {
  id: 'negative-space';
  pathPoints: Array<{ x: number; y: number }>;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Convert Path2D to path points for rendering
 * Note: This is a simplified approach that extracts the bounding rectangle
 */
function extractPathPointsFromWallGeometry(wallGeometry: WallGeometry): Array<{ x: number; y: number }> {
  const { bounds } = wallGeometry;
  
  // Return the outer bounding box as a path
  // The actual negative space rendering will use the wallPath directly
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

/**
 * Generate negative space region from existing regions
 * Returns null if no regions exist
 */
export function generateNegativeSpaceRegion(
  regions: CanvasRegion[],
  wallThickness: number = 15,
  margin: number = 5
): { wallGeometry: WallGeometry; visualRegion: NegativeSpaceRegion } | null {
  if (regions.length === 0) return null;
  
  const wallGeometry = generateWallGeometry(regions, wallThickness, margin);
  
  // Create a visual representation
  const visualRegion: NegativeSpaceRegion = {
    id: 'negative-space',
    pathPoints: extractPathPointsFromWallGeometry(wallGeometry),
    bounds: wallGeometry.bounds,
  };
  
  return { wallGeometry, visualRegion };
}
