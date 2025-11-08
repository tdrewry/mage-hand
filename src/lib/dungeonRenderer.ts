import { DoorConnection, Annotation, TerrainFeature, DOOR_TYPE_LABELS } from './dungeonTypes';
import { CanvasRegion } from '@/stores/regionStore';
import { WatabouStyle, DEFAULT_STYLE } from './watabouStyles';
import { generateWallGeometry, applyWallHatching, generateFloorGeometry, FloorGeometry } from './wallGeometry';

/**
 * Helper: Blend two hex colors
 */
function blendColors(color1: string, color2: string, ratio: number): string {
  const hex = (c: string) => {
    const h = c.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  };
  
  const c1 = hex(color1);
  const c2 = hex(color2);
  
  const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
  const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
  const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Helper: Get bounding box for any region type
 */
function getRegionBounds(region: CanvasRegion): { x: number; y: number; width: number; height: number } {
  if (region.regionType === 'rectangle') {
    return { x: region.x, y: region.y, width: region.width, height: region.height };
  } else if (region.regionType === 'path' && region.pathPoints) {
    const xs = region.pathPoints.map(p => p.x);
    const ys = region.pathPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: region.x, y: region.y, width: region.width || 0, height: region.height || 0 };
}

/**
 * Render regions in dungeon map style with thick hatched walls using negative space
 */
export function renderDungeonMapRegions(
  ctx: CanvasRenderingContext2D,
  regions: CanvasRegion[],
  zoom: number,
  style: WatabouStyle = DEFAULT_STYLE
) {
  if (regions.length === 0) return;
  
  const wallThickness = (style.strokeThick * 2) / zoom;
  
  ctx.save();
  
  // 1. Generate wall geometry (negative space)
  const wallGeometry = generateWallGeometry(regions, wallThickness, style.wallMargin);
  
  // 2. Generate unified floor geometry (inverse of walls)
  const floorGeometry = generateFloorGeometry(wallGeometry);
  
  // 3. Fill floor as single unified shape
  ctx.fillStyle = style.colorPaper;
  ctx.fill(floorGeometry.floorPath, 'evenodd');
  
  // 4. Draw shadow layer (optional, under walls)
  if (style.shadowDist > 0) {
    ctx.save();
    ctx.fillStyle = style.shadowColor;
    ctx.globalAlpha = 0.3;
    ctx.translate((style.shadowDist * 10) / zoom, (style.shadowDist * 10) / zoom);
    ctx.fill(wallGeometry.wallPath, 'evenodd');
    ctx.restore();
  }
  
  // 5. Fill wall base (main wall color)
  ctx.fillStyle = style.colorShading;
  ctx.fill(wallGeometry.wallPath, 'evenodd');
  
  // 6. Stroke wall outline
  ctx.strokeStyle = style.colorInk;
  ctx.lineWidth = style.strokeNormal / zoom;
  ctx.stroke(wallGeometry.wallPath);
  
  // 7. Apply hatching to walls
  applyWallHatching(ctx, wallGeometry, style, zoom);
  
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
