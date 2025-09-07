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

// Utility functions for polygon operations
function isPointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    if (((points[i].y > y) !== (points[j].y > y)) &&
        (x < (points[j].x - points[i].x) * (y - points[i].y) / (points[j].y - points[i].y) + points[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

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
  
  const { ctx } = renderer;
  
  // First render the filled polygon region
  renderRegionBackground(renderer, region, viewport);
  
  // Then render the grid overlay
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

function renderRegionBackground(
  renderer: GridRenderer,
  region: GridRegion,
  viewport: Viewport
): void {
  const { ctx } = renderer;
  
  if (region.points.length < 3) return; // Need at least 3 points for a polygon
  
  // Convert region color to rgba with opacity
  const fillColor = `rgba(${parseInt(region.gridColor.slice(1, 3), 16)}, ${parseInt(region.gridColor.slice(3, 5), 16)}, ${parseInt(region.gridColor.slice(5, 7), 16)}, ${Math.min(region.gridOpacity / 100 * 0.3, 0.3)})`;
  
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = `rgba(${parseInt(region.gridColor.slice(1, 3), 16)}, ${parseInt(region.gridColor.slice(3, 5), 16)}, ${parseInt(region.gridColor.slice(5, 7), 16)}, ${Math.min(region.gridOpacity / 100 * 0.8, 0.8)})`;
  ctx.lineWidth = Math.max(1, 2 / viewport.zoom);
  
  // Draw the filled polygon
  ctx.beginPath();
  const firstPoint = region.points[0];
  const screenX1 = (firstPoint.x - viewport.x) * viewport.zoom;
  const screenY1 = (firstPoint.y - viewport.y) * viewport.zoom;
  ctx.moveTo(screenX1, screenY1);
  
  for (let i = 1; i < region.points.length; i++) {
    const point = region.points[i];
    const screenX = (point.x - viewport.x) * viewport.zoom;
    const screenY = (point.y - viewport.y) * viewport.zoom;
    ctx.lineTo(screenX, screenY);
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function renderSquareGridRegion(
  renderer: GridRenderer,
  region: GridRegion,
  viewport: Viewport,
  color: string
): void {
  const { ctx } = renderer;
  const { gridSize } = region;
  
  // Calculate bounding box of the polygon
  const minX = Math.min(...region.points.map(p => p.x));
  const maxX = Math.max(...region.points.map(p => p.x));
  const minY = Math.min(...region.points.map(p => p.y));
  const maxY = Math.max(...region.points.map(p => p.y));
  
  // Calculate visible grid area within region bounds
  const viewLeft = viewport.x;
  const viewRight = viewport.x + (viewport.width / viewport.zoom);
  const viewTop = viewport.y;
  const viewBottom = viewport.y + (viewport.height / viewport.zoom);
  
  // Find intersection of polygon bounds and viewport
  const left = Math.max(minX, viewLeft);
  const right = Math.min(maxX, viewRight);
  const top = Math.max(minY, viewTop);
  const bottom = Math.min(maxY, viewBottom);
  
  if (left >= right || top >= bottom) return; // No intersection
  
  // Calculate grid lines within the polygon bounds
  const startX = Math.floor(minX / gridSize) * gridSize;
  const endX = Math.ceil(maxX / gridSize) * gridSize;
  const startY = Math.floor(minY / gridSize) * gridSize;
  const endY = Math.ceil(maxY / gridSize) * gridSize;
  
  // Set up drawing
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom);
  ctx.beginPath();
  
  // Vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    if (x >= minX && x <= maxX) {
      const screenX = (x - viewport.x) * viewport.zoom;
      const screenTop = (Math.max(minY, viewTop) - viewport.y) * viewport.zoom;
      const screenBottom = (Math.min(maxY, viewBottom) - viewport.y) * viewport.zoom;
      
      if (screenX >= 0 && screenX <= renderer.canvas.width) {
        ctx.moveTo(screenX, screenTop);
        ctx.lineTo(screenX, screenBottom);
      }
    }
  }
  
  // Horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    if (y >= minY && y <= maxY) {
      const screenY = (y - viewport.y) * viewport.zoom;
      const screenLeft = (Math.max(minX, viewLeft) - viewport.x) * viewport.zoom;
      const screenRight = (Math.min(maxX, viewRight) - viewport.x) * viewport.zoom;
      
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
  const { gridSize } = region;
  
  // Calculate bounding box of the polygon
  const minX = Math.min(...region.points.map(p => p.x));
  const maxX = Math.max(...region.points.map(p => p.x));
  const minY = Math.min(...region.points.map(p => p.y));
  const maxY = Math.max(...region.points.map(p => p.y));
  
  // Create hex layout for this region
  const layout = createHexLayout(gridSize, POINTY_TOP);
  
  // Get hexes within polygon bounds
  const hexes = hexesInRectangle(layout, minX, minY, maxX - minX, maxY - minY);
  
  // Set up drawing
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom);
  
  // Draw each hex that intersects with region bounds
  hexes.forEach(hex => {
    const corners = hexCorners(layout, hex);
    if (corners.length === 0) return;
    
    // Check if hex center is within polygon
    const center = corners.reduce(
      (acc, corner) => ({ x: acc.x + corner.x, y: acc.y + corner.y }),
      { x: 0, y: 0 }
    );
    center.x /= corners.length;
    center.y /= corners.length;
    
    // Check if hex center is within polygon
    if (!isPointInPolygon(center.x, center.y, region.points)) {
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
  
  // Check if the point is within the polygon
  if (!isPointInPolygon(x, y, region.points)) {
    return { x, y }; // Don't snap if outside the region
  }
  
  switch (region.gridType) {
    case 'square':
      // Calculate bounding box for local coordinates
      const minX = Math.min(...region.points.map(p => p.x));
      const minY = Math.min(...region.points.map(p => p.y));
      
      // Convert to region-local coordinates
      const localX = x - minX;
      const localY = y - minY;
      
      // Snap to center of grid cells
      const gridCellX = Math.floor(localX / region.gridSize);
      const gridCellY = Math.floor(localY / region.gridSize);
      
      // Calculate center of the grid cell
      const centerX = (gridCellX + 0.5) * region.gridSize;
      const centerY = (gridCellY + 0.5) * region.gridSize;
      
      // Convert back to world coordinates
      const snappedX = centerX + minX;
      const snappedY = centerY + minY;
      
      // Verify the snapped point is still within the polygon
      if (isPointInPolygon(snappedX, snappedY, region.points)) {
        return { x: snappedX, y: snappedY };
      }
      return { x, y };
      
    case 'hex':
      // Create hex layout using same coordinate system as rendering
      const layout = createHexLayout(region.gridSize, POINTY_TOP);
      
      // Convert to hex coordinates and round to nearest hex center
      const hex = pixelToHex(layout, { x, y });
      const roundedHex = hexRound(hex);
      
      // Convert back to pixel coordinates (will be at hex center)
      const snappedPoint = hexToPixel(layout, roundedHex);
      
      // Ensure the snapped point is within the polygon
      if (isPointInPolygon(snappedPoint.x, snappedPoint.y, region.points)) {
        return snappedPoint;
      }
      
      return { x, y }; // Don't snap if result would be outside region
      
    default:
      return { x, y };
  }
}