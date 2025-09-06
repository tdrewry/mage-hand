import React, { useEffect, useRef, useState } from 'react';
import { Point } from 'paper';
import { Toolbar } from './Toolbar';
import { FloatingMenu } from './FloatingMenu';
import { MapManager } from './MapManager';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { toast } from 'sonner';
import { PaperMapSystem } from '../lib/paperMapSystem';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';

export const PaperTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapSystem, setMapSystem] = useState<PaperMapSystem | null>(null);
  const [showMapManager, setShowMapManager] = useState(false);

  const {
    sessionId,
    tokens,
    addToken,
    updateTokenPosition,
    updateTokenLabel,
    updateTokenColor,
    selectedTokenIds,
    setSelectedTokens,
    tokenVisibility,
    labelVisibility,
    currentPlayerId,
    players,
    removeToken
  } = useSessionStore();

  const { maps, getVisibleMaps } = useMapStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80;

    const system = new PaperMapSystem(canvas);
    setMapSystem(system);

    // Load existing maps
    loadMaps(system);
    
    // Load existing tokens
    loadTokens(system);

    toast.success('Paper.js Tabletop Ready!');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 80;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      system.dispose();
    };
  }, []);

  const loadMaps = async (system: PaperMapSystem) => {
    const visibleMaps = getVisibleMaps();
    
    for (const map of visibleMaps) {
      try {
        await system.addMap({
          id: map.id,
          name: map.name,
          imageUrl: map.imageUrl,
          bounds: map.bounds,
          zIndex: map.zIndex
        });

        // Add regions
        for (const region of map.regions) {
          if (region.visible && region.gridType !== 'none') {
            system.addMapRegion(map.id, {
              id: region.id,
              bounds: region.bounds,
              gridType: region.gridType as 'square' | 'hex',
              gridSize: region.gridSize,
              gridColor: region.gridColor,
              gridOpacity: region.gridOpacity
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to load map ${map.name}:`, error);
      }
    }
  };

  const loadTokens = async (system: PaperMapSystem) => {
    for (const token of tokens) {
      try {
        await system.addToken({
          id: token.id,
          imageUrl: token.imageUrl,
          position: new Point(token.x, token.y),
          label: token.label,
          color: token.color
        });
      } catch (error) {
        console.warn(`Failed to load token ${token.name}:`, error);
      }
    }
  };

  const addTokenToCanvas = async (imageUrl: string, x: number = 100, y: number = 100) => {
    if (!mapSystem) return;

    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await mapSystem.addToken({
        id: tokenId,
        imageUrl,
        position: new Point(x, y),
        label: `Token ${tokenId.slice(-8)}`,
        color: '#ffffff'
      });

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

  const handleTokenColorChange = (tokenId: string, color: string) => {
    // Update in store
    updateTokenColor(tokenId, color);
    
    // TODO: Update Paper.js token color
    toast.info('Token color updated');
  };

  const handleCanvasUpdate = () => {
    // Paper.js handles this automatically
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

export default PaperTabletop;