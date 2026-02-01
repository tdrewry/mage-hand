/**
 * Rendering functions for MapObject entities
 */

import { MapObject } from '@/types/mapObjectTypes';
import { WatabouStyle, DEFAULT_STYLE } from './watabouStyles';

/**
 * Render a door shape (rectangular with open/closed visual state)
 */
function renderDoorShape(
  ctx: CanvasRenderingContext2D,
  mapObject: MapObject,
  zoom: number,
  isDMView: boolean = false
) {
  const { width, height, isOpen, fillColor, strokeColor } = mapObject;
  
  if (isOpen) {
    // Draw open door - thin line at the edge to indicate doorway
    ctx.save();
    
    // Draw doorway opening (dashed line where door was)
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw door panel swung open (small rectangle at edge)
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 / zoom;
    
    // Draw hinges and swung door
    ctx.beginPath();
    ctx.arc(-width / 2, 0, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();
    
    // Swung door panel (rotated 90 degrees from closed position)
    ctx.save();
    ctx.translate(-width / 2, 0);
    ctx.rotate(-Math.PI / 2);
    ctx.fillRect(0, -height / 2, width * 0.7, height);
    ctx.strokeRect(0, -height / 2, width * 0.7, height);
    ctx.restore();
    
    ctx.restore();
  } else {
    // Draw closed door - solid rectangle blocking the doorway
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    
    // Draw door handle/detail
    ctx.beginPath();
    ctx.arc(width / 4, 0, 2 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();
  }
  
  // DM view: always show interactive indicator
  if (isDMView) {
    // Draw a small icon indicator showing the door is interactive
    const indicatorSize = 8 / zoom;
    const indicatorY = -height / 2 - indicatorSize - 4 / zoom;
    
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = isOpen ? '#22c55e' : '#f59e0b'; // Green for open, amber for closed
    
    // Draw small door icon
    ctx.beginPath();
    ctx.roundRect(
      -indicatorSize / 2, 
      indicatorY - indicatorSize / 2, 
      indicatorSize, 
      indicatorSize, 
      2 / zoom
    );
    ctx.fill();
    
    // Draw lock/unlock symbol inside
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${6 / zoom}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isOpen ? '○' : '●', 0, indicatorY);
  }
}

/**
 * Render a single map object to the canvas
 */
export function renderMapObject(
  ctx: CanvasRenderingContext2D,
  mapObject: MapObject,
  zoom: number,
  selected: boolean = false,
  style: WatabouStyle = DEFAULT_STYLE,
  isDMView: boolean = false
) {
  const { position, width, height, shape, fillColor, strokeColor, strokeWidth, opacity, rotation } = mapObject;
  
  ctx.save();
  
  // Apply opacity
  ctx.globalAlpha = opacity;
  
  // Move to position and apply rotation if any
  ctx.translate(position.x, position.y);
  if (rotation) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  
  // Draw shape
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth / zoom;
  
  if (shape === 'door') {
    renderDoorShape(ctx, mapObject, zoom, isDMView);
  } else {
    ctx.beginPath();
    
    switch (shape) {
      case 'circle':
        const radius = Math.min(width, height) / 2;
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        break;
        
      case 'rectangle':
        ctx.rect(-width / 2, -height / 2, width, height);
        break;
        
      case 'custom':
        if (mapObject.customPath && mapObject.customPath.length > 2) {
          ctx.moveTo(mapObject.customPath[0].x, mapObject.customPath[0].y);
          for (let i = 1; i < mapObject.customPath.length; i++) {
            ctx.lineTo(mapObject.customPath[i].x, mapObject.customPath[i].y);
          }
          ctx.closePath();
        } else {
          // Fallback to rectangle
          ctx.rect(-width / 2, -height / 2, width, height);
        }
        break;
    }
    
    ctx.fill();
    ctx.stroke();
  }
  
  // Draw selection indicator
  if (selected) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3b82f6'; // Blue selection color
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    
    const selectionPadding = 4;
    
    if (shape === 'circle') {
      const radius = Math.min(width, height) / 2 + selectionPadding;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(
        -width / 2 - selectionPadding,
        -height / 2 - selectionPadding,
        width + selectionPadding * 2,
        height + selectionPadding * 2
      );
    }
    
    ctx.setLineDash([]);
  }
  
  ctx.restore();
}

/**
 * Render all map objects
 */
export function renderMapObjects(
  ctx: CanvasRenderingContext2D,
  mapObjects: MapObject[],
  zoom: number,
  selectedIds: string[] = [],
  style: WatabouStyle = DEFAULT_STYLE,
  isDMView: boolean = false
) {
  // Sort so selected objects render on top
  const sortedObjects = [...mapObjects].sort((a, b) => {
    const aSelected = selectedIds.includes(a.id) ? 1 : 0;
    const bSelected = selectedIds.includes(b.id) ? 1 : 0;
    return aSelected - bSelected;
  });
  
  sortedObjects.forEach((obj) => {
    renderMapObject(ctx, obj, zoom, selectedIds.includes(obj.id), style, isDMView);
  });
}

/**
 * Generate shadow path for a map object (for use with negative space shadow rendering)
 */
