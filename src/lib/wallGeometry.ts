// Wall geometry generation using negative space approach
import { CanvasRegion } from '@/stores/regionStore';
import { WatabouStyle } from './watabouStyles';
import paper from 'paper';

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
 * Uses paper.js for proper boolean operations and segment extraction
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
  
  // Setup paper.js scope in memory (no canvas required)
  paper.setup(new paper.Size(1, 1));
  
  // Calculate bounding box for all regions
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  regions.forEach((region) => {
    if (region.regionType === 'rectangle') {
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
  
  // Create outer bounding rectangle using paper.js
  const outerRect = new paper.Path.Rectangle({
    point: [bounds.x, bounds.y],
    size: [bounds.width, bounds.height]
  });
  
  // Start with the outer rectangle as our wall geometry
  let wallCompoundPath: paper.PathItem = outerRect;
  
  // Subtract each region from the wall geometry
  regions.forEach((region) => {
    let regionPath: paper.Path | null = null;
    
    if (region.regionType === 'rectangle') {
      if (region.rotation) {
        // Create rotated rectangle
        const cx = region.x + region.width / 2;
        const cy = region.y + region.height / 2;
        const rect = new paper.Path.Rectangle({
          point: [region.x, region.y],
          size: [region.width, region.height]
        });
        rect.rotate(region.rotation, new paper.Point(cx, cy));
        regionPath = rect;
      } else {
        // Non-rotated rectangle
        regionPath = new paper.Path.Rectangle({
          point: [region.x, region.y],
          size: [region.width, region.height]
        });
      }
    } else if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
      // Path-based region
      regionPath = new paper.Path();
      region.pathPoints.forEach((point) => {
        regionPath!.add(new paper.Point(point.x, point.y));
      });
      regionPath.closePath();
    }
    
    // Subtract this region from the wall geometry
    if (regionPath) {
      const newPath = wallCompoundPath.subtract(regionPath);
      wallCompoundPath.remove(); // Clean up old path
      regionPath.remove(); // Clean up region path
      wallCompoundPath = newPath;
    }
  });
  
  // Extract wall segments from the resolved boolean geometry
  const wallSegments: LineSegment[] = [];
  
  // The result can be a CompoundPath (multiple children) or a single Path
  const paths = wallCompoundPath.className === 'CompoundPath' 
    ? (wallCompoundPath as paper.CompoundPath).children 
    : [wallCompoundPath as paper.Path];
  
  paths.forEach((path) => {
    if (path.className === 'Path') {
      const segments = (path as paper.Path).segments;
      segments.forEach((segment, index) => {
        const nextSegment = segments[(index + 1) % segments.length];
        wallSegments.push({
          start: { x: segment.point.x, y: segment.point.y },
          end: { x: nextSegment.point.x, y: nextSegment.point.y }
        });
      });
    }
  });
  
  // Convert paper.js path to Path2D for canvas rendering
  const wallPath = new Path2D();
  paths.forEach((path, pathIndex) => {
    if (path.className === 'Path') {
      const segments = (path as paper.Path).segments;
      if (segments.length > 0) {
        const firstPoint = segments[0].point;
        wallPath.moveTo(firstPoint.x, firstPoint.y);
        
        segments.forEach((segment) => {
          wallPath.lineTo(segment.point.x, segment.point.y);
        });
        wallPath.closePath();
      }
    }
  });
  
  // Clean up paper.js
  wallCompoundPath.remove();
  
  console.log('Generated wall geometry using paper.js:', {
    wallSegments: wallSegments.length,
    paths: paths.length,
    regions: regions.length
  });

  return {
    wallPath,
    wallSegments,
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
