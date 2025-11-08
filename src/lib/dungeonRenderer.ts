import { DoorConnection, Annotation, TerrainFeature, DOOR_TYPE_LABELS } from './dungeonTypes';
import { CanvasRegion } from '@/stores/regionStore';
import { WatabouStyle, DEFAULT_STYLE } from './watabouStyles';

/**
 * Check if two wall segments are exactly coincident (same position and orientation)
 */
function segmentsCoincident(
  seg1: { x1: number; y1: number; x2: number; y2: number },
  seg2: { x1: number; y1: number; x2: number; y2: number },
  tolerance: number = 1
): boolean {
  // Check if segments match in either direction
  const match1 = Math.abs(seg1.x1 - seg2.x1) < tolerance &&
                 Math.abs(seg1.y1 - seg2.y1) < tolerance &&
                 Math.abs(seg1.x2 - seg2.x2) < tolerance &&
                 Math.abs(seg1.y2 - seg2.y2) < tolerance;
  
  const match2 = Math.abs(seg1.x1 - seg2.x2) < tolerance &&
                 Math.abs(seg1.y1 - seg2.y2) < tolerance &&
                 Math.abs(seg1.x2 - seg2.x1) < tolerance &&
                 Math.abs(seg1.y2 - seg2.y1) < tolerance;
  
  return match1 || match2;
}

/**
 * Check if two segments share a significant portion of the same line
 */
function segmentsOverlap(
  seg1: { x1: number; y1: number; x2: number; y2: number },
  seg2: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const tolerance = 0.5;
  
  // Calculate segment vectors
  const dx1 = seg1.x2 - seg1.x1;
  const dy1 = seg1.y2 - seg1.y1;
  const dx2 = seg2.x2 - seg2.x1;
  const dy2 = seg2.y2 - seg2.y1;
  
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  
  if (len1 < 0.1 || len2 < 0.1) return false;
  
  // Normalize direction vectors
  const ndx1 = dx1 / len1;
  const ndy1 = dy1 / len1;
  const ndx2 = dx2 / len2;
  const ndy2 = dy2 / len2;
  
  // Check if parallel (dot product of normalized vectors ≈ ±1)
  const dotProduct = Math.abs(ndx1 * ndx2 + ndy1 * ndy2);
  if (dotProduct < 0.98) return false; // Not parallel
  
  // Check if segments are on the same line
  // Project seg2's start point onto seg1's line
  const dx = seg2.x1 - seg1.x1;
  const dy = seg2.y1 - seg1.y1;
  const perpDist = Math.abs(dx * ndy1 - dy * ndx1);
  
  if (perpDist > tolerance) return false; // Not on same line
  
  // Check if segments overlap along the line
  // Project all points onto the line direction
  const t1_start = 0;
  const t1_end = len1;
  const t2_start = (seg2.x1 - seg1.x1) * ndx1 + (seg2.y1 - seg1.y1) * ndy1;
  const t2_end = (seg2.x2 - seg1.x1) * ndx1 + (seg2.y2 - seg1.y1) * ndy1;
  
  const t2_min = Math.min(t2_start, t2_end);
  const t2_max = Math.max(t2_start, t2_end);
  
  // Check for overlap with a minimum overlap threshold
  const overlapStart = Math.max(t1_start, t2_min);
  const overlapEnd = Math.min(t1_end, t2_max);
  const overlapLength = overlapEnd - overlapStart;
  
  // Require at least 50% of the shorter segment to overlap
  const minOverlap = Math.min(len1, len2) * 0.5;
  
  return overlapLength >= minOverlap;
}

/**
 * Calculate wall segments from regions, removing shared walls between adjacent regions
 */
