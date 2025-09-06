import { GridRenderer, Viewport } from './gridSystem';
import { GameMap, GridRegion } from '../stores/mapStore';
import { 
  createHexLayout, 
  hexesInRectangle, 
  hexCorners, 
  pixelToHex,
  hexRound,
  hexToPixel,
  POINTY_TOP 
} from './hexCoordinates';

// Map-based grid rendering system
export function renderMapGrids(
  renderer: GridRenderer,
  maps: GameMap[],
  viewport: Viewport
): void {
  const { ctx, canvas } = renderer;
  
  // Clear canvas with default background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Render maps in z-index order (lowest first, so highest appears on top)
  const sortedMaps = [...maps]
    .filter(map => map.visible)
    .sort((a, b) => a.zIndex - b.zIndex);
    
  for (const map of sortedMaps) {
    renderSingleMap(renderer, map, viewport);
  }
}

function renderSingleMap(
  renderer: GridRenderer,
  map: GameMap,
  viewport: Viewport
): void {
  const { ctx } = renderer;
  
  // Check if map is visible in viewport
  if (!isMapVisibleInViewport(map, viewport)) {
    return;
  }
  
  // Render map background
  renderMapBackground(renderer, map, viewport);
  
  // Render all visible regions
  const visibleRegions = map.regions.filter(region => region.visible);
  for (const region of visibleRegions) {
    renderGridRegion(renderer, region, viewport);
  }
}

function isMapVisibleInViewport(map: GameMap, viewport: Viewport): boolean {
  const mapLeft = map.bounds.x;
  const mapRight = map.bounds.x + map.bounds.width;
  const mapTop = map.bounds.y;
  const mapBottom = map.bounds.y + map.bounds.height;
  
  const viewLeft = viewport.x;
  const viewRight = viewport.x + (viewport.width / viewport.zoom);
  const viewTop = viewport.y;
  const viewBottom = viewport.y + (viewport.height / viewport.zoom);
  
  // Check if rectangles overlap
  return !(
    mapRight < viewLeft ||
    mapLeft > viewRight ||
    mapBottom < viewTop ||
    mapTop > viewBottom
  );
}

function renderMapBackground(
  renderer: GridRenderer,
  map: GameMap,
  viewport: Viewport
): void {
  const { ctx } = renderer;
  
  // Convert map bounds to screen coordinates
  const screenLeft = (map.bounds.x - viewport.x) * viewport.zoom;
  const screenTop = (map.bounds.y - viewport.y) * viewport.zoom;
  const screenWidth = map.bounds.width * viewport.zoom;
  const screenHeight = map.bounds.height * viewport.zoom;
  
  // Only draw if visible on screen
  if (screenLeft < renderer.canvas.width && 
      screenLeft + screenWidth > 0 && 
      screenTop < renderer.canvas.height && 
      screenTop + screenHeight > 0) {
    
    ctx.fillStyle = map.backgroundColor;
    ctx.fillRect(screenLeft, screenTop, screenWidth, screenHeight);
    
    // Optional: Draw map border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenLeft, screenTop, screenWidth, screenHeight);
  }
}

function renderGridRegion(
  renderer: GridRenderer,
  region: GridRegion,
  viewport: Viewport
): void {
  if (region.gridType === 'none') return;
  
  const gridColor = `rgba(${parseInt(region.gridColor.slice(1, 3), 16)}, ${parseInt(region.gridColor.slice(3, 5), 16)}, ${parseInt(region.gridColor.slice(5, 7), 16)}, ${region.gridOpacity / 100})`;
  
  switch (region.gridType) {
    case 'square':
      renderSquareGridRegion(renderer, region, viewport, gridColor);
      break;
    case 'hex':
      renderHexGridRegion(renderer, region, viewport, gridColor);
      break;
  }
}

