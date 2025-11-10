/**
 * Fog Gradient Renderer - Renders fog of war with soft gradient edges
 * Uses Canvas API with radial gradients for smooth vision falloff
 */

import { createVisionGradient, applyGradientToCanvas, type GradientSettings, type Point } from './fogGradientHelper';

/**
 * Render fog with soft gradient edges using Canvas API
 * More performant than polygon scaling, GPU-accelerated
 */
export function renderFogWithGradients(
  ctx: CanvasRenderingContext2D,
  unexploredMask: Path2D,
  exploredOnlyMask: Path2D,
  visibleTokens: Array<{ position: Point; visionRange: number; visibilityPath: Path2D }>,
  gradientSettings: GradientSettings
): void {
  ctx.save();
  
  // Step 1: Render unexplored areas (opaque base layer)
  ctx.fillStyle = `rgba(0, 0, 0, ${gradientSettings.fogOpacity})`;
  ctx.fill(unexploredMask);
  
  // Step 2: Render explored but not visible areas (semi-transparent)
  ctx.fillStyle = `rgba(0, 0, 0, ${gradientSettings.exploredOpacity})`;
  ctx.fill(exploredOnlyMask);
  
  // Step 3: Render each token's vision with soft gradient
  // Use destination-out to remove fog with gradient fade
  ctx.globalCompositeOperation = 'destination-out';
  
  visibleTokens.forEach(({ position, visionRange, visibilityPath }) => {
    // Create Canvas API radial gradient
    const canvasGradient = ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, visionRange
    );
    
    // Add gradient stops - reversed for destination-out (opacity becomes alpha)
    // Higher alpha = more fog removal
    canvasGradient.addColorStop(0, `rgba(255, 255, 255, 1)`);  // Center: fully remove fog
    canvasGradient.addColorStop(gradientSettings.innerFadeStart, `rgba(255, 255, 255, 1)`);  // Inner: still clear
    canvasGradient.addColorStop(gradientSettings.midpointPosition, `rgba(255, 255, 255, ${1 - gradientSettings.midpointOpacity})`);  // Midpoint: partial removal
    canvasGradient.addColorStop(gradientSettings.outerFadeStart, `rgba(255, 255, 255, ${1 - gradientSettings.exploredOpacity})`);  // Outer fade: less removal
    canvasGradient.addColorStop(1.0, `rgba(255, 255, 255, 0)`);  // Edge: no fog removal
    
    // Clip to visibility path and fill with gradient
    ctx.save();
    ctx.clip(visibilityPath);
    ctx.fillStyle = canvasGradient;
    
    // Fill a rectangle large enough to cover the gradient area
    ctx.fillRect(
      position.x - visionRange,
      position.y - visionRange,
      visionRange * 2,
      visionRange * 2
    );
    ctx.restore();
  });
  
  // Reset composite operation
  ctx.globalCompositeOperation = 'source-over';
  
  ctx.restore();
}

/**
 * Render fog with hard edges (original implementation, no gradients)
 * Fallback for performance or compatibility
 */
export function renderFogWithHardEdges(
  ctx: CanvasRenderingContext2D,
  unexploredMask: Path2D,
  exploredOnlyMask: Path2D,
  visibleMask: Path2D,
  unexploredOpacity: number,
  exploredOpacity: number
): void {
  ctx.save();
  
  // Layer 1: Unexplored areas (opaque black)
  ctx.fillStyle = `rgba(0, 0, 0, ${unexploredOpacity})`;
  ctx.fill(unexploredMask);
  
  // Layer 2: Explored but not visible (semi-transparent)
  ctx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  ctx.fill(exploredOnlyMask);
  
  // Layer 3: Visible areas - fully clear (nothing to render)
  
  ctx.restore();
}

/**
 * Render fog edge debug visualization
 * Shows gradient boundaries for development
 */
export function renderGradientDebug(
  ctx: CanvasRenderingContext2D,
  visibleTokens: Array<{ position: Point; visionRange: number }>,
  gradientSettings: GradientSettings
): void {
  ctx.save();
  
  visibleTokens.forEach(({ position, visionRange }) => {
    const { innerFadeStart, midpointPosition, outerFadeStart } = gradientSettings;
    
    // Draw gradient zones as circles
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    
    // Inner zone
    ctx.beginPath();
    ctx.arc(position.x, position.y, visionRange * innerFadeStart, 0, Math.PI * 2);
    ctx.stroke();
    
    // Midpoint
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, visionRange * midpointPosition, 0, Math.PI * 2);
    ctx.stroke();
    
    // Outer fade
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, visionRange * outerFadeStart, 0, Math.PI * 2);
    ctx.stroke();
    
    // Full range
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, visionRange, 0, Math.PI * 2);
    ctx.stroke();
  });
  
  ctx.restore();
}
