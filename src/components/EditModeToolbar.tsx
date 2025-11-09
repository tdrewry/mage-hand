import React, { useState } from 'react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Settings,
  Square,
  Pen,
  Waves,
  Grid3X3,
  Settings2,
  Eye,
  Trash2,
  FileDown,
  Layers,
  Plus,
  Palette,
} from 'lucide-react';
import { useRegionStore } from '@/stores/regionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { toast } from 'sonner';
import { WatabouImportModal } from './modals/WatabouImportModal';
import { TokenPanelModal } from './modals/TokenPanelModal';
import { BackgroundGridModal } from './modals/BackgroundGridModal';
import { Canvas as FabricCanvas } from 'fabric';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';

interface EditModeToolbarProps {
  onOpenMapManager: () => void;
  onAddRegion: () => void;
  onStartPolygonDraw: () => void;
  onStartFreehandDraw: () => void;
  onFinishPolygonDraw: () => void;
  isDrawingPolygon: boolean;
  isDrawingFreehand: boolean;
  isGridSnappingEnabled: boolean;
  onToggleGridSnapping: () => void;
  showNegativeSpacePanel: boolean;
  onToggleNegativeSpacePanel: () => void;
  showRegions: boolean;
  onToggleRegions: () => void;
  fabricCanvas?: FabricCanvas | null;
  onAddToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void;
  gridColor: string;
  gridOpacity: number;
  onGridColorChange: (color: string) => void;
  onGridOpacityChange: (opacity: number) => void;
}

export const EditModeToolbar: React.FC<EditModeToolbarProps> = ({
  onOpenMapManager,
  onAddRegion,
  onStartPolygonDraw,
  onStartFreehandDraw,
  onFinishPolygonDraw,
  isDrawingPolygon,
  isDrawingFreehand,
  isGridSnappingEnabled,
  onToggleGridSnapping,
  showNegativeSpacePanel,
  onToggleNegativeSpacePanel,
  showRegions,
  onToggleRegions,
  fabricCanvas,
  onAddToken,
  gridColor,
  gridOpacity,
  onGridColorChange,
  onGridOpacityChange,
}) => {
  const [watabouImportOpen, setWatabouImportOpen] = useState(false);
  const [tokensModalOpen, setTokensModalOpen] = useState(false);
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  
  const { clearRegions } = useRegionStore();
  const { clearAllTokens } = useSessionStore();

  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const layerCard = cards.find((c) => c.type === CardType.LAYERS);

  const handleToggleLayerCard = () => {
    if (layerCard) {
      setVisibility(layerCard.id, !layerCard.isVisible);
    } else {
      registerCard({
        type: CardType.LAYERS,
        title: 'Layer Stack',
        defaultPosition: { x: 20, y: 80 },
        defaultSize: { width: 280, height: 450 },
        minSize: { width: 250, height: 400 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const handleClearTokens = () => {
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

  const handleClearRegions = () => {
    clearRegions();
    toast.success('All regions cleared!');
  };

  return (
    <TooltipProvider>
      <div className="absolute top-20 right-4 z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 flex flex-col gap-2">
          {/* Map Manager */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenMapManager}
                className="w-10 h-10"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Map Manager</p>
            </TooltipContent>
          </Tooltip>

          {/* Tokens */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTokensModalOpen(true)}
                className="w-10 h-10"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Tokens</p>
            </TooltipContent>
          </Tooltip>

          {/* Background & Grid */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBackgroundModalOpen(true)}
                className="w-10 h-10"
              >
                <Palette className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Background & Grid</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-px bg-border" />

          {/* Add Region */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onAddRegion}
                className="w-10 h-10"
              >
                <Square className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Add Region</p>
            </TooltipContent>
          </Tooltip>

          {/* Draw Polygon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isDrawingPolygon ? "default" : "ghost"}
                size="icon"
                onClick={isDrawingPolygon ? onFinishPolygonDraw : onStartPolygonDraw}
                disabled={isDrawingFreehand}
                className="w-10 h-10"
              >
                <Pen className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isDrawingPolygon ? 'Finish Polygon' : 'Draw Polygon'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Draw Freehand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isDrawingFreehand ? "default" : "ghost"}
                size="icon"
                onClick={onStartFreehandDraw}
                disabled={isDrawingPolygon}
                className="w-10 h-10"
              >
                <Waves className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Draw Freehand</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-px bg-border" />

          {/* World Snap Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isGridSnappingEnabled ? "default" : "ghost"}
                size="icon"
                onClick={onToggleGridSnapping}
                className="w-10 h-10"
              >
                <Grid3X3 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>World Snap {isGridSnappingEnabled ? 'On' : 'Off'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Wall Settings Panel Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showNegativeSpacePanel ? "default" : "ghost"}
                size="icon"
                onClick={onToggleNegativeSpacePanel}
                className="w-10 h-10"
              >
                <Settings2 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Wall Settings</p>
            </TooltipContent>
          </Tooltip>

          {/* Regions On/Off Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showRegions ? "default" : "ghost"}
                size="icon"
                onClick={onToggleRegions}
                className="w-10 h-10"
              >
                <Eye className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Regions {showRegions ? 'On' : 'Off'}</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-px bg-border" />

          {/* Clear Tokens */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearTokens}
                className="w-10 h-10 text-orange-600 hover:text-orange-600 hover:bg-orange-600/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Clear Tokens</p>
            </TooltipContent>
          </Tooltip>

          {/* Clear Regions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearRegions}
                className="w-10 h-10 text-orange-600 hover:text-orange-600 hover:bg-orange-600/10"
              >
                <Square className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Clear Regions</p>
            </TooltipContent>
          </Tooltip>

          {/* Import Dungeon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWatabouImportOpen(true)}
                className="w-10 h-10"
              >
                <FileDown className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Import Dungeon</p>
            </TooltipContent>
          </Tooltip>

          {/* Layers */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={layerCard?.isVisible ? "default" : "ghost"}
                size="icon"
                onClick={handleToggleLayerCard}
                className="w-10 h-10"
              >
                <Layers className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Manage Layers</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Modals */}
      <TokenPanelModal
        open={tokensModalOpen}
        onOpenChange={setTokensModalOpen}
        onAddToken={onAddToken}
      />

      <BackgroundGridModal
        open={backgroundModalOpen}
        onOpenChange={setBackgroundModalOpen}
        fabricCanvas={fabricCanvas}
        gridColor={gridColor}
        gridOpacity={gridOpacity}
        onGridColorChange={onGridColorChange}
        onGridOpacityChange={onGridOpacityChange}
      />
      
      <WatabouImportModal 
        open={watabouImportOpen}
        onOpenChange={setWatabouImportOpen}
      />
    </TooltipProvider>
  );
};
