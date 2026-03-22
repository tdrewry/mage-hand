/**
 * geometry.ts
 * Mathematical helper functions for the Rules Engine & Flow Canvas logic
 */

import { FlowNodePosition } from '../types/base';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates the intersection between the line connecting the centers of two bounding boxes
 * and the perimeter of the source bounding box.
 */
export function getPerimeterIntersection(
  source: BoundingBox,
  target: BoundingBox
): { point: Point; side: 'top' | 'right' | 'bottom' | 'left' } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Use the bounding box half-dimensions
  const hw = source.width / 2;
  const hh = source.height / 2;

  // Slope
  let intersectionX = 0;
  let intersectionY = 0;
  let side: 'top' | 'right' | 'bottom' | 'left' = 'right';

  if (dx === 0 && dy === 0) {
     return { point: sourceCenter, side: 'right' };
  }

  if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
    // Intersects left or right
    if (dx > 0) {
      intersectionX = hw;
      intersectionY = intersectionX * dy / dx;
      side = 'right';
    } else {
      intersectionX = -hw;
      intersectionY = intersectionX * dy / dx;
      side = 'left';
    }
  } else {
    // Intersects top or bottom
    if (dy > 0) {
      intersectionY = hh;
      intersectionX = intersectionY * dx / dy;
      side = 'bottom';
    } else {
      intersectionY = -hh;
      intersectionX = intersectionY * dx / dy;
      side = 'top';
    }
  }

  return {
    point: { x: sourceCenter.x + intersectionX, y: sourceCenter.y + intersectionY },
    side
  };
}

/**
 * Generates an SVG path string for a cubic Bezier curve connecting two bounding boxes,
 * anchored to their perimeters and pushed outward perpendicular to the node edges.
 */
export function getBezierPath(source: BoundingBox, target: BoundingBox, pushDistance: number = 50): string {
  const sourceIntersection = getPerimeterIntersection(source, target);
  // Reversing source/target gives the entry point on the target node
  const targetIntersection = getPerimeterIntersection(target, source);

  const startPt = sourceIntersection.point;
  const endPt = targetIntersection.point;

  let cp1 = { ...startPt };
  switch (sourceIntersection.side) {
    case 'top': cp1.y -= pushDistance; break;
    case 'bottom': cp1.y += pushDistance; break;
    case 'left': cp1.x -= pushDistance; break;
    case 'right': cp1.x += pushDistance; break;
  }

  let cp2 = { ...endPt };
  switch (targetIntersection.side) {
    case 'top': cp2.y -= pushDistance; break;
    case 'bottom': cp2.y += pushDistance; break;
    case 'left': cp2.x -= pushDistance; break;
    case 'right': cp2.x += pushDistance; break;
  }

  return `M ${startPt.x} ${startPt.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endPt.x} ${endPt.y}`;
}

/**
 * Similar bezier logic but for dragging to a generic point
 */
export function getDragBezierPath(source: BoundingBox, currentPt: Point, pushDistance: number = 50): string {
  const targetVirtualBox = { x: currentPt.x, y: currentPt.y, width: 0, height: 0 };
  const sourceIntersection = getPerimeterIntersection(source, targetVirtualBox);
  
  const startPt = sourceIntersection.point;
  
  let cp1 = { ...startPt };
  switch (sourceIntersection.side) {
    case 'top': cp1.y -= pushDistance; break;
    case 'bottom': cp1.y += pushDistance; break;
    case 'left': cp1.x -= pushDistance; break;
    case 'right': cp1.x += pushDistance; break;
  }
  
  // Use a second control point that matches the current point but smoothed if needed, 
  // or simply use the midpoint of cp1 and currentPt.
  const cp2x = (cp1.x + currentPt.x) / 2;
  const cp2y = (cp1.y + currentPt.y) / 2;
  
  return `M ${startPt.x} ${startPt.y} C ${cp1.x} ${cp1.y}, ${cp2x} ${cp2y}, ${currentPt.x} ${currentPt.y}`;
}
