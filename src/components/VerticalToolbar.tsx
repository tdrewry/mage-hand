import React from 'react';
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
import { Z_INDEX } from '@/lib/zIndex';

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
  const stylesCard = cards.find((c) => c.type === CardType.STYLES);

  const handleToggleStylesCard = () => {
    if (stylesCard) {
      setVisibility(stylesCard.id, !stylesCard.isVisible);
    } else {
      registerCard({
        type: CardType.STYLES,
        title: 'Styles',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 400, height: 600 },
        minSize: { width: 350, height: 500 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

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
    <TooltipProvider disableHoverableContent>
      <div 
        className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-background/95 backdrop-blur border border-border rounded-full px-2 py-3 shadow-lg"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        {mode === 'edit' ? (
          <>
            {/* Edit Mode Tools */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenMapManager}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-transparent hover:bg-accent hover:text-accent-foreground"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Map Manager</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleTokenCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    tokenCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Tokens</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAddRegion}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-transparent hover:bg-accent hover:text-accent-foreground"
                >
                  <Square className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Add Region</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={isDrawingPolygon ? onFinishPolygonDraw : onStartPolygonDraw}
                  disabled={isDrawingFreehand}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDrawingPolygon 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Pen className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>{isDrawingPolygon ? 'Finish Polygon' : 'Draw Polygon'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onStartFreehandDraw}
                  disabled={isDrawingPolygon}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDrawingFreehand 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Waves className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Draw Freehand</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleGridSnapping}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isGridSnappingEnabled 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>World Snap {isGridSnappingEnabled ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleStylesCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    stylesCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Settings2 className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Styles</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleRegions}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    showRegions 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Eye className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Regions {showRegions ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClearTokens}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors text-orange-600 hover:bg-orange-600/10"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Clear Tokens</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClearRegions}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors text-orange-600 hover:bg-orange-600/10"
                >
                  <Square className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Clear Regions</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleWatabouCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    watabouCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <FileDown className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Import Dungeon</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleLayerCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    layerCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Manage Layers</p>
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {/* Play Mode Tools */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleStylesCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    stylesCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Palette className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Styles</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleFogCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    fogCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <CloudFog className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Fog of War {fogEnabled ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleRegions}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    showRegions 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {showRegions ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Regions {showRegions ? 'On' : 'Off'}</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-px w-8 mx-auto bg-border my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleRosterCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    rosterCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Users className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>{rosterCard?.isVisible ? 'Hide' : 'Show'} Roster</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCombatToggle}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isInCombat 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Swords className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>{isInCombat ? 'End' : 'Start'} Combat</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setRestrictMovement(!restrictMovement)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    restrictMovement 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {restrictMovement ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
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
                <button
                  onClick={() => {
                    if (backgroundGridCard) {
                      setVisibility(backgroundGridCard.id, true);
                    }
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-transparent hover:bg-accent hover:text-accent-foreground"
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Background & Grid</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleLayerCard}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    layerCard?.isVisible 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Manage Layers</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};
