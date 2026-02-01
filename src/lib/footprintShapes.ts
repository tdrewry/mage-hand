/**
 * Footprint Shape Library
 * 
 * Canvas 2D path functions for rendering various footprint types
 * used in token movement path visualization.
 */

export type FootprintType = 'barefoot' | 'boot' | 'paw' | 'hoof' | 'claw';
export type PathStyle = 'dashed' | 'solid' | 'footprint' | 'none';

export const FOOTPRINT_TYPES: { type: FootprintType; label: string; icon: string }[] = [
  { type: 'barefoot', label: 'Barefoot', icon: '🦶' },
  { type: 'boot', label: 'Boot', icon: '👢' },
  { type: 'paw', label: 'Paw', icon: '🐾' },
  { type: 'hoof', label: 'Hoof', icon: '🐴' },
  { type: 'claw', label: 'Claw', icon: '🦅' },
];

export const PATH_STYLES: { style: PathStyle; label: string }[] = [
  { style: 'dashed', label: 'Dashed Line' },
  { style: 'solid', label: 'Solid Line' },
  { style: 'footprint', label: 'Footprints' },
  { style: 'none', label: 'None' },
];

/**
 * Main function to draw a single footprint at a given position
 */
export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  type: FootprintType,
  x: number,
  y: number,
  size: number,
  rotation: number,
  isLeftFoot: boolean,
  color: string,
  opacity: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  if (isLeftFoot) ctx.scale(-1, 1); // Mirror for left foot
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.05;

  switch (type) {
    case 'barefoot':
      drawBarefootPrint(ctx, size);
      break;
    case 'boot':
      drawBootPrint(ctx, size);
      break;
    case 'paw':
      drawPawPrint(ctx, size);
      break;
    case 'hoof':
      drawHoofPrint(ctx, size);
      break;
    case 'claw':
      drawClawPrint(ctx, size);
      break;
  }

  ctx.restore();
}

/**
 * Draw a barefoot print - oval heel, ball, and 5 toes
 */
