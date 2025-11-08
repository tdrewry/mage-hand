/**
 * Light System - Manages light calculations and rendering
 */

import type { LightSource } from '@/stores/lightStore';
import type { CanvasRegion } from '@/stores/regionStore';
import { computeVisibilityFromSegments, visibilityPolygonToPath2D, clearVisibilityCache } from './visibilityEngine';
import type { Point, VisibilityResult, LineSegment } from './visibilityEngine';

export interface IlluminationMap {
  litAreas: Path2D[]; // Areas lit by each light source
  combinedLitArea: Path2D; // Union of all lit areas
  shadowAreas: Path2D; // Areas in shadow (inverse of lit areas)
  lightSources: LightSource[]; // Active light sources
}

/**
 * Compute illumination map from active light sources
 * Uses wall geometry segments as obstacles
 */
export function computeIllumination(
  lights: LightSource[],
  wallSegments: LineSegment[],
  wallGeometry?: any
): IlluminationMap {
  console.log('computeIllumination called with:', {
    lightCount: lights.length,
    segmentCount: wallSegments.length,
    hasWallGeometry: !!wallGeometry
  });

  // Filter out lights that are inside walls (shouldn't cast light)
  let activeLights = lights.filter(light => light.enabled);
  
  if (wallGeometry && activeLights.length > 0) {
    // Create a temporary canvas context to test if lights are in walls
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      activeLights = activeLights.filter(light => {
        // Check if light center is inside wall geometry (negative space)
        const isInWall = tempCtx.isPointInPath(wallGeometry.wallPath, light.position.x, light.position.y, 'evenodd');
        return !isInWall; // Only include lights NOT in walls
      });
    }
  }
  
  const litAreas: Path2D[] = [];
  
  // Compute visibility polygon for each light using wall segments as obstacles
  for (const light of activeLights) {
    const visibility = computeVisibilityFromSegments(light.position, wallSegments, light.radius);
    const path = visibilityPolygonToPath2D(visibility.polygon);
    litAreas.push(path);
  }
  
  // For combined lit area, compute visibility for all lights
  let combinedLitArea = new Path2D();
  if (activeLights.length > 0) {
    // Merge all lit areas into one
    for (const area of litAreas) {
      combinedLitArea.addPath(area);
    }
  }
  
  // Shadow areas are computed as needed (inverse of lit areas)
  const shadowAreas = new Path2D();
  
  return {
    litAreas,
    combinedLitArea,
    shadowAreas,
    lightSources: activeLights,
  };
}

/**
 * Render light sources on canvas (visualize light positions)
 */
export function renderLightSources(
  ctx: CanvasRenderingContext2D,
  lights: LightSource[],
  transform: { x: number; y: number; zoom: number }
) {
  ctx.save();
  
  for (const light of lights) {
    if (!light.enabled) continue;
    
    const { x, y } = light.position;
    
    // Draw light radius (faint circle)
    ctx.strokeStyle = light.color + '40'; // 25% opacity
    ctx.lineWidth = 2 / transform.zoom;
    ctx.beginPath();
    ctx.arc(x, y, light.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw light source center
    ctx.fillStyle = light.color;
    ctx.shadowColor = light.color;
    ctx.shadowBlur = 20 / transform.zoom;
    ctx.beginPath();
    ctx.arc(x, y, 8 / transform.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Draw label if present
    if (light.label) {
      ctx.font = `${14 / transform.zoom}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(light.label, x, y - (light.radius + 20 / transform.zoom));
    }
  }
  
  ctx.restore();
}

/**
 * Render shadows on region edges
 */
export function renderShadows(
  ctx: CanvasRenderingContext2D,
  regions: CanvasRegion[],
  illumination: IlluminationMap,
  shadowIntensity: number,
  ambientLight: number
) {
  ctx.save();
  
  // For each region, check which edges are in shadow
  for (const region of regions) {
    if (!region.regionType || region.regionType === 'rectangle') {
      renderRectShadows(ctx, region, illumination, shadowIntensity, ambientLight);
    } else if (region.regionType === 'path' && region.pathPoints) {
      renderPolygonShadows(ctx, region, illumination, shadowIntensity, ambientLight);
    }
  }
  
  ctx.restore();
}

function renderRectShadows(
  ctx: CanvasRenderingContext2D,
  region: CanvasRegion,
  illumination: IlluminationMap,
  shadowIntensity: number,
  ambientLight: number
) {
  const { x, y, width, height } = region;
  
  // Get corners
  let corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  
  // Handle rotation
  if (region.rotation) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const cos = Math.cos(region.rotation);
    const sin = Math.sin(region.rotation);
    
    corners = corners.map(corner => {
      const dx = corner.x - centerX;
      const dy = corner.y - centerY;
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      };
    });
  }
  
  // Check each edge
  for (let i = 0; i < corners.length; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % corners.length];
    
    if (shouldDrawShadowOnEdge(start, end, illumination, ctx)) {
      drawEdgeShadow(ctx, start, end, shadowIntensity, ambientLight);
    }
  }
}

function renderPolygonShadows(
  ctx: CanvasRenderingContext2D,
  region: CanvasRegion,
  illumination: IlluminationMap,
  shadowIntensity: number,
  ambientLight: number
) {
  const points = region.pathPoints!;
  
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    
    if (shouldDrawShadowOnEdge(start, end, illumination, ctx)) {
      drawEdgeShadow(ctx, start, end, shadowIntensity, ambientLight);
    }
  }
}

/**
 * Determine if an edge should have a shadow drawn on it
 * An edge gets a shadow if one side is lit and the other is in darkness
 */
function shouldDrawShadowOnEdge(
  start: Point,
  end: Point,
  illumination: IlluminationMap,
  ctx: CanvasRenderingContext2D
): boolean {
  // Calculate edge midpoint and normal
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len === 0) return false;
  
  // Perpendicular outward normal
  const normalX = -dy / len;
  const normalY = dx / len;
  
  // Test points on both sides of the edge
  const testDistance = 10; // pixels
  const insideX = midX - normalX * testDistance;
  const insideY = midY - normalY * testDistance;
  const outsideX = midX + normalX * testDistance;
  const outsideY = midY + normalY * testDistance;
  
  // Check if inside is lit and outside is dark (or vice versa)
  const insideLit = ctx.isPointInPath(illumination.combinedLitArea, insideX, insideY);
  const outsideLit = ctx.isPointInPath(illumination.combinedLitArea, outsideX, outsideY);
  
  // Draw shadow if there's a light/dark boundary
  return insideLit !== outsideLit;
}

/**
 * Draw shadow gradient along an edge
 */
function drawEdgeShadow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  shadowIntensity: number,
  ambientLight: number
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len === 0) return;
  
  // Perpendicular outward normal
  const normalX = -dy / len;
  const normalY = dx / len;
  
  // Shadow extends perpendicular to edge
  const shadowDistance = 30;
  
  // Create gradient
  const gradient = ctx.createLinearGradient(
    start.x, start.y,
    start.x + normalX * shadowDistance,
    start.y + normalY * shadowDistance
  );
  
  const shadowAlpha = shadowIntensity * (1 - ambientLight);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  // Draw shadow quad
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(end.x + normalX * shadowDistance, end.y + normalY * shadowDistance);
  ctx.lineTo(start.x + normalX * shadowDistance, start.y + normalY * shadowDistance);
  ctx.closePath();
  ctx.fill();
}

/**
 * Notify light system that obstacles have changed
 */
export function notifyObstaclesChanged(): void {
  clearVisibilityCache();
}
