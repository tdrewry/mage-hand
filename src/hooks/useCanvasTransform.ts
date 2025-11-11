import { useState, useCallback } from 'react';

export interface Transform {
  x: number;
  y: number;
  zoom: number;
}

export const useCanvasTransform = (initialZoom = 1) => {
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    zoom: initialZoom
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - transform.x) / transform.zoom,
      y: (screenY - transform.y) / transform.zoom
    };
  }, [transform]);

  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    return {
      x: worldX * transform.zoom + transform.x,
      y: worldY * transform.zoom + transform.y
    };
  }, [transform]);

  const startPan = useCallback((x: number, y: number) => {
    setIsPanning(true);
    setLastPanPoint({ x, y });
  }, []);

  const updatePan = useCallback((x: number, y: number) => {
    if (!isPanning) return;
    
    const dx = x - lastPanPoint.x;
    const dy = y - lastPanPoint.y;
    
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setLastPanPoint({ x, y });
  }, [isPanning, lastPanPoint]);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  const zoom = useCallback((delta: number, centerX: number, centerY: number) => {
    setTransform(prev => {
      const zoomFactor = delta > 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor));
      
      // Zoom towards cursor position
      const worldX = (centerX - prev.x) / prev.zoom;
      const worldY = (centerY - prev.y) / prev.zoom;
      
      return {
        x: centerX - worldX * newZoom,
        y: centerY - worldY * newZoom,
        zoom: newZoom
      };
    });
  }, []);

  const centerOn = useCallback((worldX: number, worldY: number, canvasWidth: number, canvasHeight: number) => {
    setTransform(prev => ({
      x: canvasWidth / 2 - worldX * prev.zoom,
      y: canvasHeight / 2 - worldY * prev.zoom,
      zoom: prev.zoom
    }));
  }, []);

  return {
    transform,
    setTransform,
    isPanning,
    screenToWorld,
    worldToScreen,
    startPan,
    updatePan,
    endPan,
    zoom,
    centerOn
  };
};
