import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Grid3X3, Eye, EyeOff, Trash2, Palette, Image, CheckSquare, Lock, Unlock, CloudFog, Waypoints, Fence, Box, Armchair, Droplets } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { toast } from 'sonner';
import { Z_INDEX } from '@/lib/zIndex';
import { RegionBulkTextureModal } from './modals/RegionBulkTextureModal';
import { MAP_OBJECT_PRESETS } from '@/types/mapObjectTypes';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showTextureModal, setShowTextureModal] = useState(false);
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
  const someLocked = selectedRegions.some(r => r.locked);
  
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
    
    addMapObject({
      position: { x: centerX, y: centerY },
      width: portalSize,
      height: portalSize,
      shape: 'portal',
      category: 'portal',
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
    });
    
    // Remove the source region
    removeRegion(firstRegion.id);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success('Portal created from region');
  };
  
  const handleConvertToWalls = () => {
    let wallCount = 0;
    
    selectedRegions.forEach(region => {
      let points: { x: number; y: number }[];
      
      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 2) {
        points = region.pathPoints.map(p => ({ x: region.x + p.x, y: region.y + p.y }));
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
      
      addMapObject({
        position: { x: points[0].x, y: points[0].y },
        width: 0,
        height: 0,
        shape: 'wall',
        category: 'wall',
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
      });
      wallCount++;
      
      // Remove the source region
      removeRegion(region.id);
    });
    
    onClearSelection();
    onUpdateCanvas?.();
    toast.success(`Created ${wallCount} wall(s) from region edges`);
  };
  
  const handleConvertToMapObject = (category: 'obstacle' | 'furniture' | 'water') => {
    const preset = MAP_OBJECT_PRESETS[category];
    let count = 0;
    
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
      
      addMapObject({
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
      });
      count++;
      
      // Remove the source region
      removeRegion(region.id);
    });
    
    onClearSelection();
    onUpdateCanvas?.();
    const labels = { obstacle: 'obstacle(s)', furniture: 'furniture piece(s)', water: 'water feature(s)' };
    toast.success(`Created ${count} ${labels[category]} from region(s)`);
  };
  
  return (
    <>
      <div 
        className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg px-2 py-1.5"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground px-1.5">
            {selectedRegions.length} region{selectedRegions.length > 1 ? 's' : ''}
          </span>
          
          <div className="h-4 w-px bg-border" />
          
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
          
          {/* Convert to Portal (single selection only) */}
          {isSingleSelection && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleConvertToPortal}
              >
                <Waypoints className="h-3 w-3 mr-1" />
                Portal
              </Button>
            </>
          )}
          
          {/* Convert to MapObjects */}
          <div className="h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleConvertToWalls}
          >
            <Fence className="h-3 w-3 mr-1" />
            Walls
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleConvertToMapObject('obstacle')}
          >
            <Box className="h-3 w-3 mr-1" />
            Obstacle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleConvertToMapObject('furniture')}
          >
            <Armchair className="h-3 w-3 mr-1" />
            Furniture
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleConvertToMapObject('water')}
          >
            <Droplets className="h-3 w-3 mr-1" />
            Water
          </Button>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Delete */}
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Del
          </Button>
          
          {/* Clear Selection */}
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClearSelection}
          >
            ✕
          </Button>
        </div>
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