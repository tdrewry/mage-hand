// Efficient grid rendering system using HTML5 Canvas 2D context
// Replaces individual Fabric.js objects with direct canvas drawing

import { 
  HexLayout, 
  HexCoordinate, 
  Point, 
  createHexLayout, 
  hexToPixel, 
  pixelToHex, 
  hexRound, 
  hexCorners,
  hexesInRectangle,
  POINTY_TOP 
} from './hexCoordinates';

export type GridType = 'square' | 'hex' | 'none';

export interface GridRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hexLayout?: HexLayout;
  lastViewport?: { x: number; y: number; zoom: number; width: number; height: number };
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

// Create a grid renderer
export function createGridRenderer(canvas: HTMLCanvasElement): GridRenderer | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  return {
    canvas,
    ctx
  };
}

// Check if viewport has changed enough to warrant redraw
export function hasViewportChanged(renderer: GridRenderer, viewport: Viewport, threshold: number = 20): boolean {
  if (!renderer.lastViewport) return true;
  
  const last = renderer.lastViewport;
  const deltaX = Math.abs(viewport.x - last.x);
  const deltaY = Math.abs(viewport.y - last.y);
  const deltaZoom = Math.abs(viewport.zoom - last.zoom);
  
  // More permissive thresholds for better responsiveness
  return deltaX > threshold || deltaY > threshold || deltaZoom > 0.01;
}

// Render square grid efficiently
export function renderSquareGrid(
  renderer: GridRenderer, 
  size: number, 
  viewport: Viewport, 
  color: string = 'rgba(255, 255, 255, 0.8)'
): void {
  const { ctx, canvas } = renderer;
  
  // Fill background first
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (size <= 0) return;
  
  // Calculate the world coordinates that are visible on screen
  // Fabric.js viewport transform: [zoom, 0, 0, zoom, panX, panY]
  const worldLeft = viewport.x;
  const worldTop = viewport.y;
  const worldRight = worldLeft + (viewport.width / viewport.zoom);
  const worldBottom = worldTop + (viewport.height / viewport.zoom);
  
  // Extend the grid slightly beyond visible area for smooth panning
  const padding = size * 2;
  const gridLeft = Math.floor((worldLeft - padding) / size) * size;
  const gridRight = Math.ceil((worldRight + padding) / size) * size;
  const gridTop = Math.floor((worldTop - padding) / size) * size;
  const gridBottom = Math.ceil((worldBottom + padding) / size) * size;
  
  // Set up drawing style
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom); // Scale line width with zoom
  ctx.globalAlpha = 1.0;
  
  // Begin path for all lines
  ctx.beginPath();
  
  // Draw vertical lines
  for (let x = gridLeft; x <= gridRight; x += size) {
    // Convert world coordinate to screen coordinate
    const screenX = (x - worldLeft) * viewport.zoom;
    if (screenX >= -1 && screenX <= canvas.width + 1) { // Only draw if on screen
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvas.height);
    }
  }
  
  // Draw horizontal lines  
  for (let y = gridTop; y <= gridBottom; y += size) {
    // Convert world coordinate to screen coordinate
    const screenY = (y - worldTop) * viewport.zoom;
    if (screenY >= -1 && screenY <= canvas.height + 1) { // Only draw if on screen
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvas.width, screenY);
    }
  }
  
  // Draw all lines at once
  ctx.stroke();
  
  // Update last viewport
  renderer.lastViewport = { ...viewport };
}

