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

  const {
    sessionId,
    tokens,
    addToken,
    currentPlayerId,
  } = useSessionStore();

  const { maps, getVisibleMaps } = useMapStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Simple dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw a simple grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    const gridSize = 40;
    
    // Vertical lines
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    toast.success('Simple Tabletop Ready!');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 80;
      // Redraw on resize
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ background: 'hsl(var(--surface))' }}
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