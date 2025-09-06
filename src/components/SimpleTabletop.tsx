import React, { useEffect, useRef, useState } from 'react';
import { Toolbar } from './Toolbar';
import { MapManager } from './MapManager';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';

export const SimpleTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showMapManager, setShowMapManager] = useState(false);
  
  // Pan and zoom state
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    zoom: 1
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  const {
    sessionId,
    tokens,
    addToken,
    currentPlayerId,
  } = useSessionStore();

  const { maps, getVisibleMaps } = useMapStore();

  // Function to redraw the canvas
  const redrawCanvas = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context
    ctx.save();
    
    // Apply transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.zoom, transform.zoom);
    
    // Draw dark background
    const viewWidth = canvas.width / transform.zoom;
    const viewHeight = canvas.height / transform.zoom;
    const viewX = -transform.x / transform.zoom;
    const viewY = -transform.y / transform.zoom;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(viewX - 1000, viewY - 1000, viewWidth + 2000, viewHeight + 2000);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 / transform.zoom; // Keep line width consistent
    
    const gridSize = 40;
    const startX = Math.floor((viewX - 1000) / gridSize) * gridSize;
    const endX = Math.ceil((viewX + viewWidth + 1000) / gridSize) * gridSize;
    const startY = Math.floor((viewY - 1000) / gridSize) * gridSize;
    const endY = Math.ceil((viewY + viewHeight + 1000) / gridSize) * gridSize;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
    
    // Restore context
    ctx.restore();
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80;

    // Initial draw
    redrawCanvas();

    toast.success('Pan/Zoom Tabletop Ready! Right-click drag to pan, scroll to zoom.');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 80;
      redrawCanvas();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Redraw when transform changes
  useEffect(() => {
    redrawCanvas();
  }, [transform]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) { // Right click
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) { // Right click
      setIsPanning(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, transform.zoom * zoomFactor));
    
    // Zoom towards mouse position
    const zoomRatio = newZoom / transform.zoom;
    const newX = mouseX - (mouseX - transform.x) * zoomRatio;
    const newY = mouseY - (mouseY - transform.y) * zoomRatio;
    
    setTransform({
      x: newX,
      y: newY,
      zoom: newZoom
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent browser context menu
  };

  const addTokenToCanvas = async (imageUrl: string, x: number = 100, y: number = 100) => {
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Add to store
      addToken({
        id: tokenId,
        imageUrl,
        x,
        y,
        name: `Token ${tokenId.slice(-8)}`,
        gridWidth: 1,
        gridHeight: 1,
        label: `Token ${tokenId.slice(-8)}`,
        ownerId: currentPlayerId,
        color: '#ffffff'
      });

      toast.success('Token added to map');
    } catch (error) {
      console.error('Failed to add token:', error);
      toast.error('Failed to add token');
    }
  };

  return (
    <div className="w-full h-screen bg-surface flex flex-col relative">
      {/* Toolbar */}
      <Toolbar 
        sessionId={sessionId} 
        addTokenToCanvas={addTokenToCanvas}
      />
      
      {/* Map Manager Button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowMapManager(true)}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Maps
        </Button>
      </div>

      {/* Main Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ 
            background: 'hsl(var(--surface))',
            cursor: isPanning ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* Map Manager Modal */}
      {showMapManager && (
        <MapManager onClose={() => setShowMapManager(false)} />
      )}
    </div>
  );
};

export default SimpleTabletop;