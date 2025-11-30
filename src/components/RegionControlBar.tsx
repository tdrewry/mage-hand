import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Grid3X3, Eye, EyeOff, Trash2, Palette } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRegionStore } from '@/stores/regionStore';
import { toast } from 'sonner';
import { Z_INDEX } from '@/lib/zIndex';

interface RegionControlBarProps {
  selectedRegionId: string | null;
  onClearSelection: () => void;
  onUpdateCanvas?: () => void;
}

export const RegionControlBar: React.FC<RegionControlBarProps> = ({
  selectedRegionId,
  onClearSelection,
  onUpdateCanvas
}) => {
  const { regions, updateRegion, removeRegion } = useRegionStore();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [colorValue, setColorValue] = useState('#4F46E5');
  
  const selectedRegion = selectedRegionId ? regions.find(r => r.id === selectedRegionId) : null;
  const [gridSizeInput, setGridSizeInput] = useState(selectedRegion?.gridSize?.toString() || '50');
  
  // Update grid size input when region changes
  React.useEffect(() => {
    if (selectedRegion) {
      setGridSizeInput(selectedRegion.gridSize?.toString() || '50');
    }
  }, [selectedRegion?.id, selectedRegion?.gridSize]);
  
  if (!selectedRegion) return null;
  
  const handleToggleGridSnap = (enabled: boolean) => {
    updateRegion(selectedRegion.id, { gridSnapping: enabled });
    onUpdateCanvas?.();
    toast.success(`Grid snapping ${enabled ? 'enabled' : 'disabled'}`);
  };
  
  const handleToggleGridVisible = (visible: boolean) => {
    updateRegion(selectedRegion.id, { gridVisible: visible });
    onUpdateCanvas?.();
    toast.success(`Grid ${visible ? 'shown' : 'hidden'}`);
  };
  
  const handleUpdateGridSize = () => {
    const size = parseInt(gridSizeInput);
    if (isNaN(size) || size < 10 || size > 500) {
      toast.error('Grid size must be between 10 and 500');
      return;
    }
    
    updateRegion(selectedRegion.id, { gridSize: size });
    onUpdateCanvas?.();
    toast.success(`Grid size updated to ${size}`);
  };
  
  const handleApplyColor = () => {
    updateRegion(selectedRegion.id, { color: colorValue });
    setShowColorModal(false);
    onUpdateCanvas?.();
    toast.success('Region color updated');
  };
  
  const handleDeleteConfirm = () => {
    removeRegion(selectedRegion.id);
    setShowDeleteModal(false);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success('Region deleted');
  };
  
  return (
    <>
      <div 
        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg p-3"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground px-2">
            Region: {selectedRegion.regionType === 'path' ? 'Path' : 'Rectangle'}
          </span>
          
          <div className="h-6 w-px bg-border" />
          
          {/* Grid Snapping */}
          <div className="flex items-center gap-2 px-2">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Snap:</span>
            <Switch
              checked={selectedRegion.gridSnapping ?? false}
              onCheckedChange={handleToggleGridSnap}
            />
          </div>
          
          {/* Grid Visibility */}
          <div className="flex items-center gap-2 px-2">
            {selectedRegion.gridVisible ? (
              <Eye className="h-4 w-4 text-muted-foreground" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">Grid:</span>
            <Switch
              checked={selectedRegion.gridVisible ?? true}
              onCheckedChange={handleToggleGridVisible}
            />
          </div>
          
          {/* Grid Size */}
          <div className="flex items-center gap-2">
            <Label htmlFor="grid-size" className="text-sm text-muted-foreground">Size:</Label>
            <Input
              id="grid-size"
              type="number"
              value={gridSizeInput}
              onChange={(e) => setGridSizeInput(e.target.value)}
              onBlur={handleUpdateGridSize}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateGridSize()}
              className="w-16 h-8 text-sm"
              min={10}
              max={500}
            />
          </div>
          
          <div className="h-6 w-px bg-border" />
          
          {/* Background Color */}
          <Button variant="outline" size="sm" onClick={() => {
            setColorValue(selectedRegion.color || '#4F46E5');
            setShowColorModal(true);
          }}>
            <Palette className="h-4 w-4 mr-2" />
            Color
          </Button>
          
          <div className="h-6 w-px bg-border" />
          
          {/* Delete */}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          
          {/* Clear Selection */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearSelection}
          >
            Clear
          </Button>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Region</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this region? This action cannot be undone.
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
              Set the background color for this region
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
    </>
  );
};