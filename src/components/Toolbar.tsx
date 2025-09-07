import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Share2, Settings, Users, Map, Trash2, Layers } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useRegionStore } from '../stores/regionStore';
import { LayerStackModal } from './LayerStackModal';
import { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';

interface ToolbarProps {
  sessionId?: string;
  fabricCanvas?: FabricCanvas | null;
  addTokenToCanvas?: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void | Promise<void>;
}

export const Toolbar = ({ sessionId, fabricCanvas, addTokenToCanvas }: ToolbarProps) => {
  const { tokens, clearAllTokens } = useSessionStore();
  const { regions, clearRegions } = useRegionStore();
  const [layerModalOpen, setLayerModalOpen] = useState(false);
  
  const shareSession = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    toast.success('Session URL copied to clipboard!');
  };

  const clearTokens = () => {
    // Clear tokens from canvas
    if (fabricCanvas) {
      const objects = fabricCanvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.tokenId || obj.isTokenLabel) {
          fabricCanvas.remove(obj);
        }
      });
      fabricCanvas.renderAll();
    }
    
    // Clear from store
    clearAllTokens();
    toast.success('All tokens cleared!');
  };

  const clearAllRegions = () => {
    clearRegions();
    toast.success('All regions cleared!');
  };

  const clearStorage = () => {
    localStorage.clear();
    // Also clear the Zustand store
    const { getState } = useSessionStore;
    const state = getState();
    state.tokens.length = 0; // Clear tokens array
    toast.success('Storage and tokens cleared! Reload page to start fresh.');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border-b border-border p-3 relative z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">D20PRO Virtual Tabletop</h1>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Session: {sessionId?.slice(0, 8) || 'paper-demo'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Tokens: {tokens.length}
              {tokens.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (actual count)
                </span>
              )}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Regions: {regions.length}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={shareSession}
            className="text-foreground border-border hover:bg-secondary"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Session
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            className="text-foreground border-border hover:bg-secondary"
          >
            <Users className="h-4 w-4 mr-2" />
            Players (1)
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearTokens}
            className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
            title="Clear all tokens from map and storage"
          >
            Clear Tokens
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearAllRegions}
            className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
            title="Clear all regions from map and storage"
          >
            Clear Regions
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLayerModalOpen(true)}
            className="text-foreground border-border hover:bg-secondary"
            title="Manage layers"
          >
            <Layers className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            className="text-foreground border-border hover:bg-secondary"
          >
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearStorage}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            title="Clear storage if experiencing issues"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <LayerStackModal 
        open={layerModalOpen}
        onOpenChange={setLayerModalOpen}
        fabricCanvas={fabricCanvas}
      />
    </div>
  );
};