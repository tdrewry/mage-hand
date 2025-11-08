import { DoorConnection, Annotation, TerrainFeature, DOOR_TYPE_LABELS } from './dungeonTypes';
import { CanvasRegion } from '@/stores/regionStore';
import { WatabouStyle, DEFAULT_STYLE } from './watabouStyles';

/**
 * Check if two wall segments overlap or are very close (within tolerance)
 */
function segmentsOverlap(
  seg1: { x1: number; y1: number; x2: number; y2: number },
  seg2: { x1: number; y1: number; x2: number; y2: number },
  tolerance: number = 2
): boolean {
  // Check if segments are parallel and overlapping
  const dx1 = seg1.x2 - seg1.x1;
  const dy1 = seg1.y2 - seg1.y1;
  const dx2 = seg2.x2 - seg2.x1;
  const dy2 = seg2.y2 - seg2.y1;
  
  // Normalize segments so p1 is always "before" p2
  const normSeg1 = {
    x1: Math.min(seg1.x1, seg1.x2),
    y1: Math.min(seg1.y1, seg1.y2),
    x2: Math.max(seg1.x1, seg1.x2),
    y2: Math.max(seg1.y1, seg1.y2)
  };
  const normSeg2 = {
    x1: Math.min(seg2.x1, seg2.x2),
    y1: Math.min(seg2.y1, seg2.y2),
    x2: Math.max(seg2.x1, seg2.x2),
    y2: Math.max(seg2.y1, seg2.y2)
  };
  
  // Check if both are vertical (dx ≈ 0)
  if (Math.abs(dx1) < 0.1 && Math.abs(dx2) < 0.1) {
    // Check if x positions are close
    if (Math.abs(normSeg1.x1 - normSeg2.x1) > tolerance) return false;
    
    // Check if y ranges overlap
    const overlap = Math.min(normSeg1.y2, normSeg2.y2) - Math.max(normSeg1.y1, normSeg2.y1);
    return overlap > -tolerance;
  }
  
  // Check if both are horizontal (dy ≈ 0)
  if (Math.abs(dy1) < 0.1 && Math.abs(dy2) < 0.1) {
    // Check if y positions are close
    if (Math.abs(normSeg1.y1 - normSeg2.y1) > tolerance) return false;
    
    // Check if x ranges overlap
    const overlap = Math.min(normSeg1.x2, normSeg2.x2) - Math.max(normSeg1.x1, normSeg2.x1);
    return overlap > -tolerance;
  }
  
  return false;
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
    for (let j = i + 1; j < allSegments.length; j++) {
      // Only check segments from different regions
      if (allSegments[i].regionId !== allSegments[j].regionId) {
        if (segmentsOverlap(allSegments[i], allSegments[j], 3)) {
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
  
  // Draw background
  ctx.fillStyle = style.colorBg;
  ctx.fillRect(-10000, -10000, 20000, 20000);
  
  // Fill all regions with paper color first
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