function renderSquareGridRegion(
  renderer: GridRenderer,
  region: GridRegion,
  viewport: Viewport,
  color: string
): void {
  const { ctx } = renderer;
  const { bounds, gridSize } = region;
  
  // Calculate visible grid area within region bounds
  const regionLeft = bounds.x;
  const regionRight = bounds.x + bounds.width;
  const regionTop = bounds.y;
  const regionBottom = bounds.y + bounds.height;
  
  const viewLeft = viewport.x;
  const viewRight = viewport.x + (viewport.width / viewport.zoom);
  const viewTop = viewport.y;
  const viewBottom = viewport.y + (viewport.height / viewport.zoom);
  
  // Find intersection of region and viewport
  const left = Math.max(regionLeft, viewLeft);
  const right = Math.min(regionRight, viewRight);
  const top = Math.max(regionTop, viewTop);
  const bottom = Math.min(regionBottom, viewBottom);
  
  if (left >= right || top >= bottom) return; // No intersection
  
  // Calculate grid lines within the region
  const startX = Math.floor(regionLeft / gridSize) * gridSize;
  const endX = Math.ceil(regionRight / gridSize) * gridSize;
  const startY = Math.floor(regionTop / gridSize) * gridSize;
  const endY = Math.ceil(regionBottom / gridSize) * gridSize;
  
  // Set up drawing
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom);
  ctx.beginPath();
  
  // Vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    if (x >= regionLeft && x <= regionRight) {
      const screenX = (x - viewport.x) * viewport.zoom;
      const screenTop = (Math.max(regionTop, viewTop) - viewport.y) * viewport.zoom;
      const screenBottom = (Math.min(regionBottom, viewBottom) - viewport.y) * viewport.zoom;
      
      if (screenX >= 0 && screenX <= renderer.canvas.width) {
        ctx.moveTo(screenX, screenTop);
        ctx.lineTo(screenX, screenBottom);
      }
    }
  }
  
  // Horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    if (y >= regionTop && y <= regionBottom) {
      const screenY = (y - viewport.y) * viewport.zoom;
      const screenLeft = (Math.max(regionLeft, viewLeft) - viewport.x) * viewport.zoom;
      const screenRight = (Math.min(regionRight, viewRight) - viewport.x) * viewport.zoom;
      
      if (screenY >= 0 && screenY <= renderer.canvas.height) {
        ctx.moveTo(screenLeft, screenY);
        ctx.lineTo(screenRight, screenY);
      }
    }
  }
  
  ctx.stroke();
}

function renderHexGridRegion(
  renderer: GridRenderer,
  region: GridRegion,
  viewport: Viewport,
  color: string
): void {
  const { ctx } = renderer;
  const { bounds, gridSize } = region;
  
  // Create hex layout for this region
  const layout = createHexLayout(gridSize, POINTY_TOP);
  
  // Get hexes within region bounds
  const hexes = hexesInRectangle(layout, bounds.x, bounds.y, bounds.width, bounds.height);
  
  // Set up drawing
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom);
  
  // Draw each hex that intersects with region bounds
  hexes.forEach(hex => {
    const corners = hexCorners(layout, hex);
    if (corners.length === 0) return;
    
    // Check if hex center is within region bounds
    const center = corners.reduce(
      (acc, corner) => ({ x: acc.x + corner.x, y: acc.y + corner.y }),
      { x: 0, y: 0 }
    );
    center.x /= corners.length;
    center.y /= corners.length;
    
    if (
      center.x < bounds.x ||
      center.x > bounds.x + bounds.width ||
      center.y < bounds.y ||
      center.y > bounds.y + bounds.height
    ) {
      return;
    }
    
    // Convert to screen coordinates and draw
    ctx.beginPath();
    const firstCorner = corners[0];
    const screenX1 = (firstCorner.x - viewport.x) * viewport.zoom;
    const screenY1 = (firstCorner.y - viewport.y) * viewport.zoom;
    ctx.moveTo(screenX1, screenY1);
    
    for (let i = 1; i < corners.length; i++) {
      const corner = corners[i];
      const screenX = (corner.x - viewport.x) * viewport.zoom;
      const screenY = (corner.y - viewport.y) * viewport.zoom;
      ctx.lineTo(screenX, screenY);
    }
    
    ctx.closePath();
    ctx.stroke();
  });
}

// Token snapping for map-based grids
export function snapToMapGrid(x: number, y: number, regions: { map: GameMap; region: GridRegion } | null): { x: number; y: number } {
  if (!regions || regions.region.gridType === 'none') {
    return { x, y };
  }
  
  const { region } = regions;
  
  // Check if the point is within the region bounds
  if (x < region.bounds.x || x > region.bounds.x + region.bounds.width ||
      y < region.bounds.y || y > region.bounds.y + region.bounds.height) {
    return { x, y }; // Don't snap if outside the region
  }
  
  switch (region.gridType) {
    case 'square':
      // Snap to grid cell centers, not intersections
      // Convert to region-local coordinates
      const localX = x - region.bounds.x;
      const localY = y - region.bounds.y;
      
      // Snap to center of grid cells
      const gridCellX = Math.floor(localX / region.gridSize);
      const gridCellY = Math.floor(localY / region.gridSize);
      
      // Calculate center of the grid cell
      const centerX = (gridCellX + 0.5) * region.gridSize;
      const centerY = (gridCellY + 0.5) * region.gridSize;
      
      // Convert back to world coordinates
      return {
        x: centerX + region.bounds.x,
        y: centerY + region.bounds.y,
      };
      
    case 'hex':
      // Create hex layout with origin at region bounds
      const layout = createHexLayout(region.gridSize, POINTY_TOP);
      layout.origin = { x: region.bounds.x, y: region.bounds.y };
      
      // Convert to hex coordinates and round to nearest hex center
      const hex = pixelToHex(layout, { x, y });
      const roundedHex = hexRound(hex);
      
      // Convert back to pixel coordinates (will be at hex center)
      return hexToPixel(layout, roundedHex);
      
    default:
      return { x, y };
  }
}