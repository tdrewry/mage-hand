/**
 * Rendering functions for MapObject entities
 */

import { MapObject } from '@/types/mapObjectTypes';
import { WatabouStyle, DEFAULT_STYLE } from './watabouStyles';

/**
 * Door toggle animation state - tracks recently toggled doors for visual feedback
 */
interface DoorAnimationState {
  startTime: number;
  isOpening: boolean; // true = opening, false = closing
}

const doorAnimations = new Map<string, DoorAnimationState>();
const DOOR_ANIMATION_DURATION = 300; // ms

/**
 * Trigger a door toggle animation
 */
export function triggerDoorAnimation(doorId: string, isOpening: boolean) {
  doorAnimations.set(doorId, {
    startTime: performance.now(),
    isOpening,
  });
}

/**
 * Get animation progress for a door (0-1, or null if not animating)
 */
function getDoorAnimationProgress(doorId: string): { progress: number; isOpening: boolean } | null {
  const animation = doorAnimations.get(doorId);
  if (!animation) return null;
  
  const elapsed = performance.now() - animation.startTime;
  if (elapsed >= DOOR_ANIMATION_DURATION) {
    doorAnimations.delete(doorId);
    return null;
  }
  
  return {
    progress: elapsed / DOOR_ANIMATION_DURATION,
    isOpening: animation.isOpening,
  };
}

/**
 * Render a door shape (rectangular with open/closed visual state)
 * All coordinates are in local space - the parent transform handles position and rotation.
 * This means the door will render correctly at any angle, not just grid-aligned.
 * 
 * Local coordinate system:
 * - X axis runs along the doorway (width = door span)
 * - Y axis is perpendicular (height = door thickness)
 * - Origin is at door center
 * - Pivot point is at local left edge (-width/2, 0)
 */
