import React, { useEffect, useRef } from 'react';
import { 
  drawFootprintPath, 
  drawStyledLinePath,
  type PathStyle,
  type FootprintType 
} from '@/lib/footprintShapes';

interface TokenPathPreviewCanvasProps {
  pathStyle: PathStyle;
  footprintType: FootprintType;
  pathColor: string;
  pathWeight: number;
  pathOpacity: number;
}

export const TokenPathPreviewCanvas: React.FC<TokenPathPreviewCanvasProps> = ({
  pathStyle,
  footprintType,
  pathColor,
  pathWeight,
  pathOpacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (pathStyle === 'none') {
      // Draw "No path" text
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No path preview', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Create a curved sample path
    const path: { x: number; y: number }[] = [];
    const startX = 20;
    const endX = canvas.width - 20;
    const centerY = canvas.height / 2;
    const amplitude = 15;

    // Generate a smooth curved path
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = startX + (endX - startX) * t;
      const y = centerY + Math.sin(t * Math.PI * 2) * amplitude * (1 - t * 0.3);
      path.push({ x, y });
    }

    // Draw based on path style
    if (pathStyle === 'footprint') {
      // Scale down for preview
      const previewSize = Math.min(pathWeight * 6, 24);
      drawFootprintPath(
        ctx,
        path,
        footprintType,
        pathColor,
        previewSize,
        pathOpacity,
        1 // zoom = 1 for preview
      );
    } else {
      // Solid or dashed line
      drawStyledLinePath(
        ctx,
        path,
        pathStyle,
        pathColor,
        pathWeight,
        pathOpacity,
        1 // zoom = 1 for preview
      );
    }

    // Draw direction arrow at end
    const lastPoint = path[path.length - 1];
    const prevPoint = path[path.length - 2];
    const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);

    ctx.save();
    ctx.translate(lastPoint.x, lastPoint.y);
    ctx.rotate(angle);
    ctx.fillStyle = pathColor;
    ctx.globalAlpha = pathOpacity;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  }, [pathStyle, footprintType, pathColor, pathWeight, pathOpacity]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={60}
      className="w-full h-15 rounded border border-border"
    />
  );
};