function calculateWallSegments(regions: CanvasRegion[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const allSegments: { x1: number; y1: number; x2: number; y2: number; regionId: string }[] = [];
  
  // Collect all wall segments with their region IDs
  regions.forEach((region) => {
    if (region.regionType === 'rectangle') {
      // Add four walls for rectangle
      allSegments.push(
        { x1: region.x, y1: region.y, x2: region.x + region.width, y2: region.y, regionId: region.id },
        { x1: region.x + region.width, y1: region.y, x2: region.x + region.width, y2: region.y + region.height, regionId: region.id },
        { x1: region.x + region.width, y1: region.y + region.height, x2: region.x, y2: region.y + region.height, regionId: region.id },
        { x1: region.x, y1: region.y + region.height, x2: region.x, y2: region.y, regionId: region.id }
      );
    } else if (region.regionType === 'path' && region.pathPoints) {
      // Add segments for each path edge
      for (let i = 0; i < region.pathPoints.length; i++) {
        const p1 = region.pathPoints[i];
        const p2 = region.pathPoints[(i + 1) % region.pathPoints.length];
        allSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, regionId: region.id });
      }
    }
  });
  
  // Find and remove shared walls (walls that overlap between different regions)
  const sharedSegmentIndices = new Set<number>();
  
  for (let i = 0; i < allSegments.length; i++) {
    if (sharedSegmentIndices.has(i)) continue;
    
    for (let j = i + 1; j < allSegments.length; j++) {
      if (sharedSegmentIndices.has(j)) continue;
      
      // Only check segments from different regions
      if (allSegments[i].regionId !== allSegments[j].regionId) {
        // Use stricter coincident check first
        if (segmentsCoincident(allSegments[i], allSegments[j], 1)) {
          sharedSegmentIndices.add(i);
          sharedSegmentIndices.add(j);
        }
        // Then check for significant overlap
        else if (segmentsOverlap(allSegments[i], allSegments[j])) {
          sharedSegmentIndices.add(i);
          sharedSegmentIndices.add(j);
        }
      }
    }
  }
  
  // Return only non-shared segments
  return allSegments
    .filter((_, index) => !sharedSegmentIndices.has(index))
    .map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 }));
}

/**
 * Draw hatching pattern for walls
 */
function drawWallHatching(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: number,
  wallThickness: number,
  style: WatabouStyle
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;
  
  const dx = Math.cos(perpAngle) * wallThickness / 2;
  const dy = Math.sin(perpAngle) * wallThickness / 2;
  
  const hatchSpacing = (style.hatchingDistance * 20) / zoom;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const numHatches = Math.floor(length / hatchSpacing);
  
  ctx.strokeStyle = style.colorInk;
  ctx.lineWidth = style.strokeHatching / zoom;
  
  if (style.hatchingStyle === 'Stonework') {
    // Stonework pattern - irregular blocks
    for (let i = 0; i <= numHatches; i++) {
      const t = i / numHatches;
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;
      
      // Draw short perpendicular lines with slight randomness
      const offset = (Math.random() - 0.5) * 0.2;
      ctx.beginPath();
      ctx.moveTo(mx + dx * (0.2 + offset), my + dy * (0.2 + offset));
      ctx.lineTo(mx + dx * (0.8 + offset), my + dy * (0.8 + offset));
      ctx.stroke();
      
      // Occasional horizontal breaks
      if (Math.random() > 0.7) {
        const breakLen = hatchSpacing * 0.3;
        ctx.beginPath();
        ctx.moveTo(mx - Math.cos(angle) * breakLen, my - Math.sin(angle) * breakLen);
        ctx.lineTo(mx + Math.cos(angle) * breakLen, my + Math.sin(angle) * breakLen);
        ctx.stroke();
      }
    }
  } else if (style.hatchingStyle === 'Bricks') {
    // Brick pattern
    const brickHeight = hatchSpacing * 2;
    const numRows = Math.floor(wallThickness / brickHeight);
    
    for (let row = 0; row < numRows; row++) {
      const rowOffset = (row % 2) * hatchSpacing / 2;
      for (let i = 0; i <= numHatches; i++) {
        const t = (i * hatchSpacing + rowOffset) / length;
        if (t > 1) break;
        
        const mx = x1 + (x2 - x1) * t;
        const my = y1 + (y2 - y1) * t;
        const rowT = row / numRows - 0.5;
        
        ctx.beginPath();
        ctx.moveTo(mx + dx * rowT * 2, my + dy * rowT * 2);
        ctx.lineTo(mx + dx * rowT * 2, my + dy * rowT * 2 + dy * 0.3);
        ctx.stroke();
      }
    }
  } else {
    // Default hatching
    for (let i = 0; i <= numHatches; i++) {
      const t = i / numHatches;
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;
      
      ctx.beginPath();
      ctx.moveTo(mx + dx * 0.2, my + dy * 0.2);
      ctx.lineTo(mx + dx * 0.8, my + dy * 0.8);
      ctx.stroke();
    }
  }
}

