import { useState, useCallback } from 'react';
import { useRegionStore, type CanvasRegion } from '@/stores/regionStore';
import { isPointInPolygon, isPointNearPolygonEdge, findNearestVertex } from '@/utils/pathUtils';

const isPointInRegion = (x: number, y: number, region: CanvasRegion): boolean => {
  if (region.regionType === 'path' && region.pathPoints) {
    return isPointInPolygon({ x, y }, region.pathPoints);
  } else {
    return x >= region.x && x <= region.x + region.width &&
           y >= region.y && y <= region.y + region.height;
  }
};

export const useRegionInteraction = () => {
  const { regions, updateRegion, getSelectedRegions } = useRegionStore();
  
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);
  const [draggedRegionId, setDraggedRegionId] = useState<string | null>(null);
  const [regionDragOffset, setRegionDragOffset] = useState({ x: 0, y: 0 });
  const [isResizingRegion, setIsResizingRegion] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  
  // Path drawing
  const [pathDrawingMode, setPathDrawingMode] = useState<'none' | 'drawing' | 'editing'>('none');
  const [pathDrawingType, setPathDrawingType] = useState<'polygon' | 'freehand'>('polygon');
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
  
  // Transformation
  const [transformMode, setTransformMode] = useState<'move' | 'scale' | 'rotate'>('move');
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformHandle, setTransformHandle] = useState<string | null>(null);

  const getRegionAtPosition = useCallback((worldX: number, worldY: number): CanvasRegion | null => {
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      if (isPointInRegion(worldX, worldY, region)) {
        return region;
      }
    }
    return null;
  }, [regions]);

  const startRegionDrag = useCallback((regionId: string, worldX: number, worldY: number) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return;

    setIsDraggingRegion(true);
    setDraggedRegionId(regionId);
    
    if (region.regionType === 'path' && region.pathPoints) {
      const bounds = region.pathPoints.reduce((acc, p) => ({
        minX: Math.min(acc.minX, p.x),
        minY: Math.min(acc.minY, p.y),
        maxX: Math.max(acc.maxX, p.x),
        maxY: Math.max(acc.maxY, p.y)
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      setRegionDragOffset({ x: worldX - centerX, y: worldY - centerY });
    } else {
      setRegionDragOffset({ x: worldX - region.x, y: worldY - region.y });
    }
  }, [regions]);

  const updateRegionDrag = useCallback((worldX: number, worldY: number) => {
    if (!isDraggingRegion || !draggedRegionId) return;

    const region = regions.find(r => r.id === draggedRegionId);
    if (!region) return;

    const newX = worldX - regionDragOffset.x;
    const newY = worldY - regionDragOffset.y;

    if (region.regionType === 'path' && region.pathPoints) {
      const bounds = region.pathPoints.reduce((acc, p) => ({
        minX: Math.min(acc.minX, p.x),
        minY: Math.min(acc.minY, p.y),
        maxX: Math.max(acc.maxX, p.x),
        maxY: Math.max(acc.maxY, p.y)
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const dx = newX - centerX;
      const dy = newY - centerY;

      updateRegion(draggedRegionId, {
        pathPoints: region.pathPoints.map(p => ({ x: p.x + dx, y: p.y + dy }))
      });
    } else {
      updateRegion(draggedRegionId, { x: newX, y: newY });
    }
  }, [isDraggingRegion, draggedRegionId, regionDragOffset, regions, updateRegion]);

  const endRegionDrag = useCallback(() => {
    setIsDraggingRegion(false);
    setDraggedRegionId(null);
  }, []);

  const startPathDrawing = useCallback((type: 'polygon' | 'freehand') => {
    setPathDrawingMode('drawing');
    setPathDrawingType(type);
    setCurrentPath([]);
  }, []);

  const addPathPoint = useCallback((x: number, y: number) => {
    setCurrentPath(prev => [...prev, { x, y }]);
  }, []);

  const finishPath = useCallback(() => {
    setPathDrawingMode('none');
    const path = currentPath;
    setCurrentPath([]);
    return path;
  }, [currentPath]);

  const cancelPath = useCallback(() => {
    setPathDrawingMode('none');
    setCurrentPath([]);
  }, []);

  return {
    selectedRegionId,
    isDraggingRegion,
    draggedRegionId,
    isResizingRegion,
    resizeHandle,
    pathDrawingMode,
    pathDrawingType,
    currentPath,
    transformMode,
    isTransforming,
    getRegionAtPosition,
    startRegionDrag,
    updateRegionDrag,
    endRegionDrag,
    startPathDrawing,
    addPathPoint,
    finishPath,
    cancelPath,
    setSelectedRegionId,
    setTransformMode,
    setPathDrawingMode
  };
};
