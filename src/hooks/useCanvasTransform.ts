import { useState, useCallback, useEffect, useRef } from 'react';
import { useViewportStore } from '@/stores/viewportStore';
import { useMapStore } from '@/stores/mapStore';

export interface Transform {
  x: number;
  y: number;
  zoom: number;
}

export const useCanvasTransform = (initialZoom = 1) => {
  // Get current map ID for per-map viewport persistence
  const selectedMapId = useMapStore((state) => state.selectedMapId);
  const transforms = useViewportStore((state) => state.transforms);
  const setPersistedTransform = useViewportStore((state) => state.setTransform);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserInteracting = useRef(false);
  
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: initialZoom });
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Restore transform from persisted store when map changes or on initial hydration
  useEffect(() => {
    // Don't restore if user is actively interacting (panning/zooming)
    if (isUserInteracting.current) return;
    
    if (selectedMapId && transforms[selectedMapId]) {
      const persisted = transforms[selectedMapId];
      setTransform(persisted);
    }
  }, [selectedMapId, transforms]);
  
  // Save transform to persisted store whenever it changes (throttled)
  const saveTransform = useCallback((newTransform: Transform) => {
    if (!selectedMapId) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      setPersistedTransform(selectedMapId, newTransform);
      saveTimeoutRef.current = null;
    }, 300);
  }, [selectedMapId, setPersistedTransform]);

  // Wrapper for setTransform that also saves
  const setTransformAndSave = useCallback((updater: Transform | ((prev: Transform) => Transform)) => {
    setTransform(prev => {
      const newTransform = typeof updater === 'function' ? updater(prev) : updater;
      saveTransform(newTransform);
      return newTransform;
    });
  }, [saveTransform]);

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
    isUserInteracting.current = true;
    setIsPanning(true);
    setLastPanPoint({ x, y });
  }, []);

  const updatePan = useCallback((x: number, y: number) => {
    if (!isPanning) return;
    
    const dx = x - lastPanPoint.x;
    const dy = y - lastPanPoint.y;
    
    setTransformAndSave(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setLastPanPoint({ x, y });
  }, [isPanning, lastPanPoint, setTransformAndSave]);

  const endPan = useCallback(() => {
    setIsPanning(false);
    // Delay resetting interaction flag to allow save to complete
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 400);
  }, []);

  const zoom = useCallback((delta: number, centerX: number, centerY: number) => {
    isUserInteracting.current = true;
    setTransformAndSave(prev => {
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
    // Delay resetting interaction flag
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 400);
  }, [setTransformAndSave]);

  // Keyboard zoom with + and - keys (zooms toward center of viewport)
  const zoomByKey = useCallback((zoomIn: boolean) => {
    isUserInteracting.current = true;
    setTransformAndSave(prev => {
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
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 400);
  }, [setTransformAndSave]);

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
    setTransformAndSave(prev => ({
      x: canvasWidth / 2 - worldX * prev.zoom,
      y: canvasHeight / 2 - worldY * prev.zoom,
      zoom: prev.zoom
    }));
  }, [setTransformAndSave]);

  return {
    transform,
    setTransform: setTransformAndSave,
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