// Render hex grid efficiently using RedBlob coordinates
export function renderHexGrid(
  renderer: GridRenderer, 
  size: number, 
  viewport: Viewport, 
  color: string = 'rgba(255, 255, 255, 0.2)'
): void {
  const { ctx, canvas } = renderer;
  
  // Fill background first
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (size <= 0) return;
  
  // Create hex layout if not exists or size changed
  if (!renderer.hexLayout || renderer.hexLayout.size.x !== size) {
    renderer.hexLayout = createHexLayout(size, POINTY_TOP);
  }
  
  const layout = renderer.hexLayout;
  
  // Calculate visible world coordinates
  const worldLeft = viewport.x;
  const worldTop = viewport.y;
  const worldRight = worldLeft + (viewport.width / viewport.zoom);
  const worldBottom = worldTop + (viewport.height / viewport.zoom);
  
  // Extend the grid slightly beyond visible area for smooth panning
  const padding = size * 2;
  const hexLeft = worldLeft - padding;
  const hexTop = worldTop - padding;
  const hexWidth = (worldRight - worldLeft) + padding * 2;
  const hexHeight = (worldBottom - worldTop) + padding * 2;
  
  // Get all hexes in the visible area
  const hexes = hexesInRectangle(layout, hexLeft, hexTop, hexWidth, hexHeight);
  
  // Set up drawing style
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = 'transparent';
  
  // Draw each hex
  hexes.forEach(hex => {
    const corners = hexCorners(layout, hex);
    
    if (corners.length === 0) return;
    
    // Convert world coordinates to screen coordinates
    ctx.beginPath();
    const firstCorner = corners[0];
    const screenX1 = (firstCorner.x - worldLeft) * viewport.zoom;
    const screenY1 = (firstCorner.y - worldTop) * viewport.zoom;
    
    // Only draw if at least one corner is on screen
    let hasVisibleCorner = false;
    for (const corner of corners) {
      const screenX = (corner.x - worldLeft) * viewport.zoom;
      const screenY = (corner.y - worldTop) * viewport.zoom;
      if (screenX >= -size && screenX <= canvas.width + size && 
          screenY >= -size && screenY <= canvas.height + size) {
        hasVisibleCorner = true;
        break;
      }
    }
    
    if (!hasVisibleCorner) return;
    
    ctx.moveTo(screenX1, screenY1);
    
    for (let i = 1; i < corners.length; i++) {
      const corner = corners[i];
      const screenX = (corner.x - worldLeft) * viewport.zoom;
      const screenY = (corner.y - worldTop) * viewport.zoom;
      ctx.lineTo(screenX, screenY);
    }
    
    ctx.closePath();
    ctx.stroke();
  });
  
  // Update last viewport
  renderer.lastViewport = { ...viewport };
}

// Snap coordinates to square grid
export function snapToSquareGrid(x: number, y: number, size: number): Point {
  return {
    x: Math.round(x / size) * size,
    y: Math.round(y / size) * size
  };
}

// Snap coordinates to hex grid using proper hex math
export function snapToHexGrid(x: number, y: number, size: number): Point {
  const layout = createHexLayout(size, POINTY_TOP);
  const hex = pixelToHex(layout, { x, y });
  const roundedHex = hexRound(hex);
  return hexToPixel(layout, roundedHex);
}

// Main grid rendering function
export function renderGrid(
  renderer: GridRenderer,
  type: GridType,
  size: number,
  viewport: Viewport,
  visible: boolean = true,
  color: string = 'rgba(255, 255, 255, 0.8)'
): void {
  // Always fill background first
  renderer.ctx.fillStyle = '#1a1a1a';
  renderer.ctx.fillRect(0, 0, renderer.canvas.width, renderer.canvas.height);
  
  if (!visible || type === 'none') {
    // Update viewport even when not drawing grid
    renderer.lastViewport = { ...viewport };
    return;
  }
  
  // Always redraw for hex grids to ensure they show, be more selective for square grids
  const shouldRedraw = type === 'hex' || hasViewportChanged(renderer, viewport);
  if (!shouldRedraw) {
    return;
  }
  
  switch (type) {
    case 'square':
      renderSquareGrid(renderer, size, viewport, color);
      break;
    case 'hex':
      renderHexGrid(renderer, size, viewport, color);
      break;
  }
}

// Snap to grid based on type
export function snapToGrid(x: number, y: number, size: number, type: GridType): Point {
  switch (type) {
    case 'square':
      return snapToSquareGrid(x, y, size);
    case 'hex':
      return snapToHexGrid(x, y, size);
    default:
      return { x, y };
  }
}