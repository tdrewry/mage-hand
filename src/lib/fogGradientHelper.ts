/**
 * Fog Gradient Helper - Creates radial gradients for soft vision edges
 * Uses Paper.js gradient definitions that can be applied to Canvas API
 */

import paper from 'paper';

export interface GradientSettings {
  innerFadeStart: number;    // 0-1, where the fade begins (default: 0.7)
  midpointPosition: number;  // 0-1, position of mid-fade (default: 0.85)
  midpointOpacity: number;   // 0-1, opacity at midpoint (default: 0.2)
  outerFadeStart: number;    // 0-1, where outer fade starts (default: 0.9)
  fogOpacity: number;        // 0-1, full fog opacity
  exploredOpacity: number;   // 0-1, explored area opacity
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Create a radial gradient with smooth multi-stop fading
 * Returns gradient parameters for Canvas API usage
 */
export function createVisionGradient(
  tokenPosition: Point,
  visionRange: number,
  settings: GradientSettings
): {
  x0: number;
  y0: number;
  r0: number;
  x1: number;
  y1: number;
  r1: number;
  stops: Array<{ offset: number; color: string }>;
} {
  const { innerFadeStart, midpointPosition, midpointOpacity, outerFadeStart, exploredOpacity } = settings;
  
  return {
    // Inner circle (center point, zero radius)
    x0: tokenPosition.x,
    y0: tokenPosition.y,
    r0: 0,
    // Outer circle (same center, full vision range)
    x1: tokenPosition.x,
    y1: tokenPosition.y,
    r1: visionRange,
    // Gradient stops for smooth multi-stage fade
    stops: [
      { offset: 0, color: `rgba(0, 0, 0, 0)` },  // Center: fully transparent (perfect vision)
      { offset: innerFadeStart, color: `rgba(0, 0, 0, 0)` },  // Inner zone: still clear
      { offset: midpointPosition, color: `rgba(0, 0, 0, ${midpointOpacity})` },  // Midpoint: slight dimming
      { offset: outerFadeStart, color: `rgba(0, 0, 0, ${exploredOpacity})` },  // Outer fade: more dimming
      { offset: 1.0, color: `rgba(0, 0, 0, 1)` }  // Edge: full darkness
    ]
  };
}

/**
 * Apply a radial gradient to canvas context
 * Uses clipping path to constrain gradient to visibility polygon
 */
export function applyGradientToCanvas(
  ctx: CanvasRenderingContext2D,
  gradient: ReturnType<typeof createVisionGradient>,
  clipPath: Path2D
): void {
  ctx.save();
  
  // Create Canvas API radial gradient
  const canvasGradient = ctx.createRadialGradient(
    gradient.x0, gradient.y0, gradient.r0,
    gradient.x1, gradient.y1, gradient.r1
  );
  
  // Add all gradient stops
  gradient.stops.forEach(stop => {
    canvasGradient.addColorStop(stop.offset, stop.color);
  });
  
  // Clip to visibility path and fill with gradient
  ctx.clip(clipPath);
  ctx.fillStyle = canvasGradient;
  
  // Fill a rectangle large enough to cover the gradient area
  const boundingBox = {
    x: gradient.x1 - gradient.r1,
    y: gradient.y1 - gradient.r1,
    width: gradient.r1 * 2,
    height: gradient.r1 * 2
  };
  ctx.fillRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
  
  ctx.restore();
}

/**
 * Create a default gradient settings object
 */
export function getDefaultGradientSettings(
  fogOpacity: number = 0.95,
  exploredOpacity: number = 0.4
): GradientSettings {
  return {
    innerFadeStart: 0.7,
    midpointPosition: 0.85,
    midpointOpacity: 0.2,
    outerFadeStart: 0.9,
    fogOpacity,
    exploredOpacity
  };
}
