import React, { useState } from 'react';
import {
  MapPlus,
  Square,
  Pen,
  LineSquiggle,
  Magnet,
  Settings2,
  Eye,
  EyeOff,
  FileDown,
  Layers,
  CirclePlus,
  Palette,
  CloudFog,
  Swords,
  Grid3X3,
  Undo,
  Redo,
  History,
  Pause,
  Play,
  Maximize,
  Trash2,
  ShieldX,
  Fence,
  Paintbrush,
} from 'lucide-react';
import { useFogStore } from '@/stores/fogStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useCardStore } from '@/stores/cardStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { CardType } from '@/types/cardTypes';
import { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ClearDataDialog } from '@/components/modals/ClearDataDialog';

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
  onFitToView?: () => void;
  
  // Fog reveal brush (play mode, DM only)
  fogRevealBrushActive?: boolean;
  onToggleFogRevealBrush?: () => void;
  isDM?: boolean;
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
  onFitToView,
  fogRevealBrushActive = false,
  onToggleFogRevealBrush,
  isDM = false,
}) => {
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  const { enabled: fogEnabled } = useFogStore();
  const { isInCombat, startCombat, endCombat } = useInitiativeStore();
  const { enforceMovementBlocking, enforceRegionBounds, setEnforceMovementBlocking, setEnforceRegionBounds } = useDungeonStore();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { animationsPaused, toggleAnimationsPaused } = useUiModeStore();
  
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
  const historyCard = cards.find((c) => c.type === CardType.HISTORY);

  const handleToggleStylesCard = () => {
    if (stylesCard) {
      setVisibility(stylesCard.id, !stylesCard.isVisible);
    } else {
      registerCard({
        type: CardType.STYLES,
        title: 'Map',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 400, height: 600 },
        minSize: { width: 350, height: 500 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  const handleToggleHistoryCard = () => {
    if (historyCard) {
      setVisibility(historyCard.id, !historyCard.isVisible);
    } else {
      registerCard({
        type: CardType.HISTORY,
        title: 'History',
        defaultPosition: { x: window.innerWidth - 380, y: 80 },
        defaultSize: { width: 360, height: 500 },
        minSize: { width: 320, height: 400 },
        isResizable: true,
        isClosable: true,
        defaultVisible: false,
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
        defaultVisible: true,
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
        defaultVisible: true,
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
        defaultVisible: true,
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
    <Toolbar position="left" className="gap-0.5 px-1.5 py-2">
      {mode === 'edit' ? (
        <>
          <ToolbarButton
            icon={MapPlus}
            label="Map Manager"
            onClick={onOpenMapManager || (() => {})}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={CirclePlus}
            label="Tokens"
            onClick={handleToggleTokenCard}
            isActive={tokenCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Square}
            label="Add Region"
            onClick={onAddRegion || (() => {})}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Pen}
            label={isDrawingPolygon ? 'Finish Polygon' : 'Draw Polygon'}
            onClick={isDrawingPolygon ? (onFinishPolygonDraw || (() => {})) : (onStartPolygonDraw || (() => {}))}
            disabled={isDrawingFreehand}
            isActive={isDrawingPolygon}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={LineSquiggle}
            label="Draw Freehand"
            onClick={onStartFreehandDraw || (() => {})}
            disabled={isDrawingPolygon}
            isActive={isDrawingFreehand}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Magnet}
            label={`World Snap ${isGridSnappingEnabled ? 'On' : 'Off'}`}
            onClick={onToggleGridSnapping || (() => {})}
            isActive={isGridSnappingEnabled}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Settings2}
            label="Map"
            onClick={handleToggleStylesCard}
            isActive={stylesCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={animationsPaused ? Play : Pause}
            label={animationsPaused ? 'Resume Animations' : 'Pause Animations'}
            onClick={toggleAnimationsPaused}
            isActive={animationsPaused}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Eye}
            label={`Regions ${showRegions ? 'On' : 'Off'}`}
            onClick={onToggleRegions}
            isActive={showRegions}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Trash2}
            label="Clear Data"
            onClick={() => setShowClearDialog(true)}
            variant="ghost"
            size="xs"
            className="text-orange-600 hover:bg-orange-600/10"
          />

          <ToolbarButton
            icon={FileDown}
            label="Import Dungeon"
            onClick={handleToggleWatabouCard}
            isActive={watabouCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Layers}
            label="Manage Layers"
            onClick={handleToggleLayerCard}
            isActive={layerCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Undo}
            label="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Redo}
            label="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!canRedo}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={History}
            label="History"
            onClick={handleToggleHistoryCard}
            isActive={historyCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Maximize}
            label="Fit to View"
            onClick={onFitToView || (() => {})}
            variant="ghost"
            size="xs"
          />

          <ClearDataDialog
            open={showClearDialog}
            onOpenChange={setShowClearDialog}
            fabricCanvas={fabricCanvas}
          />
        </>
      ) : (
        <>
          <ToolbarButton
            icon={Palette}
            label="Map"
            onClick={handleToggleStylesCard}
            isActive={stylesCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={animationsPaused ? Play : Pause}
            label={animationsPaused ? 'Resume Animations' : 'Pause Animations'}
            onClick={toggleAnimationsPaused}
            isActive={animationsPaused}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={CloudFog}
            label={`Fog of War ${fogEnabled ? 'On' : 'Off'}`}
            onClick={handleToggleFogCard}
            isActive={fogCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          {isDM && fogEnabled && onToggleFogRevealBrush && (
            <ToolbarButton
              icon={Paintbrush}
              label={fogRevealBrushActive ? 'Deactivate Reveal Brush' : 'Fog Reveal Brush'}
              onClick={onToggleFogRevealBrush}
              isActive={fogRevealBrushActive}
              variant="ghost"
              size="xs"
            />
          )}

          <ToolbarButton
            icon={showRegions ? Eye : EyeOff}
            label={`Regions ${showRegions ? 'On' : 'Off'}`}
            onClick={onToggleRegions}
            isActive={showRegions}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={ShieldX}
            label={`Obstacle Collision ${enforceMovementBlocking ? 'On' : 'Off'}`}
            onClick={() => setEnforceMovementBlocking(!enforceMovementBlocking)}
            isActive={enforceMovementBlocking}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Fence}
            label={`Region Bounds ${enforceRegionBounds ? 'On' : 'Off'}`}
            onClick={() => setEnforceRegionBounds(!enforceRegionBounds)}
            isActive={enforceRegionBounds}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Swords}
            label={`${isInCombat ? 'End' : 'Start'} Combat`}
            onClick={handleCombatToggle}
            isActive={isInCombat}
            variant="ghost"
            size="xs"
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
            size="xs"
          />

          <ToolbarButton
            icon={Layers}
            label="Manage Layers"
            onClick={handleToggleLayerCard}
            isActive={layerCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Undo}
            label="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Redo}
            label="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!canRedo}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={History}
            label="History"
            onClick={handleToggleHistoryCard}
            isActive={historyCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarSeparator orientation="horizontal" />

          <ToolbarButton
            icon={Maximize}
            label="Fit to View"
            onClick={onFitToView || (() => {})}
            variant="ghost"
            size="xs"
          />

          <ClearDataDialog
            open={showClearDialog}
            onOpenChange={setShowClearDialog}
            fabricCanvas={fabricCanvas}
          />
        </>
      )}
    </Toolbar>
  );
};
