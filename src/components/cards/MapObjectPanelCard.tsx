import { useState } from 'react';
import { Circle, Square, Move, Trash2, Eye, EyeOff, SunMedium, Moon, DoorOpen, DoorClosed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { MapObject, MapObjectCategory, MAP_OBJECT_CATEGORY_LABELS, MAP_OBJECT_PRESETS, DOOR_TYPE_STYLES } from '@/types/mapObjectTypes';

export const MapObjectPanelCardContent = () => {
  const mapObjects = useMapObjectStore((state) => state.mapObjects);
  const selectedMapObjectIds = useMapObjectStore((state) => state.selectedMapObjectIds);
  const updateMapObject = useMapObjectStore((state) => state.updateMapObject);
  const removeMapObject = useMapObjectStore((state) => state.removeMapObject);
  const updateMultipleMapObjects = useMapObjectStore((state) => state.updateMultipleMapObjects);
  const removeMultipleMapObjects = useMapObjectStore((state) => state.removeMultipleMapObjects);
  const clearSelection = useMapObjectStore((state) => state.clearSelection);
  const createFromPreset = useMapObjectStore((state) => state.createFromPreset);
  const selectMapObject = useMapObjectStore((state) => state.selectMapObject);
  const toggleDoor = useMapObjectStore((state) => state.toggleDoor);
  
  const selectedObjects = mapObjects.filter((obj) => selectedMapObjectIds.includes(obj.id));
  const singleSelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isDoor = singleSelected?.category === 'door';
  
  // Local state for bulk property editing
  const [bulkCastsShadow, setBulkCastsShadow] = useState(false);
  const [bulkBlocksMovement, setBulkBlocksMovement] = useState(false);
  const [bulkBlocksVision, setBulkBlocksVision] = useState(false);
  
  const handleDelete = () => {
    if (selectedMapObjectIds.length > 0) {
      removeMultipleMapObjects(selectedMapObjectIds);
    }
  };
  
  const handleBulkUpdate = (updates: Partial<MapObject>) => {
    if (selectedMapObjectIds.length > 0) {
      updateMultipleMapObjects(selectedMapObjectIds, updates);
    }
  };
  
  const handleCreatePreset = (category: MapObjectCategory) => {
    // Create at canvas center (placeholder - should get from viewport)
    const id = createFromPreset(category, { x: 200, y: 200 });
    selectMapObject(id);
  };
  
  const getObjectIcon = (obj: MapObject) => {
    if (obj.category === 'door') {
      return obj.isOpen ? (
        <DoorOpen className="w-3 h-3 mr-2 text-green-500" />
      ) : (
        <DoorClosed className="w-3 h-3 mr-2 text-red-500" />
      );
    }
    if (obj.shape === 'circle') {
      return <Circle className="w-3 h-3 mr-2" style={{ color: obj.fillColor }} />;
    }
    return <Square className="w-3 h-3 mr-2" style={{ color: obj.fillColor }} />;
  };
  
  return (
    <div className="p-4 space-y-4">
      {/* Quick create presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Create</Label>
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(MAP_OBJECT_CATEGORY_LABELS) as MapObjectCategory[])
            .filter((cat) => cat !== 'door') // Can't manually create doors
            .slice(0, 4)
            .map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => handleCreatePreset(category)}
              >
                {MAP_OBJECT_CATEGORY_LABELS[category]}
              </Button>
            ))}
        </div>
      </div>
      
      <Separator />
      
      {/* Selection info */}
      <div className="text-sm">
        {selectedObjects.length === 0 ? (
          <p className="text-muted-foreground">No map objects selected</p>
        ) : selectedObjects.length === 1 ? (
          <p>Editing: <span className="font-medium">
            {singleSelected?.label || MAP_OBJECT_CATEGORY_LABELS[singleSelected?.category || 'custom']}
            {isDoor && singleSelected?.doorType !== undefined && ` (${DOOR_TYPE_STYLES[singleSelected.doorType]?.label || 'Unknown'})`}
          </span></p>
        ) : (
          <p>Editing <span className="font-medium">{selectedObjects.length}</span> objects</p>
        )}
      </div>
      
      {/* Properties panel */}
      {selectedObjects.length > 0 && (
        <div className="space-y-4">
          {/* Door-specific controls */}
          {isDoor && singleSelected && (
            <>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {singleSelected.isOpen ? (
                    <DoorOpen className="w-5 h-5 text-green-500" />
                  ) : (
                    <DoorClosed className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {singleSelected.isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleDoor(singleSelected.id)}
                >
                  {singleSelected.isOpen ? 'Close Door' : 'Open Door'}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {singleSelected.isOpen 
                  ? 'Open doors allow light and vision to pass through.' 
                  : 'Closed doors block light and vision.'}
              </p>
              
              <Separator />
            </>
          )}
          
          {/* Single object properties */}
          {singleSelected && !isDoor && (
            <>
              <div className="space-y-2">
                <Label htmlFor="obj-label" className="text-xs">Label</Label>
                <Input
                  id="obj-label"
                  value={singleSelected.label || ''}
                  onChange={(e) => updateMapObject(singleSelected.id, { label: e.target.value })}
                  placeholder="Object label..."
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Width</Label>
                  <Input
                    type="number"
                    value={singleSelected.width}
                    onChange={(e) => updateMapObject(singleSelected.id, { width: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height</Label>
                  <Input
                    type="number"
                    value={singleSelected.height}
                    onChange={(e) => updateMapObject(singleSelected.id, { height: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Shape</Label>
                <Select
                  value={singleSelected.shape}
                  onValueChange={(value) => updateMapObject(singleSelected.id, { shape: value as MapObject['shape'] })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="custom">Custom Path</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Fill Color</Label>
                  <Input
                    type="color"
                    value={singleSelected.fillColor}
                    onChange={(e) => updateMapObject(singleSelected.id, { fillColor: e.target.value })}
                    className="h-8 w-full cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stroke Color</Label>
                  <Input
                    type="color"
                    value={singleSelected.strokeColor}
                    onChange={(e) => updateMapObject(singleSelected.id, { strokeColor: e.target.value })}
                    className="h-8 w-full cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Opacity ({Math.round(singleSelected.opacity * 100)}%)</Label>
                <Slider
                  value={[singleSelected.opacity * 100]}
                  onValueChange={([value]) => updateMapObject(singleSelected.id, { opacity: value / 100 })}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              
              <Separator />
            </>
          )}
          
          {/* Behavior flags (work for both single and multi-select, but not shown for doors) */}
          {!isDoor && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Behavior</Label>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="casts-shadow" className="text-xs flex items-center gap-2 cursor-pointer">
                  <Moon className="w-3 h-3" />
                  Casts Shadow
                </Label>
                <Switch
                  id="casts-shadow"
                  checked={singleSelected?.castsShadow ?? bulkCastsShadow}
                  onCheckedChange={(checked) => {
                    if (singleSelected) {
                      updateMapObject(singleSelected.id, { castsShadow: checked });
                    } else {
                      setBulkCastsShadow(checked);
                      handleBulkUpdate({ castsShadow: checked });
                    }
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="blocks-movement" className="text-xs flex items-center gap-2 cursor-pointer">
                  <Move className="w-3 h-3" />
                  Blocks Movement
                </Label>
                <Switch
                  id="blocks-movement"
                  checked={singleSelected?.blocksMovement ?? bulkBlocksMovement}
                  onCheckedChange={(checked) => {
                    if (singleSelected) {
                      updateMapObject(singleSelected.id, { blocksMovement: checked });
                    } else {
                      setBulkBlocksMovement(checked);
                      handleBulkUpdate({ blocksMovement: checked });
                    }
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="blocks-vision" className="text-xs flex items-center gap-2 cursor-pointer">
                  <EyeOff className="w-3 h-3" />
                  Blocks Vision
                </Label>
                <Switch
                  id="blocks-vision"
                  checked={singleSelected?.blocksVision ?? bulkBlocksVision}
                  onCheckedChange={(checked) => {
                    if (singleSelected) {
                      updateMapObject(singleSelected.id, { blocksVision: checked });
                    } else {
                      setBulkBlocksVision(checked);
                      handleBulkUpdate({ blocksVision: checked });
                    }
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="revealed-by-light" className="text-xs flex items-center gap-2 cursor-pointer">
                  <SunMedium className="w-3 h-3" />
                  Revealed by Light
                </Label>
                <Switch
                  id="revealed-by-light"
                  checked={singleSelected?.revealedByLight ?? true}
                  onCheckedChange={(checked) => {
                    if (singleSelected) {
                      updateMapObject(singleSelected.id, { revealedByLight: checked });
                    } else {
                      handleBulkUpdate({ revealedByLight: checked });
                    }
                  }}
                />
              </div>
              
              <Separator />
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={clearSelection}
            >
              Deselect
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={handleDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}
      
      {/* Object list */}
      <Separator />
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">All Objects ({mapObjects.length})</Label>
        <ScrollArea className="h-32">
          <div className="space-y-1 pr-4">
            {mapObjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No map objects</p>
            ) : (
              mapObjects.map((obj) => (
                <Button
                  key={obj.id}
                  variant={selectedMapObjectIds.includes(obj.id) ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start h-7 text-xs"
                  onClick={() => selectMapObject(obj.id)}
                >
                  {getObjectIcon(obj)}
                  {obj.label || MAP_OBJECT_CATEGORY_LABELS[obj.category]}
                  {obj.category === 'door' && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {obj.isOpen ? 'open' : 'closed'}
                    </span>
                  )}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
