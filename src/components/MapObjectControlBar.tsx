import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Lock, Unlock, Trash2, Move, EyeOff, Moon,
  DoorOpen, DoorClosed, Lightbulb, LightbulbOff,
  MousePointer2, RotateCw, Pencil, Maximize2, Paintbrush, Eye
} from 'lucide-react';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { MapObject, MAP_OBJECT_CATEGORY_LABELS } from '@/types/mapObjectTypes';
import { Z_INDEX } from '@/lib/zIndex';
import { toast } from 'sonner';
import { ColorPicker } from '@/components/ui/color-picker';

export type MapObjectTool = 'drag' | 'rotate' | 'scale' | 'points';

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
  // All single-selected unlocked objects can rotate and scale (including walls now)
  const canTransform = !!singleSelected && !allLocked;

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

  const updateWall = (patch: Partial<MapObject>) => {
    if (!singleSelected) return;
    updateMapObject(singleSelected.id, patch);
    onUpdateCanvas?.();
  };

  return (
    <div className="flex items-center gap-1">

        {/* Tool selector: Drag | Rotate | Scale | Points */}
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

        {canTransform && (
          <Button
            variant={mapObjectTool === 'rotate' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleSetTool('rotate')}
            title={isWall ? 'Rotate wall around its centroid' : 'Rotate tool — drag rotation handle above object'}
          >
            <RotateCw className="h-3 w-3 mr-1" />
            Rotate
          </Button>
        )}

        {canTransform && (
          <Button
            variant={mapObjectTool === 'scale' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleSetTool('scale')}
            title={isWall ? 'Scale wall — drag corner or edge handles' : 'Scale/resize object'}
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Scale
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
        {mapObjectTool === 'rotate' && isWall && (
          <span className="text-[10px] text-muted-foreground px-1">
            Drag ○ handle
          </span>
        )}
        {mapObjectTool === 'scale' && isWall && (
          <span className="text-[10px] text-muted-foreground px-1">
            Drag □ handles
          </span>
        )}

        {/* Wall Stroke Popover */}
        {isWall && singleSelected && (
          <>
            <div className="h-4 w-px bg-border" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  title="Wall stroke and shadow styling"
                >
                  <Paintbrush className="h-3 w-3 mr-1" />
                  Stroke
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                sideOffset={8}
                align="start"
                className="w-64 p-3 space-y-3"
                style={{ zIndex: Z_INDEX.POPOVERS.POPOVER }}
              >
                {/* Visible in Play Mode toggle */}
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <Label className="text-xs font-medium">Visible in Play Mode</Label>
                  <Button
                    variant={singleSelected.wallVisibleInPlay ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    title={singleSelected.wallVisibleInPlay
                      ? 'Wall stroke is visible to players in play mode — click to hide'
                      : 'Wall stroke is hidden in play mode — click to show'}
                    onClick={() => updateWall({ wallVisibleInPlay: !singleSelected.wallVisibleInPlay })}
                  >
                    {singleSelected.wallVisibleInPlay
                      ? <Eye className="h-3 w-3 text-emerald-400" />
                      : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                    {singleSelected.wallVisibleInPlay ? 'On' : 'Off'}
                  </Button>
                </div>

                {/* Stroke Color */}
                <div className="space-y-1">
                  <Label className="text-xs">Stroke Color</Label>
                  <ColorPicker
                    value={singleSelected.strokeColor || '#ef4444'}
                    onChange={(c) => updateWall({ strokeColor: c })}
                    showAlpha
                  />
                </div>

                {/* Stroke Width */}
                <div className="space-y-1">
                  <Label className="text-xs">
                    Width <span className="text-muted-foreground">{singleSelected.strokeWidth ?? 2}px</span>
                  </Label>
                  <Slider
                    min={1} max={24} step={0.5}
                    value={[singleSelected.strokeWidth ?? 2]}
                    onValueChange={([v]) => updateWall({ strokeWidth: v })}
                  />
                </div>

                {/* Shadow section */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shadow</Label>

                  <div className="space-y-1">
                    <Label className="text-xs">Shadow Color</Label>
                    <ColorPicker
                      value={singleSelected.wallShadowColor || 'rgba(0,0,0,0)'}
                      onChange={(c) => updateWall({ wallShadowColor: c })}
                      showAlpha
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      Blur <span className="text-muted-foreground">{singleSelected.wallShadowBlur ?? 0}px</span>
                    </Label>
                    <Slider
                      min={0} max={40} step={1}
                      value={[singleSelected.wallShadowBlur ?? 0]}
                      onValueChange={([v]) => updateWall({ wallShadowBlur: v })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Offset X <span className="text-muted-foreground">{singleSelected.wallShadowOffsetX ?? 0}px</span>
                      </Label>
                      <Slider
                        min={-20} max={20} step={1}
                        value={[singleSelected.wallShadowOffsetX ?? 0]}
                        onValueChange={([v]) => updateWall({ wallShadowOffsetX: v })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Offset Y <span className="text-muted-foreground">{singleSelected.wallShadowOffsetY ?? 0}px</span>
                      </Label>
                      <Slider
                        min={-20} max={20} step={1}
                        value={[singleSelected.wallShadowOffsetY ?? 0]}
                        onValueChange={([v]) => updateWall({ wallShadowOffsetY: v })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      Opacity <span className="text-muted-foreground">{Math.round((singleSelected.wallShadowOpacity ?? 1) * 100)}%</span>
                    </Label>
                    <Slider
                      min={0} max={1} step={0.01}
                      value={[singleSelected.wallShadowOpacity ?? 1]}
                      onValueChange={([v]) => updateWall({ wallShadowOpacity: v })}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
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
          </>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={allLocked}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
    </div>
  );
};
