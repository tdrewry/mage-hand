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
import { useDungeonStore } from '@/stores/dungeonStore';
import { useFogStore } from '@/stores/fogStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';

interface ToolsCardContentProps {
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

export const ToolsCardContent: React.FC<ToolsCardContentProps> = ({
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
  const initiativeCard = cards.find((c) => c.type === CardType.INITIATIVE_TRACKER);
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
      if (initiativeCard) {
        setVisibility(initiativeCard.id, false);
      }
      toast.success('Combat ended');
    } else {
      const { initiativeOrder } = useInitiativeStore.getState();
      
      if (initiativeOrder.length === 0) {
        toast.error('Add characters to initiative first');
        return;
      }
      
      startCombat();
      
      if (initiativeCard) {
        setVisibility(initiativeCard.id, true);
      } else {
        registerCard({
          type: CardType.INITIATIVE_TRACKER,
          title: 'Initiative Tracker',
          defaultPosition: { x: window.innerWidth / 2 - 400, y: 80 },
          defaultSize: { width: 800, height: 140 },
          minSize: { width: 400, height: 120 },
          isResizable: true,
          isClosable: true,
          defaultVisible: false, // Don't auto-show on register
          hideHeader: true,
          fullCardDraggable: true,
        });
        // Immediately set it visible after registration
        setTimeout(() => {
          const card = cards.find((c) => c.type === CardType.INITIATIVE_TRACKER);
          if (card) setVisibility(card.id, true);
        }, 0);
      }
      toast.success('Combat started!');
    }
  };

  return (
    <TooltipProvider>
      <div className="p-2 flex flex-col gap-2">
        {mode === 'edit' ? (
          <>
            {/* Edit Mode Tools */}
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tokenCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleTokenCard}
                  className="w-10 h-10"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Tokens</p>
              </TooltipContent>
            </Tooltip>

            <Separator />

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

            <Separator />

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

            <Separator />

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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={watabouCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleWatabouCard}
                  className="w-10 h-10"
                >
                  <FileDown className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Import Dungeon</p>
              </TooltipContent>
            </Tooltip>

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
                  className="w-10 h-10"
                >
                  <Palette className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Styles</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={fogCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleFogCard}
                  className="w-10 h-10"
                >
                  <CloudFog className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Fog of War {fogEnabled ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showRegions ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleRegions}
                  className="w-10 h-10"
                >
                  {showRegions ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Regions {showRegions ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <Separator />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={rosterCard?.isVisible ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleRosterCard}
                  className="w-10 h-10"
                >
                  <Users className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{rosterCard?.isVisible ? 'Hide' : 'Show'} Roster</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isInCombat ? "default" : "ghost"}
                  size="icon"
                  onClick={handleCombatToggle}
                  className="w-10 h-10"
                >
                  <Swords className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{isInCombat ? 'End' : 'Start'} Combat</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={restrictMovement ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setRestrictMovement(!restrictMovement)}
                  className="w-10 h-10"
                >
                  {restrictMovement ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
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
                  className="w-10 h-10"
                >
                  <Grid3X3 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Background & Grid</p>
              </TooltipContent>
            </Tooltip>

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
          </>
        )}
      </div>
    </TooltipProvider>
  );
};
