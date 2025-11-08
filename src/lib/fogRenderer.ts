/**
 * Fog Renderer - Canvas rendering for fog of war layers
 * Handles three-layer rendering: unexplored, explored, and visible
 */

/**
 * Render fog of war with three distinct layers
 * @param ctx - Canvas 2D context
 * @param unexploredMask - Areas that have never been seen (opaque)
 * @param exploredOnlyMask - Areas seen before but not currently visible (semi-transparent)
 * @param visibleMask - Currently visible areas (no fog)
 * @param unexploredOpacity - Darkness for unexplored areas (0-1)
 * @param exploredOpacity - Darkness for explored areas (0-1)
 */
export function renderFogLayers(
  ctx: CanvasRenderingContext2D,
  unexploredMask: Path2D,
  exploredOnlyMask: Path2D,
  visibleMask: Path2D,
  unexploredOpacity: number = 0.95,
  exploredOpacity: number = 0.4
) {
  ctx.save();
  
  // Layer 1: Unexplored areas (opaque black)
  ctx.fillStyle = `rgba(0, 0, 0, ${unexploredOpacity})`;
  ctx.fill(unexploredMask);
  
  // Layer 2: Explored but not visible (semi-transparent)
  ctx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
  ctx.fill(exploredOnlyMask);
  
  // Layer 3: Visible areas - nothing to render (fully clear)
  // The visible mask is used for other purposes like edge rendering
  
  ctx.restore();
}

/**
 * Render soft edges around visible areas (optional enhancement)
 */
export function renderFogEdges(
  ctx: CanvasRenderingContext2D,
  visibleMask: Path2D,
  edgeWidth: number = 10,
  edgeOpacity: number = 0.2
) {
  ctx.save();
  
  ctx.strokeStyle = `rgba(0, 0, 0, ${edgeOpacity})`;
  ctx.lineWidth = edgeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(visibleMask);
  
  ctx.restore();
}

/**
 * Render debug visualization for fog masks (development only)
 */
export function renderFogDebug(
  ctx: CanvasRenderingContext2D,
  unexploredMask: Path2D,
  exploredOnlyMask: Path2D,
  visibleMask: Path2D
) {
  ctx.save();
  
  // Unexplored: Red tint
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  ctx.fill(unexploredMask);
  
  // Explored: Green tint
  ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
  ctx.fill(exploredOnlyMask);
  
  // Visible: Blue tint
  ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
  ctx.fill(visibleMask);
  
  // Draw borders
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.stroke(unexploredMask);
  
  ctx.strokeStyle = 'green';
  ctx.stroke(exploredOnlyMask);
  
  ctx.strokeStyle = 'blue';
  ctx.stroke(visibleMask);
  
  ctx.restore();
}
