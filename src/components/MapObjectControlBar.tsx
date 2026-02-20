import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock, Unlock, Trash2, Move, EyeOff, Moon,
  DoorOpen, DoorClosed, Lightbulb, LightbulbOff,
  MousePointer2, RotateCw, Pencil
} from 'lucide-react';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { MapObject, MAP_OBJECT_CATEGORY_LABELS } from '@/types/mapObjectTypes';
import { Z_INDEX } from '@/lib/zIndex';
import { toast } from 'sonner';

export type MapObjectTool = 'drag' | 'rotate' | 'points';

interface MapObjectControlBarProps {
  pointEditMode: boolean;
  onTogglePointEditMode: () => void;
  mapObjectTool: MapObjectTool;
  onSetMapObjectTool: (tool: MapObjectTool) => void;
  onUpdateCanvas?: () => void;
}

export const MapObjectControlBar: React.FC<MapObjectControlBarProps> = ({
  pointEditMode,
  onTogglePointEditMode,
  mapObjectTool,
  onSetMapObjectTool,
  onUpdateCanvas,
}) => {
  const mapObjects = useMapObjectStore((state) => state.mapObjects);
  const selectedMapObjectIds = useMapObjectStore((state) => state.selectedMapObjectIds);
  const updateMapObject = useMapObjectStore((state) => state.updateMapObject);
  const removeMultipleMapObjects = useMapObjectStore((state) => state.removeMultipleMapObjects);
  const clearSelection = useMapObjectStore((state) => state.clearSelection);
  const toggleDoor = useMapObjectStore((state) => state.toggleDoor);

  const selectedObjects = mapObjects.filter((obj) => selectedMapObjectIds.includes(obj.id));
  if (selectedObjects.length === 0) return null;

  const singleSelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const allLocked = selectedObjects.every((o) => o.locked);
  const isWall = singleSelected?.shape === 'wall';
  const isDoor = singleSelected?.category === 'door';
  const isLight = singleSelected?.category === 'light';
  const canRotate = !!singleSelected && !isWall && !allLocked;

  const handleToggleLock = () => {
    const newLocked = !allLocked;
    selectedObjects.forEach((obj) => {
      updateMapObject(obj.id, { locked: newLocked });
    });
    onUpdateCanvas?.();
    toast.success(`${newLocked ? 'Locked' : 'Unlocked'} ${selectedObjects.length} object(s)`);
  };

  const handleDelete = () => {
    const unlocked = selectedObjects.filter((o) => !o.locked);
    if (unlocked.length === 0) {
      toast.error('Cannot delete locked objects');
      return;
    }
    removeMultipleMapObjects(unlocked.map((o) => o.id));
    onUpdateCanvas?.();
    toast.success(`Deleted ${unlocked.length} object(s)`);
  };

  const handleToggleDoor = () => {
    if (singleSelected && isDoor) {
      toggleDoor(singleSelected.id);
      onUpdateCanvas?.();
    }
  };

  const handleLightToggle = (enabled: boolean) => {
    if (singleSelected && isLight) {
      updateMapObject(singleSelected.id, { lightEnabled: enabled });
      onUpdateCanvas?.();
      // Trigger fog refresh so illumination changes apply immediately
      window.dispatchEvent(new CustomEvent('fog:force-refresh'));
    }
  };

  const categoryLabel = singleSelected
    ? (singleSelected.label || MAP_OBJECT_CATEGORY_LABELS[singleSelected.category])
    : `${selectedObjects.length} objects`;

  const handleSetTool = (tool: MapObjectTool) => {
    onSetMapObjectTool(tool);
    if (tool === 'points' && !pointEditMode) onTogglePointEditMode();
    if (tool !== 'points' && pointEditMode) onTogglePointEditMode();
    onUpdateCanvas?.();
  };

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg px-2 py-1.5"
      style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
    >
      <div className="flex items-center gap-1">
        {/* Label */}
        <span className="text-xs font-medium text-foreground px-1.5 max-w-[120px] truncate">
          {categoryLabel}
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Tool selector: Drag | Rotate | Points */}
        <Button
          variant={mapObjectTool === 'drag' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => handleSetTool('drag')}
          title="Drag tool — move object"
          disabled={allLocked}
        >
          <MousePointer2 className="h-3 w-3 mr-1" />
          Drag
        </Button>
        {canRotate && (
          <Button
            variant={mapObjectTool === 'rotate' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleSetTool('rotate')}
            title="Rotate tool — drag rotation handle above object"
          >
            <RotateCw className="h-3 w-3 mr-1" />
            Rotate
          </Button>
        )}
        {isWall && singleSelected && (
          <Button
            variant={mapObjectTool === 'points' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleSetTool('points')}
            disabled={!!singleSelected.locked}
            title={singleSelected.locked ? 'Unlock wall to edit points' : 'Points tool: click line to add, click vertex to remove'}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Points
          </Button>
        )}
        {mapObjectTool === 'points' && pointEditMode && (
          <span className="text-[10px] text-muted-foreground px-1">
            Click line +pt · Click vertex −pt
          </span>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Lock Toggle */}
        <Button
          variant={allLocked ? 'default' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleToggleLock}
        >
          {allLocked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
          {allLocked ? 'Locked' : 'Lock'}
        </Button>

        {/* Door-specific: Toggle open/close */}
        {isDoor && singleSelected && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleToggleDoor}
            >
              {singleSelected.isOpen ? (
                <DoorOpen className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <DoorClosed className="h-3 w-3 mr-1 text-red-500" />
              )}
              {singleSelected.isOpen ? 'Close' : 'Open'}
            </Button>
          </>
        )}

        {/* Light-specific: toggle + quick radius */}
        {isLight && singleSelected && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => handleLightToggle(!singleSelected.lightEnabled)}
            >
              {singleSelected.lightEnabled !== false ? (
                <Lightbulb className="h-3 w-3 mr-1 text-yellow-400" />
              ) : (
                <LightbulbOff className="h-3 w-3 mr-1 text-muted-foreground" />
              )}
              {singleSelected.lightEnabled !== false ? 'On' : 'Off'}
            </Button>
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] text-muted-foreground">R:</span>
              <Input
                type="number"
                value={singleSelected.lightRadius ?? 200}
                onChange={(e) => updateMapObject(singleSelected.id, { lightRadius: Number(e.target.value) })}
                className="w-14 h-5 text-xs px-1"
                min={10}
                max={2000}
              />
            </div>
          </>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Behavior toggles (compact) */}
        {singleSelected && !isDoor && (
          <>
            <Button
              variant={singleSelected.blocksVision ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0"
              title={`Blocks Vision: ${singleSelected.blocksVision ? 'Yes' : 'No'}`}
              onClick={() => updateMapObject(singleSelected.id, { blocksVision: !singleSelected.blocksVision })}
            >
              <EyeOff className="h-3 w-3" />
            </Button>
            <Button
              variant={singleSelected.blocksMovement ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0"
              title={`Blocks Movement: ${singleSelected.blocksMovement ? 'Yes' : 'No'}`}
              onClick={() => updateMapObject(singleSelected.id, { blocksMovement: !singleSelected.blocksMovement })}
            >
              <Move className="h-3 w-3" />
            </Button>
            <Button
              variant={singleSelected.castsShadow ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0"
              title={`Casts Shadow: ${singleSelected.castsShadow ? 'Yes' : 'No'}`}
              onClick={() => updateMapObject(singleSelected.id, { castsShadow: !singleSelected.castsShadow })}
            >
              <Moon className="h-3 w-3" />
            </Button>
            <div className="h-4 w-px bg-border" />
          </>
        )}

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Del
        </Button>

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => clearSelection()}
        >
          ✕
        </Button>
      </div>
    </div>
  );
};