function renderDoorShape(
  ctx: CanvasRenderingContext2D,
  mapObject: MapObject,
  zoom: number,
  isDMView: boolean = false
) {
  const { id, width, height, isOpen, fillColor, strokeColor, doorDirection, rotation } = mapObject;
  
  // Detect if this is a vertical door (legacy doors used swapped width/height, new doors use rotation)
  // A vertical door either has rotation=90 OR has doorDirection.x dominant with no rotation
  const isVerticalDoor = rotation === 90 || 
    (rotation === 0 && doorDirection && Math.abs(doorDirection.x) > Math.abs(doorDirection.y));
  
  // For legacy vertical doors (rotation=0 but vertical via swapped dimensions), 
  // the width/height are swapped. We need to use the larger dimension as doorLength.
  // For new doors with rotation=90, width is already the door span.
  let doorLength: number;
  let doorThickness: number;
  
  if (isVerticalDoor && rotation === 0) {
    // Legacy vertical door: width and height were swapped during import
    // The larger dimension is the door span
    doorLength = Math.max(width, height);
    doorThickness = Math.min(width, height);
  } else {
    // Standard door (horizontal, or vertical with proper rotation)
    doorLength = width;
    doorThickness = height;
  }
  
  const openDoorLength = doorLength * 0.5; // Half length when open
  
  // Pivot is always at the left edge in local coordinates (-doorLength/2, 0)
  // After parent rotation, this becomes the correct world-space hinge position
  const pivotX = -doorLength / 2;
  const pivotY = 0;
  
  // Check for door toggle animation
  const animation = getDoorAnimationProgress(id);
  
  // Calculate animated door swing angle (0 = closed, -90° = open)
  let swingAngle = isOpen ? -Math.PI / 2 : 0;
  let animatedDoorLength = isOpen ? openDoorLength : doorLength;
  
  if (animation) {
    // Ease-out curve for smooth animation
    const easeOut = 1 - Math.pow(1 - animation.progress, 3);
    
    if (animation.isOpening) {
      // Animating from closed to open
      swingAngle = -Math.PI / 2 * easeOut;
      animatedDoorLength = doorLength - (doorLength - openDoorLength) * easeOut;
    } else {
      // Animating from open to closed
      swingAngle = -Math.PI / 2 * (1 - easeOut);
      animatedDoorLength = openDoorLength + (doorLength - openDoorLength) * easeOut;
    }
  }
  
  // For legacy vertical doors, we need to apply an additional 90° rotation
  // to render them correctly since they don't have rotation in the transform
  ctx.save(); // Save state before any door-specific rotation
  if (isVerticalDoor && rotation === 0) {
    ctx.rotate(Math.PI / 2); // Rotate 90° to make it vertical
  }
  
  // Determine if we should draw as open or closed based on animation state
  const drawAsOpen = animation ? animation.isOpening : isOpen;
  
  if (drawAsOpen || animation) {
    ctx.save();
    
    // Draw doorway opening (dashed line where door was)
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(-doorLength / 2, 0);
    ctx.lineTo(doorLength / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw door panel with animated swing
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 / zoom;
    
    // Draw hinge indicator at pivot point
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();
    
    // Apply glow effect if animating
    if (animation) {
      const glowIntensity = Math.sin(animation.progress * Math.PI);
      const glowColor = animation.isOpening ? '34, 197, 94' : '245, 158, 11';
      ctx.shadowColor = `rgba(${glowColor}, ${glowIntensity * 0.6})`;
      ctx.shadowBlur = (15 + glowIntensity * 10) / zoom;
    }
    
    // Swung door panel with animated rotation
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(swingAngle);
    ctx.fillRect(0, -doorThickness / 2, animatedDoorLength, doorThickness);
    ctx.strokeRect(0, -doorThickness / 2, animatedDoorLength, doorThickness);
    ctx.restore();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
  } else {
    // Draw closed door - solid rectangle blocking the doorway
    ctx.fillRect(-doorLength / 2, -doorThickness / 2, doorLength, doorThickness);
    ctx.strokeRect(-doorLength / 2, -doorThickness / 2, doorLength, doorThickness);
    
    // Draw door handle/detail (offset toward the non-pivot end)
    ctx.beginPath();
    ctx.arc(doorLength / 4, 0, 2 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();
  }
  
  // DM view: show interactive toggle indicators on both ends of the door
  if (isDMView) {
    const indicatorSize = 6 / zoom;
    const indicatorOffset = 2 / zoom; // Gap from door edge
    
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#f59e0b'; // Always yellow/amber for visibility
    ctx.strokeStyle = '#78350f'; // Dark amber border
    ctx.lineWidth = 1 / zoom;
    
    // Left end indicator (near pivot/hinge)
    const leftX = -doorLength / 2 - indicatorOffset - indicatorSize / 2;
    const leftY = 0;
    
    ctx.beginPath();
    ctx.roundRect(
      leftX - indicatorSize / 2,
      leftY - indicatorSize / 2,
      indicatorSize,
      indicatorSize,
      1.5 / zoom
    );
    ctx.fill();
    ctx.stroke();
    
    // Right end indicator (far end of door)
    const rightX = doorLength / 2 + indicatorOffset + indicatorSize / 2;
    const rightY = 0;
    
    ctx.beginPath();
    ctx.roundRect(
      rightX - indicatorSize / 2,
      rightY - indicatorSize / 2,
      indicatorSize,
      indicatorSize,
      1.5 / zoom
    );
    ctx.fill();
    ctx.stroke();
  }
  
  ctx.restore(); // Restore state after door rendering (removes vertical door rotation)
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
  
  // For doors in DM view, also check if clicking on either toggle indicator
  if (shape === 'door' && isDMView) {
    const indicatorSize = 6 / zoom;
    const indicatorOffset = 2 / zoom;
    const indicatorHitRadius = indicatorSize;
    
    // Calculate door length (handle legacy vertical doors)
    const isVerticalDoor = mapObject.rotation === 90 || 
      (mapObject.rotation === 0 && mapObject.doorDirection && 
       Math.abs(mapObject.doorDirection.x) > Math.abs(mapObject.doorDirection.y));
    const doorLength = (isVerticalDoor && mapObject.rotation === 0) 
      ? Math.max(width, height) 
      : width;
    
    // Left indicator position
    const leftX = -doorLength / 2 - indicatorOffset - indicatorSize / 2;
    // Right indicator position  
    const rightX = doorLength / 2 + indicatorOffset + indicatorSize / 2;
    
    // Check if click is on left indicator
    if (
      Math.abs(localX - leftX) <= indicatorHitRadius &&
      Math.abs(localY) <= indicatorHitRadius
    ) {
      return true;
    }
    
    // Check if click is on right indicator
    if (
      Math.abs(localX - rightX) <= indicatorHitRadius &&
      Math.abs(localY) <= indicatorHitRadius
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
