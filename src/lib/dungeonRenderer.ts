import { DoorConnection, Annotation, TerrainFeature, DOOR_TYPE_LABELS } from './dungeonTypes';

/**
 * Render doors on the canvas
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
  zoom: number
) {
  features.forEach((feature) => {
    ctx.save();
    
    switch (feature.type) {
      case 'water':
        renderWaterTiles(ctx, feature.tiles, zoom);
        break;
      case 'column':
        renderColumnTiles(ctx, feature.tiles, zoom);
        break;
      case 'debris':
        renderDebrisTiles(ctx, feature.tiles, zoom);
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
  zoom: number
) {
  // Draw water with wave pattern
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue with transparency
  
  tiles.forEach((tile) => {
    ctx.fillRect(tile.x, tile.y, 50, 50); // Assuming 50px grid size from importer
    
    // Draw wave lines
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
  zoom: number
) {
  tiles.forEach((tile) => {
    // Draw debris as random small shapes
    ctx.fillStyle = 'rgba(120, 113, 108, 0.5)';
    
    for (let i = 0; i < 3; i++) {
      const x = tile.x + Math.random() * 50;
      const y = tile.y + Math.random() * 50;
      const size = 5 + Math.random() * 5;
      
      ctx.fillRect(x, y, size, size);
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
