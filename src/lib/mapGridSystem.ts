import { GridRenderer, Viewport } from './gridSystem';
import { GameMap, GridRegion, getComputedBounds } from '../stores/mapStore';
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
    .filter(map => map.active)
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
  const cb = getComputedBounds(map);
  const mapLeft = cb.x;
  const mapRight = cb.x + cb.width;
  const mapTop = cb.y;
  const mapBottom = cb.y + cb.height;
  
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
  
  // Convert computed bounds to screen coordinates
  const cb = getComputedBounds(map);
  const screenLeft = (cb.x - viewport.x) * viewport.zoom;
  const screenTop = (cb.y - viewport.y) * viewport.zoom;
  const screenWidth = cb.width * viewport.zoom;
  const screenHeight = cb.height * viewport.zoom;
  
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
  
  // Calculate grid bounds in local coordinates (relative to minX, minY)
  const localWidth = maxX - minX;
  const localHeight = maxY - minY;
  
  // Calculate how many grid cells fit in each dimension
  const cellsX = Math.floor(localWidth / gridSize);
  const cellsY = Math.floor(localHeight / gridSize);
  
  if (cellsX <= 0 || cellsY <= 0) return; // No complete cells
  
  // Set up drawing
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, 1 / viewport.zoom);
  
  // Draw each individual square cell that falls within the region polygon
  for (let row = 0; row < cellsY; row++) {
    for (let col = 0; col < cellsX; col++) {
      // Calculate cell center position (where tokens snap to)
      const centerX = minX + (col + 0.5) * gridSize;
      const centerY = minY + (row + 0.5) * gridSize;
      
      // Check if cell center is within the polygon region
      if (!isPointInPolygon(centerX, centerY, region.points)) {
        continue;
      }
      
      // Calculate cell boundaries
      const cellLeft = minX + (col * gridSize);
      const cellTop = minY + (row * gridSize);
      const cellRight = cellLeft + gridSize;
      const cellBottom = cellTop + gridSize;
      
      // Convert to screen coordinates
      const screenLeft = (cellLeft - viewport.x) * viewport.zoom;
      const screenTop = (cellTop - viewport.y) * viewport.zoom;
      const screenWidth = gridSize * viewport.zoom;
      const screenHeight = gridSize * viewport.zoom;
      
      // Only draw if cell is visible on screen
      if (screenLeft < renderer.canvas.width && 
          screenLeft + screenWidth > 0 && 
          screenTop < renderer.canvas.height && 
          screenTop + screenHeight > 0) {
        
        // Draw the square cell
        ctx.beginPath();
        ctx.rect(screenLeft, screenTop, screenWidth, screenHeight);
        ctx.stroke();
      }
    }
  }
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
// regionRotation: degrees of rotation for the region (rectangle regions only), with pivot at regionCenter
export function snapToMapGrid(
  x: number,
  y: number,
  regions: { map: GameMap; region: GridRegion } | null,
  regionRotation?: number,
  regionCenter?: { x: number; y: number }
): { x: number; y: number } {
  if (!regions || regions.region.gridType === 'none') {
    return { x, y };
  }
  
  const { region } = regions;
  const rotRad = regionRotation ? (regionRotation * Math.PI) / 180 : 0;
  const hasRotation = !!rotRad && !!regionCenter;

  // For rotated regions, work in local (unrotated) space
  let localX = x;
  let localY = y;
  if (hasRotation) {
    // Rotate point into region-local space (inverse rotation around center)
    const dx = x - regionCenter!.x;
    const dy = y - regionCenter!.y;
    localX = regionCenter!.x + dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad);
    localY = regionCenter!.y + dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad);
  }

  // Check if the point is within the polygon (use original points for path regions,
  // or unrotated point for rectangle regions with rotation)
  if (!isPointInPolygon(hasRotation ? localX : x, hasRotation ? localY : y, region.points)) {
    return { x, y }; // Don't snap if outside the region
  }

  // Helper to rotate a snapped local point back to world space
  const toWorld = (sx: number, sy: number) => {
    if (!hasRotation) return { x: sx, y: sy };
    const dx = sx - regionCenter!.x;
    const dy = sy - regionCenter!.y;
    return {
      x: regionCenter!.x + dx * Math.cos(rotRad) - dy * Math.sin(rotRad),
      y: regionCenter!.y + dx * Math.sin(rotRad) + dy * Math.cos(rotRad),
    };
  };
  
  switch (region.gridType) {
    case 'square': {
      // Calculate bounding box for local coordinates (in unrotated space)
      const minX = Math.min(...region.points.map(p => p.x));
      const minY = Math.min(...region.points.map(p => p.y));
      
      // Snap the local (unrotated) point to grid cell center
      const gridCellX = Math.floor((localX - minX) / region.gridSize);
      const gridCellY = Math.floor((localY - minY) / region.gridSize);
      
      const snappedLocalX = minX + (gridCellX + 0.5) * region.gridSize;
      const snappedLocalY = minY + (gridCellY + 0.5) * region.gridSize;
      
      // Verify the snapped local point is still within the polygon
      if (isPointInPolygon(snappedLocalX, snappedLocalY, region.points)) {
        return toWorld(snappedLocalX, snappedLocalY);
      }
      return { x, y };
    }
      
    case 'hex': {
      // Create hex layout using same coordinate system as rendering
      const layout = createHexLayout(region.gridSize, POINTY_TOP);
      
      // Snap in local space
      const hex = pixelToHex(layout, { x: localX, y: localY });
      const roundedHex = hexRound(hex);
      const snappedLocal = hexToPixel(layout, roundedHex);
      
      // Ensure the snapped point is within the polygon
      if (isPointInPolygon(snappedLocal.x, snappedLocal.y, region.points)) {
        return toWorld(snappedLocal.x, snappedLocal.y);
      }
      
      return { x, y }; // Don't snap if result would be outside region
    }
      
    default:
      return { x, y };
  }
}