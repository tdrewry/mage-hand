/**
 * Enhanced Event System
 * 
 * Provides improved mouse/touch interaction handling with:
 * - Better hit detection for complex shapes
 * - Event delegation and bubbling
 * - Gesture recognition for pan/zoom/rotate
 * - Preview states and visual feedback
 */

import { Token } from '../stores/sessionStore';
import { CanvasRegion } from '../stores/regionStore';
import { TokenGroup } from './groupTransforms'; // TokenGroup is now an alias for EntityGroup

export interface EventPoint {
  x: number;
  y: number;
  pressure?: number;
  timestamp: number;
}

export interface InteractionState {
  type: 'none' | 'pan' | 'drag' | 'rotate' | 'scale' | 'draw';
  startPoint: EventPoint | null;
  currentPoint: EventPoint | null;
  targetId: string | null;
  targetType: 'token' | 'region' | 'group' | 'canvas' | null;
  modifier: 'none' | 'shift' | 'ctrl' | 'alt';
  preview: any | null;
}

export interface HitTestResult {
  type: 'token' | 'region' | 'group' | 'handle' | 'background';
  id: string | null;
  distance: number;
  point: { x: number; y: number };
  metadata?: any;
}

export interface DragPreview {
  type: 'token' | 'region' | 'group';
  id: string;
  ghostPosition: { x: number; y: number };
  snapPosition?: { x: number; y: number };
  showSnapGuide: boolean;
}

// Convert mouse/touch event to normalized point
export const eventToPoint = (event: MouseEvent | TouchEvent): EventPoint => {
  const timestamp = Date.now();
  
  if (event.type.startsWith('touch')) {
    const touchEvent = event as TouchEvent;
    const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
    return {
      x: touch.clientX,
      y: touch.clientY,
      pressure: (touch as any).pressure || 1.0,
      timestamp
    };
  } else {
    const mouseEvent = event as MouseEvent;
    return {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      pressure: 1.0,
      timestamp
    };
  }
};

// Convert screen coordinates to canvas coordinates
export const screenToCanvas = (
  point: EventPoint, 
  canvasRect: DOMRect,
  transform: { x: number; y: number; zoom: number }
): { x: number; y: number } => ({
  x: (point.x - canvasRect.left - transform.x) / transform.zoom,
  y: (point.y - canvasRect.top - transform.y) / transform.zoom
});

// Advanced hit testing for tokens with proper shape detection
export const hitTestToken = (
  point: { x: number; y: number },
  token: Token,
  tolerance: number = 5
): HitTestResult | null => {
  const tokenWidth = token.gridWidth * 50; // Assume 50px per grid unit
  const tokenHeight = token.gridHeight * 50;
  
  // Bounding box check first (fast rejection)
  if (point.x < token.x - tolerance ||
      point.x > token.x + tokenWidth + tolerance ||
      point.y < token.y - tolerance ||
      point.y > token.y + tokenHeight + tolerance) {
    return null;
  }
  
  // Calculate distance to token center for priority
  const centerX = token.x + tokenWidth / 2;
  const centerY = token.y + tokenHeight / 2;
  const distance = Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2));
  
  return {
    type: 'token',
    id: token.id,
    distance,
    point: { x: centerX, y: centerY },
    metadata: { token }
  };
};

// Hit test for canvas regions with polygon support
export const hitTestRegion = (
  point: { x: number; y: number },
  region: CanvasRegion,
  tolerance: number = 5
): HitTestResult | null => {
  if (region.regionType === 'path' && region.pathPoints) {
    // Use polygon hit detection for path regions
    const inside = isPointInPolygon(point, region.pathPoints);
    if (inside) {
      const center = getPolygonCenter(region.pathPoints);
      const distance = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2));
      
      return {
        type: 'region',
        id: region.id,
        distance,
        point: center,
        metadata: { region }
      };
    }
  } else {
    // Rectangle hit detection
    if (point.x >= region.x - tolerance &&
        point.x <= region.x + region.width + tolerance &&
        point.y >= region.y - tolerance &&
        point.y <= region.y + region.height + tolerance) {
      
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      const distance = Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2));
      
      return {
        type: 'region',
        id: region.id,
        distance,
        point: { x: centerX, y: centerY },
        metadata: { region }
      };
    }
  }
  
  return null;
};

// Hit test for entity groups
export const hitTestGroup = (
  point: { x: number; y: number },
  group: TokenGroup,
  tokens: Token[]
): HitTestResult | null => {
  const memberTokenIds = new Set(group.members.map(m => m.id));
  const groupTokens = tokens.filter(t => memberTokenIds.has(t.id));
  
  // Check if point hits any token in the group
  for (const token of groupTokens) {
    const hit = hitTestToken(point, token);
    if (hit) {
      return {
        type: 'group',
        id: group.id,
        distance: hit.distance,
        point: hit.point,
        metadata: { group, hitToken: token }
      };
    }
  }
  
  return null;
};

