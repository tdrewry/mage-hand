/**
 * Region Transformation Utilities
 * 
 * Handles scaling and rotation transformations for canvas regions
 * with support for both rectangular and path-based regions
 */

import { CanvasRegion } from '../stores/regionStore';

export interface TransformHandle {
  x: number;
  y: number;
  type: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w' | 'rotate' | 'center';
  size: number;
}

export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Calculate bounds for any region type
export const getRegionBounds = (region: CanvasRegion): RegionBounds => {
  if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
    const xs = region.pathPoints.map(p => p.x);
    const ys = region.pathPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  } else {
    // Rectangle region
    return {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      centerX: region.x + region.width / 2,
      centerY: region.y + region.height / 2
    };
  }
};

// Generate transformation handles for a region
export const generateTransformHandles = (region: CanvasRegion): TransformHandle[] => {
  const bounds = getRegionBounds(region);
  const handleSize = 8;
  
  return [
    // Corner handles for scaling
    { x: bounds.x, y: bounds.y, type: 'nw', size: handleSize },
    { x: bounds.x + bounds.width, y: bounds.y, type: 'ne', size: handleSize },
    { x: bounds.x, y: bounds.y + bounds.height, type: 'sw', size: handleSize },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se', size: handleSize },
    
    // Edge handles for scaling
    { x: bounds.centerX, y: bounds.y, type: 'n', size: handleSize },
    { x: bounds.x + bounds.width, y: bounds.centerY, type: 'e', size: handleSize },
    { x: bounds.centerX, y: bounds.y + bounds.height, type: 's', size: handleSize },
    { x: bounds.x, y: bounds.centerY, type: 'w', size: handleSize },
    
    // Rotation handle (above the region)
    { x: bounds.centerX, y: bounds.y - 30, type: 'rotate', size: 10 }
  ];
};

// Get rotation center handle (can be moved within bounds)
export const getRotationCenterHandle = (region: CanvasRegion, customCenter?: { x: number; y: number }): TransformHandle => {
  const bounds = getRegionBounds(region);
  
  // Use custom center if provided, otherwise use geometric center
  const centerX = customCenter?.x ?? bounds.centerX;
  const centerY = customCenter?.y ?? bounds.centerY;
  
  return {
    x: centerX,
    y: centerY,
    type: 'center',
    size: 6
  };
};

// Check if point hits any transform handle
export const hitTestTransformHandle = (
  point: { x: number; y: number },
  handles: TransformHandle[]
): TransformHandle | null => {
  for (const handle of handles) {
    const distance = Math.sqrt(
      Math.pow(point.x - handle.x, 2) + Math.pow(point.y - handle.y, 2)
    );
    
    if (distance <= handle.size) {
      return handle;
    }
  }
  return null;
};

// Apply scaling transformation to region
export const scaleRegion = (
  region: CanvasRegion,
  scaleX: number,
  scaleY: number,
  anchor: { x: number; y: number }
): Partial<CanvasRegion> => {
  if (region.regionType === 'path' && region.pathPoints) {
    // Scale path points relative to anchor
    const scaledPoints = region.pathPoints.map(point => ({
      x: anchor.x + (point.x - anchor.x) * scaleX,
      y: anchor.y + (point.y - anchor.y) * scaleY
    }));
    
    return { pathPoints: scaledPoints };
  } else {
    // Scale rectangle region
    const newWidth = region.width * scaleX;
    const newHeight = region.height * scaleY;
    const newX = anchor.x + (region.x - anchor.x) * scaleX;
    const newY = anchor.y + (region.y - anchor.y) * scaleY;
    
    return {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    };
  }
};

// Apply rotation transformation to region
export const rotateRegion = (
  region: CanvasRegion,
  angle: number,
  center: { x: number; y: number }
): Partial<CanvasRegion> => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  const rotatePoint = (point: { x: number; y: number }) => ({
    x: center.x + (point.x - center.x) * cos - (point.y - center.y) * sin,
    y: center.y + (point.x - center.x) * sin + (point.y - center.y) * cos
  });
  
  if (region.regionType === 'path' && region.pathPoints) {
    // Rotate path points
    const rotatedPoints = region.pathPoints.map(rotatePoint);
    return { pathPoints: rotatedPoints };
  } else {
    // For rectangle regions, we need to convert to path to maintain rotation
    // Create corner points of the rectangle
    const corners = [
      { x: region.x, y: region.y },
      { x: region.x + region.width, y: region.y },
      { x: region.x + region.width, y: region.y + region.height },
      { x: region.x, y: region.y + region.height }
    ];
    
    const rotatedCorners = corners.map(rotatePoint);
    
    return {
      regionType: 'path' as const,
      pathPoints: rotatedCorners,
      rotation: ((region.rotation || 0) + angle * 180 / Math.PI) % 360
    };
  }
};

// Calculate scale factors from handle drag
export const calculateScaleFromDrag = (
  handle: TransformHandle,
  dragDelta: { x: number; y: number },
  bounds: RegionBounds
): { scaleX: number; scaleY: number; anchor: { x: number; y: number } } => {
  let scaleX = 1;
  let scaleY = 1;
  let anchor = { x: bounds.centerX, y: bounds.centerY };
  
  switch (handle.type) {
    case 'nw':
      scaleX = Math.max(0.1, (bounds.width - dragDelta.x) / bounds.width);
      scaleY = Math.max(0.1, (bounds.height - dragDelta.y) / bounds.height);
      anchor = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
      break;
    case 'ne':
      scaleX = Math.max(0.1, (bounds.width + dragDelta.x) / bounds.width);
      scaleY = Math.max(0.1, (bounds.height - dragDelta.y) / bounds.height);
      anchor = { x: bounds.x, y: bounds.y + bounds.height };
      break;
    case 'sw':
      scaleX = Math.max(0.1, (bounds.width - dragDelta.x) / bounds.width);
      scaleY = Math.max(0.1, (bounds.height + dragDelta.y) / bounds.height);
      anchor = { x: bounds.x + bounds.width, y: bounds.y };
      break;
    case 'se':
      scaleX = Math.max(0.1, (bounds.width + dragDelta.x) / bounds.width);
      scaleY = Math.max(0.1, (bounds.height + dragDelta.y) / bounds.height);
      anchor = { x: bounds.x, y: bounds.y };
      break;
    case 'n':
      scaleY = Math.max(0.1, (bounds.height - dragDelta.y) / bounds.height);
      anchor = { x: bounds.centerX, y: bounds.y + bounds.height };
      break;
    case 'e':
      scaleX = Math.max(0.1, (bounds.width + dragDelta.x) / bounds.width);
      anchor = { x: bounds.x, y: bounds.centerY };
      break;
    case 's':
      scaleY = Math.max(0.1, (bounds.height + dragDelta.y) / bounds.height);
      anchor = { x: bounds.centerX, y: bounds.y };
      break;
    case 'w':
      scaleX = Math.max(0.1, (bounds.width - dragDelta.x) / bounds.width);
      anchor = { x: bounds.x + bounds.width, y: bounds.centerY };
      break;
  }
  
  return { scaleX, scaleY, anchor };
};

// Calculate rotation angle from center drag
export const calculateRotationFromDrag = (
  center: { x: number; y: number },
  currentMouse: { x: number; y: number },
  previousMouse: { x: number; y: number }
): number => {
  const prevAngle = Math.atan2(previousMouse.y - center.y, previousMouse.x - center.x);
  const currAngle = Math.atan2(currentMouse.y - center.y, currentMouse.x - center.x);
  
  return currAngle - prevAngle;
};