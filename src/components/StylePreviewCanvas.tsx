import React, { useEffect, useRef } from 'react';
import { 
  EDGE_STYLES,
  applyHatchingPattern,
  applyStipplingPattern,
  applyWoodGrainPattern,
  getVariedLineWidth,
  type WallEdgeStyle 
} from '@/lib/wallTexturePatterns';

interface StylePreviewCanvasProps {
  style: WallEdgeStyle;
  isSelected: boolean;
}

export const StylePreviewCanvas: React.FC<StylePreviewCanvasProps> = ({ style, isSelected }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background
    ctx.fillStyle = isSelected ? 'hsl(var(--accent))' : 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const config = EDGE_STYLES[style];
    const zoom = 1; // Fixed zoom for preview
    const wallThickness = 1; // Base thickness for preview
    const textureScale = 1; // Base scale for preview

    // Create a sample curved path
    const points = [
      { x: 10, y: 40 },
      { x: 30, y: 20 },
      { x: 50, y: 30 },
      { x: 70, y: 15 },
      { x: 90, y: 35 },
    ];

    // Calculate total length
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    // Draw base edge with varied thickness
    ctx.strokeStyle = config.baseColor;
    ctx.globalAlpha = config.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let currentPos = 0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineWidth = getVariedLineWidth(config.baseWidth * wallThickness, currentPos, totalLength);
      ctx.lineTo(points[i].x, points[i].y);
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      currentPos += Math.sqrt(dx * dx + dy * dy);
    }
    ctx.stroke();

    // Draw shadow layer
    ctx.strokeStyle = config.shadowColor;
    ctx.lineWidth = config.shadowWidth * wallThickness;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Apply texture patterns
    if (config.textureEnabled) {
      if (style === 'stone') {
        applyHatchingPattern(ctx, points, style, textureScale);
        applyStipplingPattern(ctx, points, style, textureScale);
      } else if (style === 'wood') {
        applyWoodGrainPattern(ctx, points, textureScale);
        applyStipplingPattern(ctx, points, style, textureScale);
      } else if (style === 'metal') {
        applyHatchingPattern(ctx, points, style, textureScale);
      }
    }
  }, [style, isSelected]);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={50}
      className="w-full h-12 rounded border border-border"
    />
  );
};
