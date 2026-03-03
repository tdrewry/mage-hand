import React, { useState } from 'react';
import {
  MapPlus,
  Square,
  Pen,
  LineSquiggle,
  DoorClosed,
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
  Sparkles,
  
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
import { useMapStore } from '@/stores/mapStore';
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
  onAddRegion?: () => void;
  onStartPolygonDraw?: () => void;
  onStartFreehandDraw?: () => void;
  onFinishPolygonDraw?: () => void;
  isDrawingPolygon?: boolean;
  isDrawingFreehand?: boolean;
  isDrawingDoor?: boolean;
  onStartDoorDraw?: () => void;
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
  onAddRegion,
  onStartPolygonDraw,
  onStartFreehandDraw,
  onFinishPolygonDraw,
  isDrawingPolygon = false,
  isDrawingFreehand = false,
  isDrawingDoor = false,
  onStartDoorDraw,
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
  
  const selectedMapId = useMapStore(s => s.selectedMapId);
  const fogEnabled = useFogStore(s => s.getMapFogSettings(selectedMapId || 'default-map').enabled);
  const { isInCombat, startCombat, endCombat } = useInitiativeStore();
  const { enforceMovementBlocking, enforceRegionBounds, setEnforceMovementBlocking, setEnforceRegionBounds } = useDungeonStore();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { animationsPaused, toggleAnimationsPaused } = useUiModeStore();
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const mapTreeCard = cards.find((c) => c.type === CardType.MAP_TREE);
  const tokenCard = cards.find((c) => c.type === CardType.TOKENS);
  const watabouCard = cards.find((c) => c.type === CardType.WATABOU_IMPORT);
  const fogCard = cards.find((c) => c.type === CardType.FOG);
  const rosterCard = cards.find((c) => c.type === CardType.ROSTER);
  const stylesCard = cards.find((c) => c.type === CardType.STYLES);
  const historyCard = cards.find((c) => c.type === CardType.HISTORY);
  const effectsCard = cards.find((c) => c.type === CardType.EFFECTS);

  const handleToggleEffectsCard = () => {
    if (effectsCard) {
      setVisibility(effectsCard.id, !effectsCard.isVisible);
    } else {
      registerCard({
        type: CardType.EFFECTS,
        title: 'Effects',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 320, height: 500 },
        minSize: { width: 280, height: 350 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

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

  const handleToggleMapTreeCard = () => {
    if (mapTreeCard) {
      setVisibility(mapTreeCard.id, !mapTreeCard.isVisible);
    } else {
      registerCard({
        type: CardType.MAP_TREE,
        title: 'Map Tree',
        defaultPosition: { x: 20, y: 80 },
        defaultSize: { width: 320, height: 500 },
        minSize: { width: 260, height: 300 },
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
            onClick={() => {
              const mapManagerCard = cards.find((c) => c.type === CardType.MAP_MANAGER);
              if (mapManagerCard) {
                setVisibility(mapManagerCard.id, !mapManagerCard.isVisible);
              } else {
                registerCard({
                  type: CardType.MAP_MANAGER,
                  title: 'Map Manager',
                  defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
                  defaultSize: { width: 600, height: 500 },
                  minSize: { width: 400, height: 300 },
                  isResizable: true,
                  isClosable: true,
                  defaultVisible: true,
                });
              }
            }}
            isActive={cards.find((c) => c.type === CardType.MAP_MANAGER)?.isVisible}
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
            disabled={isDrawingPolygon || isDrawingDoor}
            isActive={isDrawingFreehand}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={DoorClosed}
            label={isDrawingDoor ? 'Cancel Door Tool' : 'Draw Door'}
            onClick={onStartDoorDraw || (() => {})}
            disabled={isDrawingPolygon || isDrawingFreehand}
            isActive={isDrawingDoor}
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
            label="Map Tree"
            onClick={handleToggleMapTreeCard}
            isActive={mapTreeCard?.isVisible}
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
            icon={Sparkles}
            label="Effects"
            onClick={handleToggleEffectsCard}
            isActive={effectsCard?.isVisible}
            variant="ghost"
            size="xs"
          />

          <ToolbarButton
            icon={Layers}
            label="Map Tree"
            onClick={handleToggleMapTreeCard}
            isActive={mapTreeCard?.isVisible}
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
