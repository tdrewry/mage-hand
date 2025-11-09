import React, { useRef, useEffect } from 'react';
import { useCanvasTransform } from '@/hooks/useCanvasTransform';
import { useTokenInteraction } from '@/hooks/useTokenInteraction';
import { useRegionInteraction } from '@/hooks/useRegionInteraction';
import { useSessionStore } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { useRegionStore } from '@/stores/regionStore';

export const MapCardContent = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    transform, 
    screenToWorld, 
    worldToScreen,
    startPan, 
    updatePan, 
    endPan, 
    zoom 
  } = useCanvasTransform();
  
  const {
    selectedTokenIds,
    isDraggingToken,
    dragPath,
    getTokenAtPosition,
    startTokenDrag,
    updateTokenDrag,
    endTokenDrag,
    selectToken,
    clearSelection: clearTokenSelection
  } = useTokenInteraction();

  const {
    isDraggingRegion,
    getRegionAtPosition,
    startRegionDrag,
    updateRegionDrag,
    endRegionDrag
  } = useRegionInteraction();

  const { tokens } = useSessionStore();
  const { maps } = useMapStore();
  const { regions } = useRegionStore();

  // Canvas mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (e.button === 2 || e.button === 1) {
      // Middle or right mouse button - pan
      startPan(e.clientX, e.clientY);
      return;
    }

    // Check for token
    const token = getTokenAtPosition(world.x, world.y);
    if (token) {
      startTokenDrag(token.id, world.x, world.y, e.shiftKey);
      return;
    }

    // Check for region
    const region = getRegionAtPosition(world.x, world.y);
    if (region) {
      startRegionDrag(region.id, world.x, world.y);
      return;
    }

    // Clear selection
    clearTokenSelection();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    updatePan(e.clientX, e.clientY);

    if (isDraggingToken) {
      updateTokenDrag(world.x, world.y);
    } else if (isDraggingRegion) {
      updateRegionDrag(world.x, world.y);
    }
  };

  const handleMouseUp = () => {
    endPan();
    
    if (isDraggingToken) {
      endTokenDrag();
    }
    
    if (isDraggingRegion) {
      endRegionDrag();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    zoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    // Draw maps
    maps.forEach(map => {
      if (!map.visible) return;
      // TODO: Draw map images
    });

    // Draw regions
    regions.forEach(region => {
      ctx.strokeStyle = region.color || '#ffffff';
      ctx.lineWidth = 2 / transform.zoom;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
    });

    // Draw tokens
    tokens.forEach(token => {
      const isSelected = selectedTokenIds.includes(token.id);
      
      ctx.fillStyle = token.color;
      ctx.beginPath();
      ctx.arc(token.x, token.y, 20, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3 / transform.zoom;
        ctx.stroke();
      }

      // Draw label
      if (token.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${14 / transform.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(token.label, token.x, token.y - 25);
      }
    });

    // Draw drag path
    if (isDraggingToken && dragPath.length > 1) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2 / transform.zoom;
      ctx.setLineDash([5 / transform.zoom, 5 / transform.zoom]);
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x, dragPath[0].y);
      dragPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [transform, tokens, regions, maps, selectedTokenIds, isDraggingToken, dragPath]);

  return (
    <div className="relative w-full h-full bg-background">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};
