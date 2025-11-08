// Wall texture patterns for dungeon map aesthetics

export type WallEdgeStyle = 'stone' | 'wood' | 'metal' | 'simple';

export interface EdgeStyleConfig {
  baseColor: string;
  shadowColor: string;
  baseWidth: number;
  shadowWidth: number;
  alpha: number;
  textureEnabled: boolean;
}

export const EDGE_STYLES: Record<WallEdgeStyle, EdgeStyleConfig> = {
  stone: {
    baseColor: '#8b7355',
    shadowColor: '#5a4a3a',
    baseWidth: 3,
    shadowWidth: 1.5,
    alpha: 0.8,
    textureEnabled: true,
  },
  wood: {
    baseColor: '#6b5235',
    shadowColor: '#3d2f1f',
    baseWidth: 3.5,
    shadowWidth: 2,
    alpha: 0.85,
    textureEnabled: true,
  },
  metal: {
    baseColor: '#4a5568',
    shadowColor: '#2d3748',
    baseWidth: 2.5,
    shadowWidth: 1,
    alpha: 0.9,
    textureEnabled: true,
  },
  simple: {
    baseColor: '#666666',
    shadowColor: '#444444',
    baseWidth: 2,
    shadowWidth: 1,
    alpha: 0.7,
    textureEnabled: false,
  },
};

/**
 * Apply hatching pattern along a path
 */
export function applyHatchingPattern(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  zoom: number,
  style: WallEdgeStyle,
  scale: number = 1
): void {
  if (!EDGE_STYLES[style].textureEnabled) return;
  
  ctx.save();
  ctx.strokeStyle = EDGE_STYLES[style].shadowColor;
  ctx.lineWidth = 0.5 / zoom;
  ctx.globalAlpha = 0.4;
  
  const hatchSpacing = (8 / zoom) / scale;
  const hatchLength = (6 / zoom) / scale;
  
  // Draw hatching perpendicular to edges
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / length; // Normal vector
    const ny = dx / length;
    
    const numHatches = Math.floor(length / hatchSpacing);
    for (let j = 0; j < numHatches; j++) {
      const t = j / numHatches;
      const x = p1.x + t * dx;
      const y = p1.y + t * dy;
      
      // Add randomness for hand-drawn look
      const offset = (Math.random() - 0.5) * 2 / zoom;
      const variance = 0.7 + Math.random() * 0.6;
      
      ctx.beginPath();
      ctx.moveTo(x + offset, y + offset);
      ctx.lineTo(
        x + nx * hatchLength * variance + offset,
        y + ny * hatchLength * variance + offset
      );
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

/**
 * Apply stippling pattern along a path
 */
export function applyStipplingPattern(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  zoom: number,
  style: WallEdgeStyle,
  scale: number = 1
): void {
  if (!EDGE_STYLES[style].textureEnabled) return;
  
  ctx.save();
  ctx.fillStyle = EDGE_STYLES[style].shadowColor;
  ctx.globalAlpha = 0.3;
  
  const dotSpacing = (4 / zoom) / scale;
  const dotSize = (0.8 / zoom) / scale;
  const density = (style === 'stone' ? 1.2 : style === 'wood' ? 0.8 : 1.0) * scale;
  
  // Draw stippling dots along the edge
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / length; // Normal vector
    const ny = dx / length;
    
    const numDots = Math.floor(length / dotSpacing) * density;
    for (let j = 0; j < numDots; j++) {
      const t = Math.random(); // Random position for organic look
      const x = p1.x + t * dx;
      const y = p1.y + t * dy;
      
      // Offset slightly into the wall
      const offsetDist = (Math.random() * 3 + 1) / zoom;
      const xOffset = nx * offsetDist;
      const yOffset = ny * offsetDist;
      
      ctx.beginPath();
      ctx.arc(x + xOffset, y + yOffset, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

/**
 * Draw wood grain pattern
 */
export function applyWoodGrainPattern(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  zoom: number,
  scale: number = 1
): void {
  ctx.save();
  ctx.strokeStyle = '#4a3820';
  ctx.lineWidth = 0.6 / zoom;
  ctx.globalAlpha = 0.3;
  
  const grainSpacing = (12 / zoom) / scale;
  
  // Draw wavy lines parallel to edges
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const numGrains = Math.floor(length / grainSpacing);
    for (let j = 0; j < numGrains; j++) {
      const t = j / numGrains;
      const x = p1.x + t * dx;
      const y = p1.y + t * dy;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      // Create wavy grain line
      const segments = 5;
      for (let k = 1; k <= segments; k++) {
        const st = k / segments;
        const waveOffset = Math.sin(st * Math.PI * 2) * 2 / zoom;
        ctx.lineTo(
          x + st * (dx / numGrains) + waveOffset,
          y + st * (dy / numGrains)
        );
      }
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

/**
 * Apply thickness variation for organic appearance
 */
export function getVariedLineWidth(
  baseWidth: number,
  position: number,
  totalLength: number,
  zoom: number
): number {
  // Use sine wave with noise for organic variation
  const wave = Math.sin(position / totalLength * Math.PI * 4);
  const noise = (Math.random() - 0.5) * 0.3;
  const variation = 0.7 + (wave * 0.15) + noise;
  
  return (baseWidth * variation) / zoom;
}

/**
 * Get path points from region
 */
export function getRegionEdgePoints(region: any): Array<{ x: number; y: number }> {
  if (region.regionType === 'path' && region.pathPoints) {
    return [...region.pathPoints, region.pathPoints[0]]; // Close the path
  } else {
    // Rectangle region
    return [
      { x: region.x, y: region.y },
      { x: region.x + region.width, y: region.y },
      { x: region.x + region.width, y: region.y + region.height },
      { x: region.x, y: region.y + region.height },
      { x: region.x, y: region.y },
    ];
  }
}
