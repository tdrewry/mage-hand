import React from 'react';
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
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';

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
    <Toolbar position="left" className="gap-1 px-2 py-3">
      {mode === 'edit' ? (
        <>
          <ToolbarButton
            icon={Settings}
            label="Map Manager"
            onClick={onOpenMapManager || (() => {})}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Plus}
            label="Tokens"
            onClick={handleToggleTokenCard}
            isActive={tokenCard?.isVisible}
            variant="ghost"
            size="sm"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Square}
            label="Add Region"
            onClick={onAddRegion || (() => {})}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Pen}
            label={isDrawingPolygon ? 'Finish Polygon' : 'Draw Polygon'}
            onClick={isDrawingPolygon ? (onFinishPolygonDraw || (() => {})) : (onStartPolygonDraw || (() => {}))}
            disabled={isDrawingFreehand}
            isActive={isDrawingPolygon}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Waves}
            label="Draw Freehand"
            onClick={onStartFreehandDraw || (() => {})}
            disabled={isDrawingPolygon}
            isActive={isDrawingFreehand}
            variant="ghost"
            size="sm"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Grid3X3}
            label={`World Snap ${isGridSnappingEnabled ? 'On' : 'Off'}`}
            onClick={onToggleGridSnapping || (() => {})}
            isActive={isGridSnappingEnabled}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Settings2}
            label="Styles"
            onClick={handleToggleStylesCard}
            isActive={stylesCard?.isVisible}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Eye}
            label={`Regions ${showRegions ? 'On' : 'Off'}`}
            onClick={onToggleRegions}
            isActive={showRegions}
            variant="ghost"
            size="sm"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Trash2}
            label="Clear Tokens"
            onClick={handleClearTokens}
            variant="ghost"
            size="sm"
            className="text-orange-600 hover:bg-orange-600/10"
          />

          <ToolbarButton
            icon={Square}
            label="Clear Regions"
            onClick={handleClearRegions}
            variant="ghost"
            size="sm"
            className="text-orange-600 hover:bg-orange-600/10"
          />

          <ToolbarButton
            icon={FileDown}
            label="Import Dungeon"
            onClick={handleToggleWatabouCard}
            isActive={watabouCard?.isVisible}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Layers}
            label="Manage Layers"
            onClick={handleToggleLayerCard}
            isActive={layerCard?.isVisible}
            variant="ghost"
            size="sm"
          />
        </>
      ) : (
        <>
          <ToolbarButton
            icon={Palette}
            label="Styles"
            onClick={handleToggleStylesCard}
            isActive={stylesCard?.isVisible}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={CloudFog}
            label={`Fog of War ${fogEnabled ? 'On' : 'Off'}`}
            onClick={handleToggleFogCard}
            isActive={fogCard?.isVisible}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={showRegions ? Eye : EyeOff}
            label={`Regions ${showRegions ? 'On' : 'Off'}`}
            onClick={onToggleRegions}
            isActive={showRegions}
            variant="ghost"
            size="sm"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Users}
            label={`${rosterCard?.isVisible ? 'Hide' : 'Show'} Roster`}
            onClick={handleToggleRosterCard}
            isActive={rosterCard?.isVisible}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Swords}
            label={`${isInCombat ? 'End' : 'Start'} Combat`}
            onClick={handleCombatToggle}
            isActive={isInCombat}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={restrictMovement ? Lock : LockOpen}
            label={
              isInCombat 
                ? (restrictMovement ? 'Active Token Only' : 'All Tokens') 
                : (restrictMovement ? 'GM Only' : 'Free Movement')
            }
            onClick={() => setRestrictMovement(!restrictMovement)}
            isActive={restrictMovement}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Grid3X3}
            label="Background & Grid"
            onClick={() => {
              if (backgroundGridCard) {
                setVisibility(backgroundGridCard.id, true);
              }
            }}
            variant="ghost"
            size="sm"
          />

          <ToolbarButton
            icon={Layers}
            label="Manage Layers"
            onClick={handleToggleLayerCard}
            isActive={layerCard?.isVisible}
            variant="ghost"
            size="sm"
          />
        </>
      )}
    </Toolbar>
  );
};