/**
 * Render regions in dungeon map style with thick hatched walls
 */
export function renderDungeonMapRegions(
  ctx: CanvasRenderingContext2D,
  regions: CanvasRegion[],
  zoom: number,
  style: WatabouStyle = DEFAULT_STYLE
) {
  const wallThickness = (style.strokeThick * 2) / zoom;
  
  ctx.save();
  
  // Fill all regions with paper color (don't draw background here - it should be drawn earlier)
  regions.forEach((region) => {
    ctx.fillStyle = style.colorPaper;
    
    if (region.regionType === 'rectangle') {
      ctx.fillRect(region.x, region.y, region.width, region.height);
    } else if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
      ctx.beginPath();
      ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
      for (let i = 1; i < region.pathPoints.length; i++) {
        ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
  
  // Draw walls with shadows and hatching
  const segments = calculateWallSegments(regions);
  
  segments.forEach((seg) => {
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    const perpAngle = angle + Math.PI / 2;
    
    const dx = Math.cos(perpAngle) * wallThickness / 2;
    const dy = Math.sin(perpAngle) * wallThickness / 2;
    
    // Draw shadow first
    if (style.shadowDist > 0) {
      const shadowOffset = (style.shadowDist * 10) / zoom;
      ctx.fillStyle = style.shadowColor;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(seg.x1 - dx + shadowOffset, seg.y1 - dy + shadowOffset);
      ctx.lineTo(seg.x2 - dx + shadowOffset, seg.y2 - dy + shadowOffset);
      ctx.lineTo(seg.x2 + dx + shadowOffset, seg.y2 + dy + shadowOffset);
      ctx.lineTo(seg.x1 + dx + shadowOffset, seg.y1 + dy + shadowOffset);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
    
    // Draw thick wall base
    ctx.fillStyle = style.colorShading;
    ctx.beginPath();
    ctx.moveTo(seg.x1 - dx, seg.y1 - dy);
    ctx.lineTo(seg.x2 - dx, seg.y2 - dy);
    ctx.lineTo(seg.x2 + dx, seg.y2 + dy);
    ctx.lineTo(seg.x1 + dx, seg.y1 + dy);
    ctx.closePath();
    ctx.fill();
    
    // Draw wall outline
    ctx.strokeStyle = style.colorInk;
    ctx.lineWidth = style.strokeNormal / zoom;
    ctx.stroke();
    
    // Add hatching
    drawWallHatching(ctx, seg.x1, seg.y1, seg.x2, seg.y2, zoom, wallThickness, style);
  });
  
  ctx.restore();
}

/**
 * Render doors on the canvas (VTT mode)
 */
export function renderDoors(
  ctx: CanvasRenderingContext2D,
  doors: DoorConnection[],
  zoom: number
) {
  doors.forEach((door) => {
    ctx.save();
    
    const size = 12 / zoom; // Door size in world units
    const lineWidth = 3 / zoom;
    
    // Determine door color based on type
    let doorColor = '#8b5cf6'; // Default purple for normal doors
    switch (door.type) {
      case 2: // Secret
        doorColor = '#ef4444'; // Red
        break;
      case 3: // Portcullis
        doorColor = '#737373'; // Gray
        break;
      case 4: // Locked
        doorColor = '#eab308'; // Yellow
        break;
      case 5: // Trapped
        doorColor = '#f97316'; // Orange
        break;
      case 9: // Hidden
        doorColor = '#991b1b'; // Dark red
        break;
    }
    
    ctx.strokeStyle = doorColor;
    ctx.lineWidth = lineWidth;
    
    // Draw door based on direction
    const { x, y } = door.position;
    const { x: dx, y: dy } = door.direction;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal door
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x, y + size / 2);
      ctx.stroke();
      
      // Add door type indicators
      if (door.type === 1) {
        // Double door
        ctx.beginPath();
        ctx.moveTo(x + size / 4, y - size / 2);
        ctx.lineTo(x + size / 4, y + size / 2);
        ctx.stroke();
      } else if (door.type === 6) {
        // Archway - draw arc
        ctx.beginPath();
        ctx.arc(x, y, size / 2, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
    } else {
      // Vertical door
      ctx.beginPath();
      ctx.moveTo(x - size / 2, y);
      ctx.lineTo(x + size / 2, y);
      ctx.stroke();
      
      // Add door type indicators
      if (door.type === 1) {
        // Double door
        ctx.beginPath();
        ctx.moveTo(x - size / 2, y + size / 4);
        ctx.lineTo(x + size / 2, y + size / 4);
        ctx.stroke();
      } else if (door.type === 6) {
        // Archway - draw arc
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  });
}

/**
 * Render doors in dungeon map style with clean symbols
 */
export function renderDungeonMapDoors(
  ctx: CanvasRenderingContext2D,
  doors: DoorConnection[],
  zoom: number,
  style: WatabouStyle = DEFAULT_STYLE
) {
  doors.forEach((door) => {
    ctx.save();
    
    const size = 16 / zoom;
    const lineWidth = style.strokeNormal / zoom;
    
    ctx.strokeStyle = style.colorInk;
    ctx.lineWidth = lineWidth;
    ctx.fillStyle = style.colorPaper;
    
    const { x, y } = door.position;
    const { x: dx, y: dy } = door.direction;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    switch (door.type) {
      case 0: // Normal door
        if (isHorizontal) {
          // Draw door with arc
          ctx.beginPath();
          ctx.arc(x, y - size / 2, size / 2, 0, Math.PI / 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x - size / 2, y, size / 2, -Math.PI / 2, 0);
          ctx.stroke();
        }
        break;
        
      case 1: // Double door
        if (isHorizontal) {
          ctx.beginPath();
          ctx.arc(x, y - size / 3, size / 3, 0, Math.PI / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y + size / 3, size / 3, Math.PI, Math.PI / 2, true);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x - size / 3, y, size / 3, -Math.PI / 2, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + size / 3, y, size / 3, Math.PI / 2, Math.PI, false);
          ctx.stroke();
        }
        break;
        
      case 2: // Secret door - dashed line
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        if (isHorizontal) {
          ctx.beginPath();
          ctx.moveTo(x, y - size / 2);
          ctx.lineTo(x, y + size / 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - size / 2, y);
          ctx.lineTo(x + size / 2, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        break;
        
      case 3: // Portcullis - grid pattern
        if (isHorizontal) {
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y - size / 2 + i * size / 2);
            ctx.lineTo(x, y - size / 2 + (i + 1) * size / 2);
            ctx.stroke();
          }
        } else {
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x - size / 2 + i * size / 2, y);
            ctx.lineTo(x - size / 2 + (i + 1) * size / 2, y);
            ctx.stroke();
          }
        }
        break;
        
      case 4: // Locked - door with lock symbol
        if (isHorizontal) {
          ctx.beginPath();
          ctx.moveTo(x, y - size / 2);
          ctx.lineTo(x, y + size / 2);
          ctx.stroke();
          // Lock symbol
          ctx.beginPath();
          ctx.arc(x + 3 / zoom, y, 2 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - size / 2, y);
          ctx.lineTo(x + size / 2, y);
          ctx.stroke();
          // Lock symbol
          ctx.beginPath();
          ctx.arc(x, y + 3 / zoom, 2 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        break;
        
      case 6: // Archway - just gap, no door
        // Draw small marks at edges
        if (isHorizontal) {
          ctx.beginPath();
          ctx.moveTo(x - 2 / zoom, y - size / 2);
          ctx.lineTo(x + 2 / zoom, y - size / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 2 / zoom, y + size / 2);
          ctx.lineTo(x + 2 / zoom, y + size / 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - size / 2, y - 2 / zoom);
          ctx.lineTo(x - size / 2, y + 2 / zoom);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + size / 2, y - 2 / zoom);
          ctx.lineTo(x + size / 2, y + 2 / zoom);
          ctx.stroke();
        }
        break;
        
      default:
        // Default to simple line
        if (isHorizontal) {
          ctx.beginPath();
          ctx.moveTo(x, y - size / 2);
          ctx.lineTo(x, y + size / 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - size / 2, y);
          ctx.lineTo(x + size / 2, y);
          ctx.stroke();
        }
    }
    
    ctx.restore();
  });
}

/**
 * Render annotations on the canvas
 */
export function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  zoom: number
) {
  annotations.forEach((annotation) => {
    ctx.save();
    
    const { x, y } = annotation.position;
    const radius = 12 / zoom;
    const fontSize = 10 / zoom;
    
    // Draw circle background
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    
    // Draw reference number
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(annotation.reference, x, y);
    
    ctx.restore();
  });
}

/**
 * Render terrain features on the canvas
 */
export function renderTerrainFeatures(
  ctx: CanvasRenderingContext2D,
  features: TerrainFeature[],
  zoom: number,
  dungeonMapMode: boolean = false,
  style: WatabouStyle = DEFAULT_STYLE,
  regions: CanvasRegion[] = []
) {
  features.forEach((feature) => {
    ctx.save();
    
    switch (feature.type) {
      case 'water':
        renderWaterTiles(ctx, feature.tiles, zoom, dungeonMapMode, style, regions);
        break;
      case 'column':
        renderColumnTiles(ctx, feature.tiles, zoom, regions);
        break;
      case 'debris':
        renderDebrisTiles(ctx, feature.tiles, zoom, dungeonMapMode, style, regions);
        break;
      case 'trap':
        renderTrapTiles(ctx, feature.tiles, zoom, regions);
        break;
    }
    
    ctx.restore();
  });
}

function renderWaterTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  dungeonMapMode: boolean = false,
  style: WatabouStyle = DEFAULT_STYLE,
  regions: CanvasRegion[] = []
) {
  tiles.forEach((tile) => {
    if (dungeonMapMode) {
      // Find region containing this tile for clipping
      const containingRegion = regions.find(region => {
        const tileCenterX = tile.x + 25;
        const tileCenterY = tile.y + 25;
        return isPointInRegion(tileCenterX, tileCenterY, region);
      });
      
      if (containingRegion) {
        ctx.save();
        // Clip to region bounds
        clipToRegion(ctx, containingRegion);
      }
      
      // Fill with water color
      ctx.fillStyle = style.colorWater;
      ctx.fillRect(tile.x, tile.y, 50, 50);
      
      // Wavy line pattern
      ctx.strokeStyle = style.colorInk;
      ctx.lineWidth = style.strokeThin / zoom;
      
      const numWaves = 3;
      for (let i = 0; i < numWaves; i++) {
        ctx.beginPath();
        const y = tile.y + (i + 1) * (50 / (numWaves + 1));
        ctx.moveTo(tile.x, y);
        for (let x = 0; x <= 50; x += 8) {
          const wave = Math.sin((x / 50) * Math.PI * 4) * 2;
          ctx.lineTo(tile.x + x, y + wave);
        }
        ctx.stroke();
      }
      
      if (containingRegion) {
        ctx.restore();
      }
    } else {
      // VTT style - blue with waves
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(tile.x, tile.y, 50, 50);
      
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(tile.x, tile.y + 15);
      ctx.bezierCurveTo(
        tile.x + 12.5, tile.y + 10,
        tile.x + 12.5, tile.y + 20,
        tile.x + 25, tile.y + 15
      );
      ctx.bezierCurveTo(
        tile.x + 37.5, tile.y + 10,
        tile.x + 37.5, tile.y + 20,
        tile.x + 50, tile.y + 15
      );
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(tile.x, tile.y + 35);
      ctx.bezierCurveTo(
        tile.x + 12.5, tile.y + 30,
        tile.x + 12.5, tile.y + 40,
        tile.x + 25, tile.y + 35
      );
      ctx.bezierCurveTo(
        tile.x + 37.5, tile.y + 30,
        tile.x + 37.5, tile.y + 40,
        tile.x + 50, tile.y + 35
      );
      ctx.stroke();
    }
  });
}

function renderColumnTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  regions: CanvasRegion[] = []
) {
  tiles.forEach((tile) => {
    const centerX = tile.x + 25;
    const centerY = tile.y + 25;
    const radius = 8;
    
    // Find region containing this tile for clipping
    const containingRegion = regions.find(region => 
      isPointInRegion(centerX, centerY, region)
    );
    
    if (containingRegion) {
      ctx.save();
      clipToRegion(ctx, containingRegion);
    }
    
    // Draw column as circle
    ctx.fillStyle = '#71717a'; // Gray
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    
    if (containingRegion) {
      ctx.restore();
    }
  });
}

function renderDebrisTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  dungeonMapMode: boolean = false,
  style: WatabouStyle = DEFAULT_STYLE,
  regions: CanvasRegion[] = []
) {
  tiles.forEach((tile) => {
    if (dungeonMapMode) {
      // Find region containing this tile for clipping
      const containingRegion = regions.find(region => {
        const tileCenterX = tile.x + 25;
        const tileCenterY = tile.y + 25;
        return isPointInRegion(tileCenterX, tileCenterY, region);
      });
      
      if (containingRegion) {
        ctx.save();
        clipToRegion(ctx, containingRegion);
      }
      
      // Dungeon map style - dense stippled pattern
      ctx.fillStyle = style.colorInk;
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 40; i++) {
        const x = tile.x + Math.random() * 50;
        const y = tile.y + Math.random() * 50;
        const size = 0.5 + Math.random() * 1.5;
        ctx.fillRect(x, y, size / zoom, size / zoom);
      }
      ctx.globalAlpha = 1.0;
      
      if (containingRegion) {
        ctx.restore();
      }
    } else {
      // VTT style - gray shapes
      ctx.fillStyle = 'rgba(120, 113, 108, 0.5)';
      for (let i = 0; i < 3; i++) {
        const x = tile.x + Math.random() * 50;
        const y = tile.y + Math.random() * 50;
        const size = 5 + Math.random() * 5;
        ctx.fillRect(x, y, size, size);
      }
    }
  });
}

function renderTrapTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  regions: CanvasRegion[] = []
) {
  tiles.forEach((tile) => {
    const centerX = tile.x + 25;
    const centerY = tile.y + 25;
    
    // Find region containing this tile for clipping
    const containingRegion = regions.find(region => 
      isPointInRegion(centerX, centerY, region)
    );
    
    if (containingRegion) {
      ctx.save();
      clipToRegion(ctx, containingRegion);
    }
    
    // Draw trap as warning symbol
    ctx.strokeStyle = '#dc2626'; // Red
    ctx.lineWidth = 2 / zoom;
    
    // Draw X
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY - 10);
    ctx.lineTo(centerX + 10, centerY + 10);
    ctx.moveTo(centerX + 10, centerY - 10);
    ctx.lineTo(centerX - 10, centerY + 10);
    ctx.stroke();
    
    if (containingRegion) {
      ctx.restore();
    }
  });
}

/**
 * Helper to check if a point is inside a region
 */
function isPointInRegion(x: number, y: number, region: CanvasRegion): boolean {
  if (region.regionType === 'rectangle') {
    return x >= region.x && x <= region.x + region.width &&
           y >= region.y && y <= region.y + region.height;
  } else if (region.regionType === 'path' && region.pathPoints) {
    // Point-in-polygon test
    let inside = false;
    const points = region.pathPoints;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > y) !== (yj > y)) && 
                       (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  return false;
}

/**
 * Helper to create a clipping path for a region
 */
function clipToRegion(ctx: CanvasRenderingContext2D, region: CanvasRegion): void {
  ctx.beginPath();
  if (region.regionType === 'rectangle') {
    ctx.rect(region.x, region.y, region.width, region.height);
  } else if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
    ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
    for (let i = 1; i < region.pathPoints.length; i++) {
      ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
    }
    ctx.closePath();
  }
  ctx.clip();
}