// Comprehensive hit testing with priority ordering
export const performHitTest = (
  point: { x: number; y: number },
  tokens: Token[],
  regions: CanvasRegion[],
  groups: TokenGroup[]
): HitTestResult[] => {
  const results: HitTestResult[] = [];
  
  // Test groups first (highest priority)
  groups.forEach(group => {
    const hit = hitTestGroup(point, group, tokens);
    if (hit) results.push(hit);
  });
  
  // Test individual tokens
  tokens.forEach(token => {
    // Skip tokens that are part of a group (already tested above)
    const isInGroup = groups.some(g => g.members.some(m => m.id === token.id));
    if (!isInGroup) {
      const hit = hitTestToken(point, token);
      if (hit) results.push(hit);
    }
  });
  
  // Test regions (lower priority)
  regions.forEach(region => {
    const hit = hitTestRegion(point, region);
    if (hit) results.push(hit);
  });
  
  // Sort by distance (closest first)
  return results.sort((a, b) => a.distance - b.distance);
};

// Gesture recognition for multi-touch and complex interactions
export const recognizeGesture = (
  touches: EventPoint[],
  previousTouches: EventPoint[]
): 'pan' | 'zoom' | 'rotate' | 'none' => {
  if (touches.length === 1) {
    return 'pan';
  } else if (touches.length === 2 && previousTouches.length === 2) {
    // Calculate distance and angle changes for zoom/rotate detection
    const currentDistance = Math.sqrt(
      Math.pow(touches[1].x - touches[0].x, 2) + 
      Math.pow(touches[1].y - touches[0].y, 2)
    );
    
    const previousDistance = Math.sqrt(
      Math.pow(previousTouches[1].x - previousTouches[0].x, 2) + 
      Math.pow(previousTouches[1].y - previousTouches[0].y, 2)
    );
    
    const distanceChange = Math.abs(currentDistance - previousDistance);
    
    // If distance changed significantly, it's a zoom gesture
    if (distanceChange > 10) {
      return 'zoom';
    }
    
    // Check for rotation (angle change)
    const currentAngle = Math.atan2(
      touches[1].y - touches[0].y,
      touches[1].x - touches[0].x
    );
    
    const previousAngle = Math.atan2(
      previousTouches[1].y - previousTouches[0].y,
      previousTouches[1].x - previousTouches[0].x
    );
    
    const angleChange = Math.abs(currentAngle - previousAngle);
    
    if (angleChange > 0.1) { // ~5 degrees
      return 'rotate';
    }
  }
  
  return 'none';
};

// Create drag preview for visual feedback
export const createDragPreview = (
  type: 'token' | 'region' | 'group',
  id: string,
  startPoint: { x: number; y: number },
  currentPoint: { x: number; y: number },
  snapPoint?: { x: number; y: number }
): DragPreview => ({
  type,
  id,
  ghostPosition: {
    x: currentPoint.x,
    y: currentPoint.y
  },
  snapPosition: snapPoint,
  showSnapGuide: !!snapPoint
});

// Calculate snap guides and magnetic attraction points
export const calculateSnapGuides = (
  dragPoint: { x: number; y: number },
  allTokens: Token[],
  regions: CanvasRegion[],
  tolerance: number = 20
): { x?: number; y?: number } | null => {
  const snapPoints: { x: number; y: number }[] = [];
  
  // Add token positions as snap points
  allTokens.forEach(token => {
    snapPoints.push({ x: token.x, y: token.y });
    snapPoints.push({ 
      x: token.x + token.gridWidth * 50, 
      y: token.y + token.gridHeight * 50 
    });
  });
  
  // Add region boundaries as snap points
  regions.forEach(region => {
    snapPoints.push({ x: region.x, y: region.y });
    snapPoints.push({ x: region.x + region.width, y: region.y + region.height });
  });
  
  // Find closest snap point within tolerance
  let closestSnap: { x?: number; y?: number } | null = null;
  let closestDistance = tolerance;
  
  snapPoints.forEach(snap => {
    const distance = Math.sqrt(
      Math.pow(dragPoint.x - snap.x, 2) + 
      Math.pow(dragPoint.y - snap.y, 2)
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestSnap = snap;
    }
  });
  
  return closestSnap;
};

// Utility functions for polygon operations
const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) && 
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

const getPolygonCenter = (polygon: { x: number; y: number }[]): { x: number; y: number } => {
  const sum = polygon.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y
  }), { x: 0, y: 0 });
  
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length
  };
};

// Keyboard modifier detection
export const getModifierState = (event: MouseEvent | KeyboardEvent): 'none' | 'shift' | 'ctrl' | 'alt' => {
  if (event.shiftKey) return 'shift';
  if (event.ctrlKey || event.metaKey) return 'ctrl';
  if (event.altKey) return 'alt';
  return 'none';
};