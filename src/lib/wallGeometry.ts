// Wall geometry generation using negative space approach
import { CanvasRegion } from '@/stores/regionStore';
import { WatabouStyle } from './watabouStyles';

export interface WallGeometry {
  wallPath: Path2D;
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
  
  // Create compound path: outer rectangle minus all regions
  const wallPath = new Path2D();
  
  // Add outer bounding box (clockwise winding)
  wallPath.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  
  // Subtract each region as a hole (counter-clockwise winding)
  regions.forEach((region) => {
    if (region.regionType === 'rectangle') {
      if (region.rotation) {
        // For rotated rectangles, add as path
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
        
        // Add counter-clockwise (reversed order)
        wallPath.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
        for (let i = rotatedCorners.length - 1; i >= 0; i--) {
          wallPath.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
        }
        wallPath.closePath();
      } else {
        // Add non-rotated rectangle as counter-clockwise hole
        wallPath.moveTo(region.x, region.y);
        wallPath.lineTo(region.x, region.y + region.height);
        wallPath.lineTo(region.x + region.width, region.y + region.height);
        wallPath.lineTo(region.x + region.width, region.y);
        wallPath.closePath();
      }
    } else if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
      // Add path-based region as counter-clockwise hole
      wallPath.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
      for (let i = region.pathPoints.length - 1; i >= 0; i--) {
        wallPath.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
      }
      wallPath.closePath();
    }
  });
  
  return {
    wallPath,
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
