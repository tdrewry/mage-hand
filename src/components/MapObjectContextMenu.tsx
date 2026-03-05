import React, { useState, useEffect, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit3, Trash2, Eye, DoorOpen, DoorClosed, Lock, Unlock, Waypoints, Link2, Link2Off, EyeOff, Copy, Image } from 'lucide-react';
import { ImageImportModal, type ImageImportResult, type ShapeConfig } from '@/components/modals/ImageImportModal';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useMapStore } from '@/stores/mapStore';
import { MapObject, MapObjectCategory, MAP_OBJECT_CATEGORY_LABELS } from '@/types/mapObjectTypes';
import { toast } from 'sonner';

interface MapObjectContextMenuWrapperProps {
  mapObjectId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdateCanvas?: () => void;
}

export const MapObjectContextMenuWrapper = ({
  mapObjectId,
  position,
  onClose,
  onUpdateCanvas,
}: MapObjectContextMenuWrapperProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasOpenedRef = useRef(false);
  
  const {
    mapObjects,
    selectedMapObjectIds,
    updateMapObject,
    removeMapObject,
    removeMultipleMapObjects,
    toggleDoor,
  } = useMapObjectStore();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTextureModal, setShowTextureModal] = useState(false);

  // Edit modal state
  const [labelValue, setLabelValue] = useState('');
  const [widthValue, setWidthValue] = useState(20);
  const [heightValue, setHeightValue] = useState(20);
  const [rotationValue, setRotationValue] = useState(0);
  const [opacityValue, setOpacityValue] = useState(1);
  const [fillColorValue, setFillColorValue] = useState('#6b7280');
  const [strokeColorValue, setStrokeColorValue] = useState('#4b5563');
  const [strokeWidthValue, setStrokeWidthValue] = useState(2);
  const [castsShadowValue, setCastsShadowValue] = useState(false);
  const [blocksMovementValue, setBlocksMovementValue] = useState(false);
  const [blocksVisionValue, setBlocksVisionValue] = useState(false);
  const [revealedByLightValue, setRevealedByLightValue] = useState(true);
  const [categoryValue, setCategoryValue] = useState<MapObjectCategory>('custom');
  const [lightColorValue, setLightColorValue] = useState('#fbbf24');
  const [lightRadiusValue, setLightRadiusValue] = useState(100);
  const [lightBrightRadiusValue, setLightBrightRadiusValue] = useState(50);
  const [lightIntensityValue, setLightIntensityValue] = useState(1);
  const [lightEnabledValue, setLightEnabledValue] = useState(true);

  // Portal-specific state
  const [portalNameValue, setPortalNameValue] = useState('');
  const [portalTargetIdValue, setPortalTargetIdValue] = useState<string | undefined>(undefined);
  const [portalHiddenInPlayValue, setPortalHiddenInPlayValue] = useState(false);
  const [portalAutoActivateValue, setPortalAutoActivateValue] = useState(false);

  const allMapObjects = useMapObjectStore((state) => state.mapObjects);
  const allPortals = allMapObjects.filter(obj => obj.category === 'portal');
  const maps = useMapStore(state => state.maps);

  // Get the objects to operate on
  const getTargetObjects = (): MapObject[] => {
    if (selectedMapObjectIds.includes(mapObjectId)) {
      return mapObjects.filter(obj => selectedMapObjectIds.includes(obj.id));
    }
    return mapObjects.filter(obj => obj.id === mapObjectId);
  };

  const targetObjects = getTargetObjects();
  const isMultiSelection = targetObjects.length > 1;
  const currentObject = mapObjects.find(obj => obj.id === mapObjectId);

  // Handle open state change - close calls parent onClose
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && !showEditModal && !showDeleteModal && !showTextureModal) {
      onClose();
    }
  };

  const handleEditClick = () => {
    if (targetObjects.length === 1) {
      const obj = targetObjects[0];
      setLabelValue(obj.label || '');
      setWidthValue(obj.width);
      setHeightValue(obj.height);
      setRotationValue(obj.rotation || 0);
      setOpacityValue(obj.opacity);
      setFillColorValue(obj.fillColor);
      setStrokeColorValue(obj.strokeColor);
      setStrokeWidthValue(obj.strokeWidth);
      setCastsShadowValue(obj.castsShadow);
      setBlocksMovementValue(obj.blocksMovement);
      setBlocksVisionValue(obj.blocksVision);
      setRevealedByLightValue(obj.revealedByLight);
      setCategoryValue(obj.category);
      setLightColorValue(obj.lightColor || '#fbbf24');
      setLightRadiusValue(obj.lightRadius || 100);
      setLightBrightRadiusValue(obj.lightBrightRadius || (obj.lightRadius || 100) * 0.5);
      setLightIntensityValue(obj.lightIntensity || 1);
      setLightEnabledValue(obj.lightEnabled !== false);
      // Portal fields
      setPortalNameValue(obj.portalName || '');
      setPortalTargetIdValue(obj.portalTargetId);
      setPortalHiddenInPlayValue(obj.portalHiddenInPlay ?? false);
      setPortalAutoActivateValue(obj.portalAutoActivateTarget ?? false);
    } else {
      // Multi-selection: use defaults
      setLabelValue('');
      setWidthValue(20);
      setHeightValue(20);
      setRotationValue(0);
      setOpacityValue(1);
      setFillColorValue('#6b7280');
      setStrokeColorValue('#4b5563');
      setStrokeWidthValue(2);
      setCastsShadowValue(false);
      setBlocksMovementValue(false);
      setBlocksVisionValue(false);
      setRevealedByLightValue(true);
      setCategoryValue('custom');
    }
    setShowEditModal(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const applyEdit = () => {
    targetObjects.forEach(obj => {
      const updates: Partial<MapObject> = {};
      
      if (labelValue) updates.label = labelValue;
      if (!isMultiSelection) {
        updates.width = widthValue;
        updates.height = heightValue;
        updates.rotation = rotationValue;
      }
      updates.opacity = opacityValue;
      updates.fillColor = fillColorValue;
      updates.strokeColor = strokeColorValue;
      updates.strokeWidth = strokeWidthValue;
      updates.castsShadow = castsShadowValue;
      updates.blocksMovement = blocksMovementValue;
      updates.blocksVision = blocksVisionValue;
      updates.revealedByLight = revealedByLightValue;
      if (!isMultiSelection) {
        updates.category = categoryValue;
      }
      
      // Light-specific properties
      if (obj.category === 'light' || categoryValue === 'light') {
        updates.lightColor = lightColorValue;
        updates.lightRadius = lightRadiusValue;
        updates.lightBrightRadius = lightBrightRadiusValue;
        updates.lightIntensity = lightIntensityValue;
        updates.lightEnabled = lightEnabledValue;
      }

      // Portal-specific properties
      if (obj.category === 'portal') {
        updates.portalName = portalNameValue;
        updates.portalTargetId = portalTargetIdValue;
        updates.portalHiddenInPlay = portalHiddenInPlayValue;
        updates.portalAutoActivateTarget = portalAutoActivateValue;
      }

      updateMapObject(obj.id, updates);
    });

    // If any light's enabled state changed, trigger a fog refresh
    const hasLightEnabledChange = targetObjects.some(
      (obj) => (obj.category === 'light' || categoryValue === 'light') &&
               obj.lightEnabled !== lightEnabledValue
    );
    if (hasLightEnabledChange) {
      window.dispatchEvent(new CustomEvent('fog:force-refresh'));
    }

    setShowEditModal(false);
    onUpdateCanvas?.();
    toast.success(isMultiSelection ? `Updated ${targetObjects.length} objects` : 'Map object updated');
  };

  const confirmDelete = () => {
    if (isMultiSelection) {
      removeMultipleMapObjects(targetObjects.map(obj => obj.id));
      toast.success(`Deleted ${targetObjects.length} objects`);
    } else {
      removeMapObject(mapObjectId);
      toast.success('Map object deleted');
    }
    setShowDeleteModal(false);
    onUpdateCanvas?.();
  };

  const handleToggleDoor = () => {
    if (currentObject?.category === 'door') {
      toggleDoor(mapObjectId);
      onUpdateCanvas?.();
    }
  };

  const handleDialogClose = (open: boolean, setter: (v: boolean) => void) => {
    setter(open);
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <div
            style={{
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: '1px',
              height: '1px',
              pointerEvents: 'none',
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-56" 
          align="start"
          side="bottom"
          sideOffset={0}
        >
          {/* Edit option */}
          <DropdownMenuItem onClick={handleEditClick}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit {isMultiSelection ? `${targetObjects.length} Objects` : 'Object'}
          </DropdownMenuItem>

          {/* Door-specific toggle */}
          {currentObject?.category === 'door' && !isMultiSelection && (
            <DropdownMenuItem onClick={handleToggleDoor}>
              {currentObject.isOpen ? (
                <>
                  <DoorClosed className="mr-2 h-4 w-4" />
                  Close Door
                </>
              ) : (
                <>
                  <DoorOpen className="mr-2 h-4 w-4" />
                  Open Door
                </>
              )}
            </DropdownMenuItem>
          )}

          {/* Lock/Unlock toggle */}
          <DropdownMenuItem onClick={() => {
            targetObjects.forEach(obj => {
              updateMapObject(obj.id, { locked: !obj.locked });
            });
            onUpdateCanvas?.();
            const isLocking = !targetObjects[0]?.locked;
            toast.success(isLocking ? 'Object locked' : 'Object unlocked');
          }}>
            {targetObjects.every(obj => obj.locked) ? (
              <>
                <Unlock className="mr-2 h-4 w-4" />
                Unlock {isMultiSelection ? 'Objects' : 'Object'}
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Lock {isMultiSelection ? 'Objects' : 'Object'}
              </>
            )}
          </DropdownMenuItem>

          {/* Duplicate */}
          <DropdownMenuItem onClick={() => {
            const { addMapObject } = useMapObjectStore.getState();
            targetObjects.forEach(obj => {
              const { id, ...rest } = obj;
              addMapObject({
                ...rest,
                position: { x: obj.position.x + 30, y: obj.position.y + 30 },
                label: obj.label ? `${obj.label} (copy)` : undefined,
                selected: false,
                wallPoints: obj.wallPoints ? obj.wallPoints.map(p => ({ x: p.x + 30, y: p.y + 30 })) : undefined,
              });
            });
            onUpdateCanvas?.();
            toast.success(`Duplicated ${targetObjects.length} object${targetObjects.length > 1 ? 's' : ''}`);
          }}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate {isMultiSelection ? `${targetObjects.length} Objects` : 'Object'}
          </DropdownMenuItem>

          {/* Set Texture (single non-wall/light/annotation objects) */}
          {!isMultiSelection && currentObject && 
            !['wall', 'light', 'annotation'].includes(currentObject.shape) && (
            <>
              <DropdownMenuItem onClick={() => setShowTextureModal(true)}>
                <Image className="mr-2 h-4 w-4" />
                {currentObject.imageUrl ? 'Change Texture' : 'Set Texture'}
              </DropdownMenuItem>
              {currentObject.imageUrl && (
                <DropdownMenuItem onClick={() => {
                  updateMapObject(currentObject.id, { imageUrl: undefined, textureScale: undefined, textureOffsetX: undefined, textureOffsetY: undefined });
                  onUpdateCanvas?.();
                  toast.success('Texture removed');
                }}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Texture
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />

          {/* Quick toggles */}
          <DropdownMenuCheckboxItem
            checked={targetObjects.every(obj => obj.blocksVision)}
            onCheckedChange={(checked) => {
              targetObjects.forEach(obj => {
                updateMapObject(obj.id, { blocksVision: checked });
              });
              onUpdateCanvas?.();
            }}
          >
            <Eye className="mr-2 h-4 w-4" />
            Blocks Vision
          </DropdownMenuCheckboxItem>

          <DropdownMenuCheckboxItem
            checked={targetObjects.every(obj => obj.castsShadow)}
            onCheckedChange={(checked) => {
              targetObjects.forEach(obj => {
                updateMapObject(obj.id, { castsShadow: checked });
              });
              onUpdateCanvas?.();
            }}
          >
            Casts Shadow
          </DropdownMenuCheckboxItem>

          <DropdownMenuCheckboxItem
            checked={targetObjects.every(obj => obj.revealedByLight)}
            onCheckedChange={(checked) => {
              targetObjects.forEach(obj => {
                updateMapObject(obj.id, { revealedByLight: checked });
              });
              onUpdateCanvas?.();
            }}
          >
            Revealed by Light
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          {/* Delete option */}
          <DropdownMenuItem
            onClick={handleDeleteClick}
            className="text-destructive focus:text-destructive"
            disabled={targetObjects.some(obj => obj.locked)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {isMultiSelection ? `${targetObjects.length} Objects` : 'Object'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => handleDialogClose(open, setShowEditModal)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {isMultiSelection ? `${targetObjects.length} Map Objects` : 'Map Object'}
            </DialogTitle>
            <DialogDescription>
              {isMultiSelection
                ? 'Changes will apply to all selected objects'
                : `Editing ${currentObject?.label || MAP_OBJECT_CATEGORY_LABELS[currentObject?.category || 'custom']}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                placeholder="Optional label"
              />
            </div>

            {/* Dimensions (single selection only) */}
            {!isMultiSelection && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">Width</Label>
                    <NumericInput
                      id="width"
                      value={widthValue}
                      onChange={(v) => setWidthValue(v)}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height</Label>
                    <NumericInput
                      id="height"
                      value={heightValue}
                      onChange={(v) => setHeightValue(v)}
                      min={1}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rotation">Rotation (degrees)</Label>
                  <NumericInput
                    id="rotation"
                    value={rotationValue}
                    onChange={(v) => setRotationValue(v)}
                    min={0}
                    max={360}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={categoryValue} onValueChange={(v) => setCategoryValue(v as MapObjectCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAP_OBJECT_CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Opacity */}
            <div className="space-y-2">
              <Label>Opacity: {Math.round(opacityValue * 100)}%</Label>
              <Slider
                value={[opacityValue]}
                onValueChange={([v]) => setOpacityValue(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fillColor">Fill Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="fillColor"
                    type="color"
                    value={fillColorValue}
                    onChange={(e) => setFillColorValue(e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={fillColorValue}
                    onChange={(e) => setFillColorValue(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="strokeColor">Stroke Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="strokeColor"
                    type="color"
                    value={strokeColorValue}
                    onChange={(e) => setStrokeColorValue(e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={strokeColorValue}
                    onChange={(e) => setStrokeColorValue(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Stroke Width */}
            <div className="space-y-2">
              <Label>Stroke Width: {strokeWidthValue}px</Label>
              <Slider
                value={[strokeWidthValue]}
                onValueChange={([v]) => setStrokeWidthValue(v)}
                min={0}
                max={10}
                step={0.5}
              />
            </div>

            {/* Behavior toggles */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Behavior</Label>

              <div className="flex items-center justify-between">
                <Label htmlFor="castsShadow" className="font-normal">Casts Shadow</Label>
                <Switch
                  id="castsShadow"
                  checked={castsShadowValue}
                  onCheckedChange={setCastsShadowValue}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="blocksMovement" className="font-normal">Blocks Movement</Label>
                <Switch
                  id="blocksMovement"
                  checked={blocksMovementValue}
                  onCheckedChange={setBlocksMovementValue}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="blocksVision" className="font-normal">Blocks Vision</Label>
                <Switch
                  id="blocksVision"
                  checked={blocksVisionValue}
                  onCheckedChange={setBlocksVisionValue}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="revealedByLight" className="font-normal">Revealed by Light</Label>
                <Switch
                  id="revealedByLight"
                  checked={revealedByLightValue}
                  onCheckedChange={setRevealedByLightValue}
                />
              </div>
            </div>

            {/* Light Properties (only for light category) */}
            {(currentObject?.category === 'light' || categoryValue === 'light') && !isMultiSelection && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Light Properties</Label>

                <div className="flex items-center justify-between">
                  <Label htmlFor="lightEnabled" className="font-normal">Enabled</Label>
                  <Switch
                    id="lightEnabled"
                    checked={lightEnabledValue}
                    onCheckedChange={setLightEnabledValue}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lightColor">Light Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lightColor"
                      type="color"
                      value={lightColorValue}
                      onChange={(e) => setLightColorValue(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={lightColorValue}
                      onChange={(e) => setLightColorValue(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dim Radius: {Math.round(lightRadiusValue)}px</Label>
                  <Slider
                    value={[lightRadiusValue]}
                    onValueChange={([v]) => {
                      setLightRadiusValue(v);
                      if (lightBrightRadiusValue > v) setLightBrightRadiusValue(v * 0.5);
                    }}
                    min={10}
                    max={1000}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bright Radius: {Math.round(lightBrightRadiusValue)}px</Label>
                  <Slider
                    value={[lightBrightRadiusValue]}
                    onValueChange={([v]) => setLightBrightRadiusValue(Math.min(v, lightRadiusValue))}
                    min={0}
                    max={lightRadiusValue}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Intensity: {Math.round(lightIntensityValue * 100)}%</Label>
                  <Slider
                    value={[lightIntensityValue]}
                    onValueChange={([v]) => setLightIntensityValue(v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
              </div>
            )}

            {/* Portal Properties (only for portal category) */}
            {currentObject?.category === 'portal' && !isMultiSelection && (
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Waypoints className="w-4 h-4 text-purple-500" />
                  Portal Settings
                </Label>

                <div className="space-y-2">
                  <Label htmlFor="portalName">Portal Name</Label>
                  <Input
                    id="portalName"
                    value={portalNameValue}
                    onChange={(e) => setPortalNameValue(e.target.value)}
                    placeholder="Enter portal name..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Link to Portal</Label>
                  <Select
                    value={portalTargetIdValue || '__none__'}
                    onValueChange={(value) => setPortalTargetIdValue(value === '__none__' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target portal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="flex items-center gap-2">
                          <Link2Off className="w-3 h-3" />
                          No link
                        </span>
                      </SelectItem>
                      {allPortals
                        .filter(p => p.id !== currentObject.id)
                        .map(portal => {
                          const portalMap = maps.find(m => m.id === portal.mapId);
                          return (
                            <SelectItem key={portal.id} value={portal.id}>
                              <span className="flex items-center gap-2">
                                <Link2 className="w-3 h-3" />
                                {portal.portalName || 'Unnamed'}
                                {portalMap ? ` (${portalMap.name})` : ''}
                              </span>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  {portalTargetIdValue && (
                    <p className="text-xs text-green-600">
                      ✓ Linked — tokens dropped here will teleport
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="portalHidden" className="font-normal flex items-center gap-2">
                    <EyeOff className="w-3 h-3" />
                    Hidden in Play Mode
                  </Label>
                  <Switch
                    id="portalHidden"
                    checked={portalHiddenInPlayValue}
                    onCheckedChange={setPortalHiddenInPlayValue}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="portalAutoActivate" className="font-normal flex items-center gap-2">
                    <Eye className="w-3 h-3" />
                    Auto-activate Target Map
                  </Label>
                  <Switch
                    id="portalAutoActivate"
                    checked={portalAutoActivateValue}
                    onCheckedChange={setPortalAutoActivateValue}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {portalAutoActivateValue
                    ? 'Teleport will auto-activate the target map and set it as focused.'
                    : 'Teleporting to an inactive map will hide the token.'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false, setShowEditModal)}>
              Cancel
            </Button>
            <Button onClick={applyEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => handleDialogClose(open, setShowDeleteModal)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {isMultiSelection ? 'Objects' : 'Object'}</DialogTitle>
            <DialogDescription>
              {isMultiSelection
                ? `Are you sure you want to delete ${targetObjects.length} map objects? This action cannot be undone.`
                : `Are you sure you want to delete this ${currentObject?.label || MAP_OBJECT_CATEGORY_LABELS[currentObject?.category || 'custom']}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false, setShowDeleteModal)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
