import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Settings,
  Square,
  Pen,
  Waves,
  Grid3X3,
  Settings2,
  Eye,
  EyeOff,
  Trash2,
  FileDown,
  Layers,
  Plus,
  Palette,
  CloudFog,
  Swords,
  Lock,
  LockOpen,
  Users,
} from 'lucide-react';
import { useRegionStore } from '@/stores/regionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useFogStore } from '@/stores/fogStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';

interface VerticalToolbarProps {
  mode: 'edit' | 'play';
  fabricCanvas?: FabricCanvas | null;
  
  // Edit mode props
  onOpenMapManager?: () => void;
  onAddRegion?: () => void;
  onStartPolygonDraw?: () => void;
  onStartFreehandDraw?: () => void;
  onFinishPolygonDraw?: () => void;
  isDrawingPolygon?: boolean;
  isDrawingFreehand?: boolean;
  isGridSnappingEnabled?: boolean;
  onToggleGridSnapping?: () => void;
  
  // Shared props
  showNegativeSpacePanel: boolean;
  onToggleNegativeSpacePanel: () => void;
  showRegions: boolean;
  onToggleRegions: () => void;
}

export const VerticalToolbar: React.FC<VerticalToolbarProps> = ({
  mode,
  fabricCanvas,
  onOpenMapManager,
  onAddRegion,
  onStartPolygonDraw,
  onStartFreehandDraw,
  onFinishPolygonDraw,
  isDrawingPolygon = false,
  isDrawingFreehand = false,
  isGridSnappingEnabled = false,
  onToggleGridSnapping,
  showNegativeSpacePanel,
  onToggleNegativeSpacePanel,
  showRegions,
  onToggleRegions,
}) => {
  const { clearRegions } = useRegionStore();
  const { clearAllTokens } = useSessionStore();
  const { enabled: fogEnabled } = useFogStore();
  const { isInCombat, restrictMovement, setRestrictMovement, startCombat, endCombat } = useInitiativeStore();
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const layerCard = cards.find((c) => c.type === CardType.LAYERS);
  const tokenCard = cards.find((c) => c.type === CardType.TOKENS);
  const watabouCard = cards.find((c) => c.type === CardType.WATABOU_IMPORT);
  const fogCard = cards.find((c) => c.type === CardType.FOG);
  const rosterCard = cards.find((c) => c.type === CardType.ROSTER);
  const backgroundGridCard = cards.find((c) => c.type === CardType.BACKGROUND_GRID);

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

  const handleToggleTokenCard = () => {
    if (tokenCard) {
      setVisibility(tokenCard.id, !tokenCard.isVisible);
    } else {
      registerCard({
        type: CardType.TOKENS,
        title: 'Token Panel',
        defaultPosition: { x: window.innerWidth - 420, y: 80 },
        defaultSize: { width: 400, height: 500 },
        minSize: { width: 300, height: 400 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const handleToggleWatabouCard = () => {
    if (watabouCard) {
      setVisibility(watabouCard.id, !watabouCard.isVisible);
    } else {
      registerCard({
        type: CardType.WATABOU_IMPORT,
        title: 'Import Dungeon',
        defaultPosition: { x: window.innerWidth / 2 - 250, y: 100 },
        defaultSize: { width: 500, height: 550 },
        minSize: { width: 400, height: 500 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const handleToggleFogCard = () => {
    if (fogCard) {
      setVisibility(fogCard.id, !fogCard.isVisible);
    } else {
      registerCard({
        type: CardType.FOG,
        title: 'Fog Control',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 350, height: 520 },
        minSize: { width: 300, height: 450 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const handleToggleRosterCard = () => {
    if (rosterCard) {
      setVisibility(rosterCard.id, !rosterCard.isVisible);
    } else {
      registerCard({
        type: CardType.ROSTER,
        title: 'Roster',
        defaultPosition: { x: window.innerWidth - 320, y: 80 },
        defaultSize: { width: 300, height: 500 },
        minSize: { width: 250, height: 300 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  const handleClearTokens = () => {
    if (fabricCanvas) {
      const objects = fabricCanvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.tokenId || obj.isTokenLabel) {
          fabricCanvas.remove(obj);
        }
      });
      fabricCanvas.renderAll();
    }
    clearAllTokens();
    toast.success('All tokens cleared!');
  };

  const handleClearRegions = () => {
    clearRegions();
    toast.success('All regions cleared!');
  };

  const handleCombatToggle = () => {
    if (isInCombat) {
      endCombat();
      toast.success('Combat ended');
    } else {
      const { initiativeOrder } = useInitiativeStore.getState();
      
      if (initiativeOrder.length === 0) {
        toast.error('Add characters to initiative first');
        return;
      }
      
      startCombat();
      toast.success('Combat started!');
    }
  };

  return (
    <TooltipProvider>
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-[998] flex flex-col gap-1 bg-background/95 backdrop-blur border border-border rounded-full px-2 py-3 shadow-lg">
        {mode === 'edit' ? (
          <>
            {/* Edit Mode Tools */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenMapManager}
                  className="w-10 h-10 rounded-full"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Map Manager</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tokenCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleTokenCard}
                  className="w-10 h-10 rounded-full"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Tokens</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAddRegion}
                  className="w-10 h-10 rounded-full"
                >
                  <Square className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Add Region</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isDrawingPolygon ? "default" : "ghost"}
                  size="icon"
                  onClick={isDrawingPolygon ? onFinishPolygonDraw : onStartPolygonDraw}
                  disabled={isDrawingFreehand}
                  className="w-10 h-10 rounded-full"
                >
                  <Pen className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isDrawingPolygon ? 'Finish Polygon' : 'Draw Polygon'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isDrawingFreehand ? "default" : "ghost"}
                  size="icon"
                  onClick={onStartFreehandDraw}
                  disabled={isDrawingPolygon}
                  className="w-10 h-10 rounded-full"
                >
                  <Waves className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Draw Freehand</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isGridSnappingEnabled ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleGridSnapping}
                  className="w-10 h-10 rounded-full"
                >
                  <Grid3X3 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>World Snap {isGridSnappingEnabled ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showNegativeSpacePanel ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleNegativeSpacePanel}
                  className="w-10 h-10 rounded-full"
                >
                  <Settings2 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Wall Settings</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showRegions ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleRegions}
                  className="w-10 h-10 rounded-full"
                >
                  <Eye className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Regions {showRegions ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearTokens}
                  className="w-10 h-10 rounded-full text-orange-600 hover:text-orange-600 hover:bg-orange-600/10"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Clear Tokens</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearRegions}
                  className="w-10 h-10 rounded-full text-orange-600 hover:text-orange-600 hover:bg-orange-600/10"
                >
                  <Square className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Clear Regions</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={watabouCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleWatabouCard}
                  className="w-10 h-10 rounded-full"
                >
                  <FileDown className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Import Dungeon</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={layerCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleLayerCard}
                  className="w-10 h-10 rounded-full"
                >
                  <Layers className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Manage Layers</p>
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {/* Play Mode Tools */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showNegativeSpacePanel ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleNegativeSpacePanel}
                  className="w-10 h-10 rounded-full"
                >
                  <Palette className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Styles</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={fogCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleFogCard}
                  className="w-10 h-10 rounded-full"
                >
                  <CloudFog className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Fog of War {fogEnabled ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showRegions ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleRegions}
                  className="w-10 h-10 rounded-full"
                >
                  {showRegions ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Regions {showRegions ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={rosterCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleRosterCard}
                  className="w-10 h-10 rounded-full"
                >
                  <Users className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{rosterCard?.isVisible ? 'Hide' : 'Show'} Roster</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isInCombat ? "default" : "ghost"}
                  size="icon"
                  onClick={handleCombatToggle}
                  className="w-10 h-10 rounded-full"
                >
                  <Swords className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isInCombat ? 'End' : 'Start'} Combat</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={restrictMovement ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setRestrictMovement(!restrictMovement)}
                  className="w-10 h-10 rounded-full"
                >
                  {restrictMovement ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>
                  {isInCombat 
                    ? (restrictMovement ? 'Active Token Only' : 'All Tokens') 
                    : (restrictMovement ? 'GM Only' : 'Free Movement')
                  }
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (backgroundGridCard) {
                      setVisibility(backgroundGridCard.id, true);
                    }
                  }}
                  className="w-10 h-10 rounded-full"
                >
                  <Grid3X3 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Background & Grid</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={layerCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleLayerCard}
                  className="w-10 h-10 rounded-full"
                >
                  <Layers className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Manage Layers</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};
