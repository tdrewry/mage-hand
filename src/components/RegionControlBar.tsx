import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Grid3X3, Eye, EyeOff, Trash2, Palette, Image, CheckSquare, Lock, Unlock, CloudFog, Waypoints, Fence, Box, Armchair, Droplets, ArrowRightLeft, Copy, Flag } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { toast } from 'sonner';
import { Z_INDEX } from '@/lib/zIndex';
import { RegionBulkTextureModal } from './modals/RegionBulkTextureModal';
import { MAP_OBJECT_PRESETS } from '@/types/mapObjectTypes';
import { undoRedoManager } from '@/lib/undoRedoManager';
import { ConvertRegionToMapObjectCommand } from '@/lib/commands/regionCommands';

interface RegionControlBarProps {
  selectedRegionIds: string[];
  onClearSelection: () => void;
  onUpdateCanvas?: () => void;
  onSelectAll?: () => void;
  onMarkExplored?: (regionIds: string[]) => void;
  onUnmarkExplored?: (regionIds: string[]) => void;
  isDM?: boolean;
}

export const RegionControlBar: React.FC<RegionControlBarProps> = ({
  selectedRegionIds,
  onClearSelection,
  onUpdateCanvas,
  onSelectAll,
  onMarkExplored,
  onUnmarkExplored,
  isDM = false,
}) => {
  const { regions, updateRegion, removeRegion } = useRegionStore();
  const addMapObject = useMapObjectStore(state => state.addMapObject);
  const removeMapObject = useMapObjectStore(state => state.removeMapObject);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showTextureModal, setShowTextureModal] = useState(false);
  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [colorValue, setColorValue] = useState('#4F46E5');
  
  const selectedRegions = regions.filter(r => selectedRegionIds.includes(r.id));
  const firstRegion = selectedRegions[0];
  const [gridSizeInput, setGridSizeInput] = useState(firstRegion?.gridSize?.toString() || '50');
  
  // Update grid size input when region changes
  React.useEffect(() => {
    if (firstRegion) {
      setGridSizeInput(firstRegion.gridSize?.toString() || '50');
    }
  }, [firstRegion?.id, firstRegion?.gridSize]);
  
  if (selectedRegions.length === 0) return null;
  
  const isSingleSelection = selectedRegions.length === 1;
  const allLocked = selectedRegions.every(r => r.locked);
  
  const handleToggleLock = () => {
    const newLocked = !allLocked;
    selectedRegions.forEach(region => {
      updateRegion(region.id, { locked: newLocked });
    });
    toast.success(`${newLocked ? 'Locked' : 'Unlocked'} ${selectedRegions.length} region(s)`);
  };
  
  const handleToggleGridSnap = (enabled: boolean) => {
    selectedRegions.forEach(region => {
      updateRegion(region.id, { gridSnapping: enabled });
    });
    onUpdateCanvas?.();
    toast.success(`Grid snapping ${enabled ? 'enabled' : 'disabled'} for ${selectedRegions.length} region(s)`);
  };
  
  const handleToggleGridVisible = (visible: boolean) => {
    selectedRegions.forEach(region => {
      updateRegion(region.id, { gridVisible: visible });
    });
    onUpdateCanvas?.();
    toast.success(`Grid ${visible ? 'shown' : 'hidden'} for ${selectedRegions.length} region(s)`);
  };
  
  const handleUpdateGridSize = () => {
    const size = parseInt(gridSizeInput);
    if (isNaN(size) || size < 10 || size > 500) {
      toast.error('Grid size must be between 10 and 500');
      return;
    }
    
    selectedRegions.forEach(region => {
      updateRegion(region.id, { gridSize: size });
    });
    onUpdateCanvas?.();
    toast.success(`Grid size updated to ${size} for ${selectedRegions.length} region(s)`);
  };
  
  const handleApplyColor = () => {
    selectedRegions.forEach(region => {
      updateRegion(region.id, { color: colorValue });
    });
    setShowColorModal(false);
    onUpdateCanvas?.();
    toast.success(`Color updated for ${selectedRegions.length} region(s)`);
  };
  
  const handleDeleteConfirm = () => {
    selectedRegions.forEach(region => {
      removeRegion(region.id);
    });
    setShowDeleteModal(false);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success(`Deleted ${selectedRegions.length} region(s)`);
  };
  
  const handleConvertToPortal = () => {
    if (!isSingleSelection || !firstRegion) return;
    
    const centerX = firstRegion.x + (firstRegion.width / 2);
    const centerY = firstRegion.y + (firstRegion.height / 2);
    const portalSize = Math.min(firstRegion.width, firstRegion.height, 60);
    
    const mapObjData = {
      position: { x: centerX, y: centerY },
      width: portalSize,
      height: portalSize,
      shape: 'portal' as const,
      category: 'portal' as const,
      fillColor: 'rgba(139, 92, 246, 0.25)',
      strokeColor: '#8b5cf6',
      strokeWidth: 2,
      opacity: 1,
      castsShadow: false,
      blocksMovement: false,
      blocksVision: false,
      revealedByLight: false,
      selected: false,
      portalName: `Portal ${firstRegion.id.slice(-4)}`,
      mapId: firstRegion.mapId,
    };
    const newId = addMapObject(mapObjData);
    
    const regionSnapshot = { ...firstRegion };
    removeRegion(firstRegion.id);
    undoRedoManager.push(new ConvertRegionToMapObjectCommand(regionSnapshot, newId, mapObjData, addMapObject, removeMapObject, 'portal'));
    
    setShowConvertMenu(false);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success('Portal created from region');
  };
  
  const handleConvertToWalls = () => {
    selectedRegions.forEach(region => {
      let points: { x: number; y: number }[];
      
      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 2) {
        // pathPoints are relative to region position; make them absolute
        points = region.pathPoints.map(p => ({ x: p.x, y: p.y }));
        // Close the polyline so the wall forms a closed shape
        const first = points[0];
        const last = points[points.length - 1];
        if (first.x !== last.x || first.y !== last.y) {
          points.push({ x: first.x, y: first.y });
        }
      } else {
        const { x, y, width, height } = region;
        points = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
          { x, y },
        ];
      }
      
      const wallData = {
        position: { x: 0, y: 0 },
        width: 0,
        height: 0,
        shape: 'wall' as const,
        category: 'wall' as const,
        fillColor: 'transparent',
        strokeColor: '#ef4444',
        strokeWidth: 2,
        opacity: 1,
        castsShadow: false,
        blocksMovement: true,
        blocksVision: true,
        revealedByLight: false,
        selected: false,
        wallPoints: points,
        mapId: region.mapId,
      };
      const newId = addMapObject(wallData);
      
      const regionSnapshot = { ...region };
      removeRegion(region.id);
      undoRedoManager.push(new ConvertRegionToMapObjectCommand(regionSnapshot, newId, wallData, addMapObject, removeMapObject, 'wall'));
    });
    
    setShowConvertMenu(false);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success(`Created ${selectedRegions.length} wall(s) from region edges`);
  };
  
  const handleConvertToMapObject = (category: 'obstacle' | 'furniture' | 'water' | 'deployment-zone') => {
    const preset = MAP_OBJECT_PRESETS[category];
    
    selectedRegions.forEach(region => {
      let customPath: { x: number; y: number }[] | undefined;
      
      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 2) {
        customPath = region.pathPoints.map(p => ({ x: p.x, y: p.y }));
        // Close the polyline so the shape matches the region
        const first = customPath[0];
        const last = customPath[customPath.length - 1];
        if (first.x !== last.x || first.y !== last.y) {
          customPath.push({ x: first.x, y: first.y });
        }
      }
      
      const shape = customPath ? 'custom' : (preset.shape || 'rectangle');
      
      const mapObjData = {
        position: { x: region.x, y: region.y },
        width: region.width,
        height: region.height,
        shape,
        category,
        fillColor: preset.fillColor,
        strokeColor: preset.strokeColor,
        strokeWidth: preset.strokeWidth ?? 2,
        opacity: preset.opacity ?? 1,
        castsShadow: preset.castsShadow ?? false,
        blocksMovement: preset.blocksMovement ?? false,
        blocksVision: preset.blocksVision ?? false,
        revealedByLight: preset.revealedByLight ?? true,
        selected: false,
        customPath,
        mapId: region.mapId,
      };
      const newId = addMapObject(mapObjData);
      
      const regionSnapshot = { ...region };
      removeRegion(region.id);
      undoRedoManager.push(new ConvertRegionToMapObjectCommand(regionSnapshot, newId, mapObjData, addMapObject, removeMapObject, category));
    });
    
    setShowConvertMenu(false);
    onClearSelection();
    onUpdateCanvas?.();
    const labels: Record<string, string> = { obstacle: 'obstacle(s)', furniture: 'furniture piece(s)', water: 'water feature(s)', 'deployment-zone': 'deployment zone(s)' };
    toast.success(`Created ${selectedRegions.length} ${labels[category]} from region(s)`);
  };
  
  return (
    <>
      <div className="flex items-center gap-1">
          
          {/* Select All */}
          {onSelectAll && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onSelectAll}>
              <CheckSquare className="h-3 w-3 mr-1" />
              All
            </Button>
          )}
          
          {/* Grid Snapping */}
          <div className="flex items-center gap-1 px-1">
            <Grid3X3 className="h-3 w-3 text-muted-foreground" />
            <Switch
              checked={firstRegion?.gridSnapping ?? false}
              onCheckedChange={handleToggleGridSnap}
              className="scale-75"
            />
          </div>
          
          {/* Grid Visibility */}
          <div className="flex items-center gap-1 px-1">
            {firstRegion?.gridVisible ? (
              <Eye className="h-3 w-3 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
            <Switch
              checked={firstRegion?.gridVisible ?? true}
              onCheckedChange={handleToggleGridVisible}
              className="scale-75"
            />
          </div>
          
          {/* Grid Size */}
          <div className="flex items-center gap-1">
            <Input
              id="grid-size"
              type="number"
              value={gridSizeInput}
              onChange={(e) => setGridSizeInput(e.target.value)}
              onBlur={handleUpdateGridSize}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateGridSize()}
              className="w-12 h-5 text-xs px-1"
              min={10}
              max={500}
            />
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Lock Toggle */}
          <Button 
            variant={allLocked ? "default" : "ghost"} 
            size="sm" 
            className="h-6 px-2 text-xs" 
            onClick={handleToggleLock}
          >
            {allLocked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
            {allLocked ? 'Locked' : 'Lock'}
          </Button>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Texture */}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowTextureModal(true)}>
            <Image className="h-3 w-3 mr-1" />
            Texture
          </Button>
          
          {/* Background Color */}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
            setColorValue(firstRegion?.color || '#4F46E5');
            setShowColorModal(true);
          }}>
            <Palette className="h-3 w-3 mr-1" />
            Color
          </Button>
          
          {/* Mark as Explored / Unreveal (DM only, fog reveal) */}
          {isDM && (onMarkExplored || onUnmarkExplored) && (
            <>
              <div className="h-4 w-px bg-border" />
              {onMarkExplored && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs" 
                  onClick={() => onMarkExplored(selectedRegionIds)}
                >
                  <CloudFog className="h-3 w-3 mr-1" />
                  Reveal
                </Button>
              )}
              {onUnmarkExplored && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs" 
                  onClick={() => onUnmarkExplored(selectedRegionIds)}
                >
                  <EyeOff className="h-3 w-3 mr-1" />
                  Unreveal
                </Button>
              )}
            </>
          )}
          
          {/* Duplicate */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs" 
            onClick={() => {
              const { addRegion } = useRegionStore.getState();
              selectedRegions.forEach(region => {
                const { id, selected, ...rest } = region;
                addRegion({
                  ...rest,
                  x: region.x + 30,
                  y: region.y + 30,
                  selected: false,
                  pathPoints: region.pathPoints ? region.pathPoints.map(p => ({ x: p.x, y: p.y })) : undefined,
                });
              });
              onUpdateCanvas?.();
              toast.success(`Duplicated ${selectedRegions.length} region(s)`);
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            Dup
          </Button>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Convert To — popover menu */}
          <Popover open={showConvertMenu} onOpenChange={setShowConvertMenu}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <ArrowRightLeft className="h-3 w-3 mr-1" />
                Convert
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" side="top" align="center">
              <div className="flex flex-col gap-0.5">
                {isSingleSelection && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs justify-start"
                    onClick={handleConvertToPortal}
                  >
                    <Waypoints className="h-3 w-3 mr-2" />
                    Portal
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs justify-start"
                  onClick={handleConvertToWalls}
                >
                  <Fence className="h-3 w-3 mr-2" />
                  Walls
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs justify-start"
                  onClick={() => handleConvertToMapObject('obstacle')}
                >
                  <Box className="h-3 w-3 mr-2" />
                  Obstacle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs justify-start"
                  onClick={() => handleConvertToMapObject('furniture')}
                >
                  <Armchair className="h-3 w-3 mr-2" />
                  Furniture
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs justify-start"
                  onClick={() => handleConvertToMapObject('water')}
                >
                  <Droplets className="h-3 w-3 mr-2" />
                  Water
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs justify-start"
                  onClick={() => handleConvertToMapObject('deployment-zone')}
                >
                  <Flag className="h-3 w-3 mr-2" />
                  Deployment Zone
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
        </div>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedRegions.length > 1 ? `${selectedRegions.length} Regions` : 'Region'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRegions.length > 1 ? 'these regions' : 'this region'}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Color Modal */}
      <Dialog open={showColorModal} onOpenChange={setShowColorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Region Color</DialogTitle>
            <DialogDescription>
              Set the background color for {selectedRegions.length > 1 ? `${selectedRegions.length} regions` : 'this region'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="region-color">Region Color</Label>
              <div className="flex gap-2">
                <Input
                  id="region-color"
                  type="color"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  className="h-10"
                />
                <Input
                  type="text"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  placeholder="#4F46E5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColorModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyColor}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Texture Modal */}
      <RegionBulkTextureModal
        open={showTextureModal}
        onOpenChange={setShowTextureModal}
        selectedRegionIds={selectedRegionIds}
        onUpdateCanvas={onUpdateCanvas}
      />
    </>
  );
};
