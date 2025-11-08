import { DoorConnection, Annotation, TerrainFeature, DOOR_TYPE_LABELS } from './dungeonTypes';
import { CanvasRegion } from '@/stores/regionStore';

/**
 * Calculate wall segments from regions for dungeon map rendering
 */
function calculateWallSegments(regions: CanvasRegion[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  
  regions.forEach((region) => {
    if (region.regionType === 'rectangle') {
      // Add four walls for rectangle
      segments.push(
        { x1: region.x, y1: region.y, x2: region.x + region.width, y2: region.y },
        { x1: region.x + region.width, y1: region.y, x2: region.x + region.width, y2: region.y + region.height },
        { x1: region.x + region.width, y1: region.y + region.height, x2: region.x, y2: region.y + region.height },
        { x1: region.x, y1: region.y + region.height, x2: region.x, y2: region.y }
      );
    } else if (region.regionType === 'path' && region.pathPoints) {
      // Add segments for each path edge
      for (let i = 0; i < region.pathPoints.length; i++) {
        const p1 = region.pathPoints[i];
        const p2 = region.pathPoints[(i + 1) % region.pathPoints.length];
        segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }
  });
  
  return segments;
}

/**
 * Draw hatching pattern for walls
 */
function drawHatching(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: number,
  wallThickness: number
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;
  
  const dx = Math.cos(perpAngle) * wallThickness / 2;
  const dy = Math.sin(perpAngle) * wallThickness / 2;
  
  // Draw hatching lines
  const hatchSpacing = 8 / zoom;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const numHatches = Math.floor(length / hatchSpacing);
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5 / zoom;
  
  for (let i = 0; i <= numHatches; i++) {
    const t = i / numHatches;
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;
    
    ctx.beginPath();
    ctx.moveTo(mx + dx * 0.3, my + dy * 0.3);
    ctx.lineTo(mx + dx * 0.9, my + dy * 0.9);
    ctx.stroke();
  }
}

/**
 * Render regions in dungeon map style with thick hatched walls
 */
export function renderDungeonMapRegions(
  ctx: CanvasRenderingContext2D,
  regions: CanvasRegion[],
  zoom: number
) {
  const wallThickness = 6 / zoom;
  
  ctx.save();
  
  // Fill all regions with white first
  regions.forEach((region) => {
    ctx.fillStyle = '#ffffff';
    
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
  
  // Draw thick black walls
  const segments = calculateWallSegments(regions);
  
  segments.forEach((seg) => {
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    const perpAngle = angle + Math.PI / 2;
    
    const dx = Math.cos(perpAngle) * wallThickness / 2;
    const dy = Math.sin(perpAngle) * wallThickness / 2;
    
    // Draw thick wall
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(seg.x1 - dx, seg.y1 - dy);
    ctx.lineTo(seg.x2 - dx, seg.y2 - dy);
    ctx.lineTo(seg.x2 + dx, seg.y2 + dy);
    ctx.lineTo(seg.x1 + dx, seg.y1 + dy);
    ctx.closePath();
    ctx.fill();
    
    // Add hatching
    drawHatching(ctx, seg.x1, seg.y1, seg.x2, seg.y2, zoom, wallThickness);
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
  zoom: number
) {
  doors.forEach((door) => {
    ctx.save();
    
    const size = 16 / zoom;
    const lineWidth = 2 / zoom;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lineWidth;
    ctx.fillStyle = '#ffffff';
    
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
        ctx.setLineDash([3 / zoom, 3 / zoom]);
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
  dungeonMapMode: boolean = false
) {
  features.forEach((feature) => {
    ctx.save();
    
    switch (feature.type) {
      case 'water':
        renderWaterTiles(ctx, feature.tiles, zoom, dungeonMapMode);
        break;
      case 'column':
        renderColumnTiles(ctx, feature.tiles, zoom);
        break;
      case 'debris':
        renderDebrisTiles(ctx, feature.tiles, zoom, dungeonMapMode);
        break;
      case 'trap':
        renderTrapTiles(ctx, feature.tiles, zoom);
        break;
    }
    
    ctx.restore();
  });
}

function renderWaterTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  dungeonMapMode: boolean = false
) {
  tiles.forEach((tile) => {
    if (dungeonMapMode) {
      // Dungeon map style - diagonal hatching
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1 / zoom;
      
      const spacing = 6 / zoom;
      for (let offset = -50; offset < 100; offset += spacing) {
        ctx.beginPath();
        ctx.moveTo(tile.x + offset, tile.y);
        ctx.lineTo(tile.x + offset + 50, tile.y + 50);
        ctx.stroke();
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
  zoom: number
) {
  tiles.forEach((tile) => {
    const centerX = tile.x + 25;
    const centerY = tile.y + 25;
    const radius = 8;
    
    // Draw column as circle
    ctx.fillStyle = '#71717a'; // Gray
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
  });
}

function renderDebrisTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  dungeonMapMode: boolean = false
) {
  tiles.forEach((tile) => {
    if (dungeonMapMode) {
      // Dungeon map style - stippled pattern
      ctx.fillStyle = '#333333';
      for (let i = 0; i < 20; i++) {
        const x = tile.x + Math.random() * 50;
        const y = tile.y + Math.random() * 50;
        ctx.fillRect(x, y, 1 / zoom, 1 / zoom);
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
  zoom: number
) {
  tiles.forEach((tile) => {
    const centerX = tile.x + 25;
    const centerY = tile.y + 25;
    
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
  });
}
