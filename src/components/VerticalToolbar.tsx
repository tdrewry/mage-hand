import React, { useState } from 'react';
import {
  Square,
  Pen,
  LineSquiggle,
  DoorClosed,
  Magnet,
  Eye,
  EyeOff,
  CloudFog,
  Swords,
  
  Undo,
  Redo,
  Pause,
  Play,
  Maximize,
  Trash2,
  ShieldX,
  Fence,
  Paintbrush,
  MousePointer2,
} from 'lucide-react';
import { useFogStore } from '@/stores/fogStore';
import { useMapStore } from '@/stores/mapStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useCardStore } from '@/stores/cardStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { useUiStateStore } from '@/stores/uiStateStore';
import { CardType } from '@/types/cardTypes';
import { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ClearDataDialog } from '@/components/modals/ClearDataDialog';
import { useRemoteDragStore } from '@/stores/remoteDragStore';
import { emitClearAllDrags } from '@/lib/net/dragOps';

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
  const { isLeftSidebarOpen, isFocusMode } = useUiStateStore();
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const handleToggleFog = () => {
    const mapId = selectedMapId || 'default-map';
    const currentSettings = useFogStore.getState().getMapFogSettings(mapId);
    useFogStore.getState().setMapFogSettings(mapId, { enabled: !currentSettings.enabled });
    toast.success(`Fog of War ${!currentSettings.enabled ? 'enabled' : 'disabled'} for current map`);
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

  const handleClearDrags = () => {
    useRemoteDragStore.getState().clearAll();
    emitClearAllDrags();
    toast.success('Remote drags cleared!');
  };

  return (
    <Toolbar position="left" className="gap-0.5 px-1.5 py-2">
      {mode === 'edit' ? (
        <>

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
            icon={MousePointer2}
            label="Clear Stuck Drags"
            onClick={handleClearDrags}
            variant="ghost"
            size="xs"
            className="text-orange-600 hover:bg-orange-600/10"
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
            icon={animationsPaused ? Play : Pause}
            label={animationsPaused ? 'Resume Animations' : 'Pause Animations'}
            onClick={toggleAnimationsPaused}
            isActive={animationsPaused}
            variant="ghost"
            size="xs"
          />

          {isDM && (
            <ToolbarButton
              icon={CloudFog}
              label={`Fog of War ${fogEnabled ? 'On' : 'Off'}`}
              onClick={handleToggleFog}
              isActive={fogEnabled}
              variant="ghost"
              size="xs"
            />
          )}

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

          {isDM && (
            <ToolbarButton
              icon={MousePointer2}
              label="Clear Stuck Drags"
              onClick={handleClearDrags}
              variant="ghost"
              size="xs"
              className="text-orange-600 hover:bg-orange-600/10"
            />
          )}

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
