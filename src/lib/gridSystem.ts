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

// Check if viewport has changed significantly (optimization)
export function hasViewportChanged(renderer: GridRenderer, viewport: Viewport, threshold: number = 50): boolean {
  if (!renderer.lastViewport) return true;
  
  const last = renderer.lastViewport;
  const dx = Math.abs(viewport.x - last.x);
  const dy = Math.abs(viewport.y - last.y);
  const dzoom = Math.abs(viewport.zoom - last.zoom);
  
  return dx > threshold || dy > threshold || dzoom > 0.1 || 
         viewport.width !== last.width || viewport.height !== last.height;
}

// Render square grid efficiently
export function renderSquareGrid(
  renderer: GridRenderer, 
  size: number, 
  viewport: Viewport, 
  color: string = 'rgba(255, 255, 255, 0.2)'
): void {
  const { ctx, canvas } = renderer;
  
  console.log('renderSquareGrid called:', { size, viewport, color, canvasSize: { width: canvas.width, height: canvas.height } });
  
  // Fill background first
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (size <= 0) {
    console.log('Invalid grid size:', size);
    return;
  }
  
  // Calculate visible area with padding
  const padding = size * 10; // Extra lines beyond visible area
  const visibleLeft = viewport.x - padding;
  const visibleTop = viewport.y - padding;
  const visibleWidth = viewport.width / viewport.zoom + padding * 2;
  const visibleHeight = viewport.height / viewport.zoom + padding * 2;
  
  // Calculate grid boundaries aligned to grid
  const startX = Math.floor(visibleLeft / size) * size;
  const endX = Math.ceil((visibleLeft + visibleWidth) / size) * size;
  const startY = Math.floor(visibleTop / size) * size;
  const endY = Math.ceil((visibleTop + visibleHeight) / size) * size;
  
  console.log('Grid bounds:', { startX, endX, startY, endY, lineCount: { vertical: (endX - startX) / size, horizontal: (endY - startY) / size } });
  
  // Set up drawing style
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1 / viewport.zoom); // Ensure minimum line width
  ctx.globalAlpha = Math.min(1, Math.max(0.3, viewport.zoom * 0.5 + 0.3)); // Better visibility
  
  // Begin path for all lines (much more efficient)
  ctx.beginPath();
  
  // Vertical lines
  for (let x = startX; x <= endX; x += size) {
    const screenX = (x - viewport.x) * viewport.zoom + viewport.width / 2;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
  }
  
  // Horizontal lines  
  for (let y = startY; y <= endY; y += size) {
    const screenY = (y - viewport.y) * viewport.zoom + viewport.height / 2;
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvas.width, screenY);
  }
  
  // Draw all lines at once
  ctx.stroke();
  
  console.log('Square grid lines drawn');
  
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
  
  // Update layout origin to match viewport
  layout.origin = { x: -viewport.x, y: -viewport.y };
  
  // Calculate visible world area
  const padding = size * 3; // Extra hexes beyond visible area
  const worldLeft = viewport.x - padding;
  const worldTop = viewport.y - padding;
  const worldWidth = viewport.width / viewport.zoom + padding * 2;
  const worldHeight = viewport.height / viewport.zoom + padding * 2;
  
  // Get all hexes in the visible area
  const hexes = hexesInRectangle(layout, worldLeft, worldTop, worldWidth, worldHeight);
  
  // Set up drawing style
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1 / viewport.zoom);
  ctx.globalAlpha = Math.min(1, Math.max(0.3, viewport.zoom * 0.5 + 0.3));
  ctx.fillStyle = 'transparent';
  
  // Draw each hex
  hexes.forEach(hex => {
    const corners = hexCorners(layout, hex);
    
    if (corners.length === 0) return;
    
    // Convert world coordinates to screen coordinates
    ctx.beginPath();
    const firstCorner = corners[0];
    const screenX1 = (firstCorner.x - viewport.x) * viewport.zoom + viewport.width / 2;
    const screenY1 = (firstCorner.y - viewport.y) * viewport.zoom + viewport.height / 2;
    ctx.moveTo(screenX1, screenY1);
    
    for (let i = 1; i < corners.length; i++) {
      const corner = corners[i];
      const screenX = (corner.x - viewport.x) * viewport.zoom + viewport.width / 2;
      const screenY = (corner.y - viewport.y) * viewport.zoom + viewport.height / 2;
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
  color: string = 'rgba(255, 255, 255, 0.3)' // Increased opacity for better visibility
): void {
  console.log('renderGrid called:', { type, size, viewport, visible, color });
  
  if (!visible || type === 'none') {
    console.log('Grid not visible or type is none, filling background');
    // Fill with background color when grid is hidden
    renderer.ctx.fillStyle = '#1a1a1a';
    renderer.ctx.fillRect(0, 0, renderer.canvas.width, renderer.canvas.height);
    return;
  }
  
  // Only redraw if viewport changed significantly
  if (!hasViewportChanged(renderer, viewport)) {
    console.log('Viewport unchanged, skipping grid redraw');
    return;
  }
  
  console.log('Drawing grid:', type, 'size:', size);
  
  switch (type) {
    case 'square':
      renderSquareGrid(renderer, size, viewport, color);
      break;
    case 'hex':
      renderHexGrid(renderer, size, viewport, color);
      break;
  }
  
  console.log('Grid rendering completed');
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