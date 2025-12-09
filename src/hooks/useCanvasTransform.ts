import { useState, useCallback, useEffect, useRef } from 'react';
import { useViewportStore } from '@/stores/viewportStore';

export interface Transform {
  x: number;
  y: number;
  zoom: number;
}

export const useCanvasTransform = (initialZoom = 1) => {
  // Load initial transform from persisted store
  const persistedTransform = useViewportStore((state) => state.transform);
  const setPersistedTransform = useViewportStore((state) => state.setTransform);
  const hasInitialized = useRef(false);
  
  const [transform, setTransform] = useState<Transform>(() => {
    // Use persisted transform if available, otherwise use defaults
    if (persistedTransform.zoom !== 1 || persistedTransform.x !== 0 || persistedTransform.y !== 0) {
      return persistedTransform;
    }
    return { x: 0, y: 0, zoom: initialZoom };
  });
  
  // Save transform to persisted store whenever it changes (throttled)
  useEffect(() => {
    // Skip initial render to avoid overwriting with default values
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setPersistedTransform(transform);
    }, 500); // Throttle saves to every 500ms
    
    return () => clearTimeout(timeoutId);
  }, [transform, setPersistedTransform]);
  
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

  // Keyboard zoom with + and - keys (zooms toward center of viewport)
  const zoomByKey = useCallback((zoomIn: boolean) => {
    setTransform(prev => {
      const zoomFactor = zoomIn ? 1.15 : 0.87;
      const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor));
      
      // Get viewport center (assume standard viewport, will be adjusted by actual canvas)
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      const worldX = (centerX - prev.x) / prev.zoom;
      const worldY = (centerY - prev.y) / prev.zoom;
      
      return {
        x: centerX - worldX * newZoom,
        y: centerY - worldY * newZoom,
        zoom: newZoom
      };
    });
  }, []);

  // Listen for + and - key presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // + or = (with or without shift) to zoom in
      if (e.key === '+' || e.key === '=' || (e.key === '=' && e.shiftKey)) {
        e.preventDefault();
        zoomByKey(true);
      }
      // - to zoom out
      else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomByKey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomByKey]);

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
    zoomByKey,
    centerOn
  };
};