function drawBarefootPrint(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / 30; // Base size is 30

  // Heel (bottom ellipse)
  ctx.beginPath();
  ctx.ellipse(0, 8 * scale, 5 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball of foot (top ellipse, wider)
  ctx.beginPath();
  ctx.ellipse(0, -4 * scale, 7 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Toes - 5 small circles in an arc
  const toePositions = [
    { x: -5 * scale, y: -11 * scale, r: 2.2 * scale },
    { x: -2.5 * scale, y: -13 * scale, r: 2.5 * scale },
    { x: 0.5 * scale, y: -14 * scale, r: 2.3 * scale },
    { x: 3.5 * scale, y: -12.5 * scale, r: 2.0 * scale },
    { x: 5.5 * scale, y: -10 * scale, r: 1.8 * scale },
  ];

  toePositions.forEach(toe => {
    ctx.beginPath();
    ctx.arc(toe.x, toe.y, toe.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Draw a boot print - rounded rectangle sole with heel
 */
function drawBootPrint(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / 30;

  // Main sole shape
  ctx.beginPath();
  
  // Draw rounded rectangle for boot sole
  const soleWidth = 10 * scale;
  const soleHeight = 22 * scale;
  const radius = 3 * scale;
  
  ctx.moveTo(-soleWidth / 2 + radius, -soleHeight / 2);
  ctx.lineTo(soleWidth / 2 - radius, -soleHeight / 2);
  ctx.quadraticCurveTo(soleWidth / 2, -soleHeight / 2, soleWidth / 2, -soleHeight / 2 + radius);
  ctx.lineTo(soleWidth / 2, soleHeight / 2 - radius);
  ctx.quadraticCurveTo(soleWidth / 2, soleHeight / 2, soleWidth / 2 - radius, soleHeight / 2);
  ctx.lineTo(-soleWidth / 2 + radius, soleHeight / 2);
  ctx.quadraticCurveTo(-soleWidth / 2, soleHeight / 2, -soleWidth / 2, soleHeight / 2 - radius);
  ctx.lineTo(-soleWidth / 2, -soleHeight / 2 + radius);
  ctx.quadraticCurveTo(-soleWidth / 2, -soleHeight / 2, -soleWidth / 2 + radius, -soleHeight / 2);
  ctx.closePath();
  ctx.fill();

  // Heel indent (darker)
  ctx.globalAlpha = ctx.globalAlpha * 0.3;
  ctx.beginPath();
  ctx.roundRect(
    -4 * scale,
    6 * scale,
    8 * scale,
    6 * scale,
    2 * scale
  );
  ctx.fill();

  // Toe grip pattern
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.roundRect(
      -3.5 * scale,
      (-8 - i * 3) * scale,
      7 * scale,
      2 * scale,
      1 * scale
    );
  }
  ctx.fill();
}

/**
 * Draw a paw print - central pad with 4 toe pads
 */
function drawPawPrint(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / 30;

  // Main pad (heart-shaped / triangular)
  ctx.beginPath();
  ctx.moveTo(0, 6 * scale);
  ctx.bezierCurveTo(
    -8 * scale, 4 * scale,
    -8 * scale, -4 * scale,
    -3 * scale, -4 * scale
  );
  ctx.bezierCurveTo(
    -1 * scale, -4 * scale,
    0, -2 * scale,
    0, -2 * scale
  );
  ctx.bezierCurveTo(
    0, -2 * scale,
    1 * scale, -4 * scale,
    3 * scale, -4 * scale
  );
  ctx.bezierCurveTo(
    8 * scale, -4 * scale,
    8 * scale, 4 * scale,
    0, 6 * scale
  );
  ctx.closePath();
  ctx.fill();

  // Toe pads - 4 ovals above the main pad
  const toePads = [
    { x: -5.5 * scale, y: -8 * scale, rx: 2.5 * scale, ry: 3 * scale, rotation: -0.3 },
    { x: -2 * scale, y: -11 * scale, rx: 2.5 * scale, ry: 3.2 * scale, rotation: -0.1 },
    { x: 2 * scale, y: -11 * scale, rx: 2.5 * scale, ry: 3.2 * scale, rotation: 0.1 },
    { x: 5.5 * scale, y: -8 * scale, rx: 2.5 * scale, ry: 3 * scale, rotation: 0.3 },
  ];

  toePads.forEach(pad => {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.rotation);
    ctx.beginPath();
    ctx.ellipse(0, 0, pad.rx, pad.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

/**
 * Draw a hoof print - U-shape with cleft
 */
function drawHoofPrint(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / 30;

  // U-shaped hoof outline
  ctx.beginPath();
  ctx.moveTo(-7 * scale, -10 * scale);
  ctx.lineTo(-7 * scale, 2 * scale);
  ctx.bezierCurveTo(
    -7 * scale, 10 * scale,
    0, 12 * scale,
    0, 12 * scale
  );
  ctx.bezierCurveTo(
    0, 12 * scale,
    7 * scale, 10 * scale,
    7 * scale, 2 * scale
  );
  ctx.lineTo(7 * scale, -10 * scale);
  ctx.closePath();
  ctx.fill();

  // Cleft (vertical line dividing the hoof)
  ctx.globalAlpha = ctx.globalAlpha * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, -8 * scale);
  ctx.lineTo(0, 8 * scale);
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
}

/**
 * Draw a claw print - 3 forward toes with talons, 1 rear toe
 */
function drawClawPrint(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / 30;

  // Three forward toes with pointed claws
  const forwardToes = [
    { x: -4 * scale, y: 0, angle: -0.25, length: 12 * scale },
    { x: 0, y: 0, angle: 0, length: 14 * scale },
    { x: 4 * scale, y: 0, angle: 0.25, length: 12 * scale },
  ];

  forwardToes.forEach(toe => {
    ctx.save();
    ctx.translate(toe.x, toe.y);
    ctx.rotate(toe.angle);
    
    // Toe shape (elongated with pointed tip)
    ctx.beginPath();
    ctx.moveTo(-1.5 * scale, 0);
    ctx.lineTo(-1 * scale, -toe.length * 0.7);
    ctx.lineTo(0, -toe.length); // Pointed tip
    ctx.lineTo(1 * scale, -toe.length * 0.7);
    ctx.lineTo(1.5 * scale, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  });

  // Rear toe (smaller, pointing back)
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 2 * scale);
  ctx.lineTo(-0.5 * scale, 7 * scale);
  ctx.lineTo(0, 9 * scale); // Pointed tip
  ctx.lineTo(0.5 * scale, 7 * scale);
  ctx.lineTo(1 * scale, 2 * scale);
  ctx.closePath();
  ctx.fill();

  // Central palm area
  ctx.beginPath();
  ctx.ellipse(0, 3 * scale, 4 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw footprints along a path
 */
export function drawFootprintPath(
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
  footprintType: FootprintType,
  color: string,
  size: number,
  opacity: number,
  gaitWidth: number,
  zoom: number
): void {
  if (path.length < 2) return;

  // Calculate total path length
  let totalLength = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Don't draw if path is too short
  const adjustedSize = size / zoom;
  const stride = adjustedSize * 1.5; // Distance between footprints (increased for better spacing)
  if (totalLength < stride) return;

  // Gait offset (left/right foot offset from centerline) - uses gaitWidth parameter
  const gaitOffset = adjustedSize * gaitWidth;

  // Walk along path and place footprints
  let distanceTraveled = stride * 0.5; // Start half-stride in
  let isLeftFoot = true;
  let stepCount = 0;

  while (distanceTraveled < totalLength) {
    // Find position on path at this distance
    const pos = getPositionOnPath(path, distanceTraveled);
    if (!pos) break;

    // Calculate direction at this point
    const nextPos = getPositionOnPath(path, distanceTraveled + stride * 0.1);
    let angle = 0;
    if (nextPos) {
      angle = Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x) + Math.PI / 2; // Rotate to face direction
    }

    // Apply gait offset perpendicular to direction
    const perpAngle = angle - Math.PI / 2;
    const offsetX = Math.cos(perpAngle) * gaitOffset * (isLeftFoot ? -1 : 1);
    const offsetY = Math.sin(perpAngle) * gaitOffset * (isLeftFoot ? -1 : 1);

    // Calculate opacity gradient (faint at start, more opaque at end)
    const progress = distanceTraveled / totalLength;
    const footOpacity = 0.3 + (opacity - 0.3) * progress;

    // Draw footprint
    drawFootprint(
      ctx,
      footprintType,
      pos.x + offsetX,
      pos.y + offsetY,
      adjustedSize,
      angle,
      isLeftFoot,
      color,
      footOpacity
    );

    // Alternate feet and advance
    isLeftFoot = !isLeftFoot;
    distanceTraveled += stride;
    stepCount++;

    // Safety limit
    if (stepCount > 100) break;
  }
}

/**
 * Get position on path at a given distance from start
 */
function getPositionOnPath(
  path: { x: number; y: number }[],
  targetDistance: number
): { x: number; y: number } | null {
  let distanceTraveled = 0;

  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (distanceTraveled + segmentLength >= targetDistance) {
      // Target is on this segment
      const segmentProgress = (targetDistance - distanceTraveled) / segmentLength;
      return {
        x: path[i - 1].x + dx * segmentProgress,
        y: path[i - 1].y + dy * segmentProgress,
      };
    }

    distanceTraveled += segmentLength;
  }

  // Return last point if we exceeded path length
  return path.length > 0 ? path[path.length - 1] : null;
}

/**
 * Draw a styled line path (solid or dashed with high contrast)
 */
export function drawStyledLinePath(
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
  style: 'solid' | 'dashed',
  color: string,
  weight: number,
  opacity: number,
  zoom: number
): void {
  if (path.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the path
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }

  // Outer stroke (dark shadow for contrast)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = (weight + 2) / zoom;
  if (style === 'dashed') {
    ctx.setLineDash([10 / zoom, 6 / zoom]);
  }
  ctx.globalAlpha = opacity * 0.8;
  ctx.stroke();

  // Inner stroke (colored)
  ctx.strokeStyle = color;
  ctx.lineWidth = weight / zoom;
  ctx.globalAlpha = opacity;
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}