export function getMapObjectShadowPath(
  mapObject: MapObject,
  shadowDistance: number,
  lightAngle: number // degrees, 0 = top, 90 = right
): Path2D {
  const path = new Path2D();
  const { position, width, height, shape, rotation } = mapObject;
  
  // Calculate shadow offset based on light direction
  const angleRad = (lightAngle * Math.PI) / 180;
  const offsetX = Math.sin(angleRad) * shadowDistance;
  const offsetY = -Math.cos(angleRad) * shadowDistance;
  
  // For doors, only cast shadow when closed
  if (shape === 'door' && mapObject.isOpen) {
    return path; // Return empty path for open doors
  }
  
  switch (shape) {
    case 'circle':
      const radius = Math.min(width, height) / 2;
      path.arc(
        position.x + offsetX,
        position.y + offsetY,
        radius,
        0,
        Math.PI * 2
      );
      break;
      
    case 'rectangle':
    case 'door':
    default:
      // For rotated rectangles, we need to transform the corners
      if (rotation) {
        const rotRad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);
        
        const corners = [
          { x: -width / 2, y: -height / 2 },
          { x: width / 2, y: -height / 2 },
          { x: width / 2, y: height / 2 },
          { x: -width / 2, y: height / 2 },
        ];
        
        const transformedCorners = corners.map((c) => ({
          x: position.x + (c.x * cos - c.y * sin) + offsetX,
          y: position.y + (c.x * sin + c.y * cos) + offsetY,
        }));
        
        path.moveTo(transformedCorners[0].x, transformedCorners[0].y);
        for (let i = 1; i < transformedCorners.length; i++) {
          path.lineTo(transformedCorners[i].x, transformedCorners[i].y);
        }
        path.closePath();
      } else {
        path.rect(
          position.x - width / 2 + offsetX,
          position.y - height / 2 + offsetY,
          width,
          height
        );
      }
      break;
  }
  
  return path;
}

/**
 * Render shadows for all shadow-casting map objects
 */
export function renderMapObjectShadows(
  ctx: CanvasRenderingContext2D,
  mapObjects: MapObject[],
  shadowDistance: number,
  lightAngle: number,
  shadowColor: string = 'rgba(0, 0, 0, 0.3)'
) {
  const shadowCasters = mapObjects.filter((obj) => obj.castsShadow);
  
  if (shadowCasters.length === 0) return;
  
  ctx.save();
  ctx.fillStyle = shadowColor;
  
  shadowCasters.forEach((obj) => {
    const shadowPath = getMapObjectShadowPath(obj, shadowDistance, lightAngle);
    ctx.fill(shadowPath);
  });
  
  ctx.restore();
}

/**
 * Hit test for a point against a map object
 * @param isDMView - If true, includes the DM indicator area for doors
 * @param zoom - Current zoom level (needed to calculate indicator hit area)
 */
export function isPointInMapObject(
  x: number,
  y: number,
  mapObject: MapObject,
  isDMView: boolean = false,
  zoom: number = 1
): boolean {
  const { position, width, height, shape, rotation } = mapObject;
  
  // Transform point to object's local coordinate system
  let localX = x - position.x;
  let localY = y - position.y;
  
  if (rotation) {
    const angleRad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const newX = localX * cos - localY * sin;
    const newY = localX * sin + localY * cos;
    localX = newX;
    localY = newY;
  }
  
  // For doors in DM view, also check if clicking on the indicator
  if (shape === 'door' && isDMView) {
    const indicatorSize = 8 / zoom;
    const indicatorY = -height / 2 - indicatorSize - 4 / zoom;
    const indicatorHitRadius = indicatorSize;
    
    // Check if click is on indicator
    if (
      Math.abs(localX) <= indicatorHitRadius &&
      Math.abs(localY - indicatorY) <= indicatorHitRadius
    ) {
      return true;
    }
  }
  
  // For doors, use a larger hit area for easier selection
  const hitWidth = shape === 'door' ? Math.max(width, 20) : width;
  const hitHeight = shape === 'door' ? Math.max(height, 20) : height;
  
  switch (shape) {
    case 'circle':
      const radius = Math.min(width, height) / 2;
      return localX * localX + localY * localY <= radius * radius;
      
    case 'rectangle':
    case 'door':
    default:
      return (
        localX >= -hitWidth / 2 &&
        localX <= hitWidth / 2 &&
        localY >= -hitHeight / 2 &&
        localY <= hitHeight / 2
      );
  }
}

/**
 * Find map object at a given point
 * @param isDMView - If true, includes the DM indicator area for doors
 * @param zoom - Current zoom level (needed for indicator hit detection)
 */
export function findMapObjectAtPoint(
  x: number,
  y: number,
  mapObjects: MapObject[],
  isDMView: boolean = false,
  zoom: number = 1
): MapObject | null {
  // Search in reverse order so top-most (selected) objects are found first
  for (let i = mapObjects.length - 1; i >= 0; i--) {
    if (isPointInMapObject(x, y, mapObjects[i], isDMView, zoom)) {
      return mapObjects[i];
    }
  }
  return null;
}

/**
 * Get bounding box for a map object (useful for viewport culling)
 */
export function getMapObjectBounds(mapObject: MapObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const { position, width, height, rotation } = mapObject;
  
  if (rotation) {
    // For rotated objects, calculate the axis-aligned bounding box
    const angleRad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const rotatedWidth = width * cos + height * sin;
    const rotatedHeight = width * sin + height * cos;
    
    return {
      x: position.x - rotatedWidth / 2,
      y: position.y - rotatedHeight / 2,
      width: rotatedWidth,
      height: rotatedHeight,
    };
  }
  
  return {
    x: position.x - width / 2,
    y: position.y - height / 2,
    width,
    height,
  };
}
