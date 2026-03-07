import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Grid3X3, 
  Eye, 
  Trash2,
  Edit3,
  Waves,
  Lock,
  Unlock
} from 'lucide-react';
import { Switch } from '../ui/switch';
import { useRegionStore, CanvasRegion } from '@/stores/regionStore';
import { CardSaveButton } from './CardSaveButton';

interface RegionControlsCardContentProps {
  regionId: string | null;
  onToggleSnapping: (id: string) => void;
  onToggleGridVisibility: (id: string) => void;
}

export const RegionControlsCardContent: React.FC<RegionControlsCardContentProps> = ({
  regionId,
  onToggleSnapping,
  onToggleGridVisibility
}) => {
  const regions = useRegionStore(state => state.regions);
  const updateRegion = useRegionStore(state => state.updateRegion);
  const removeRegion = useRegionStore(state => state.removeRegion);
  
  const region = regions.find(r => r.id === regionId);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(region?.id || '');
  const [gridSizeInput, setGridSizeInput] = useState(region?.gridSize.toString() || '50');

  useEffect(() => {
    if (region) {
      setTempName(region.id);
      setGridSizeInput(region.gridSize.toString());
    }
  }, [region?.id, region?.gridSize]);

  if (!region) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="mb-4">Region no longer exists</p>
      </div>
    );
  }

  const handleNameSave = () => {
    updateRegion(region.id, { id: tempName });
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(region.id);
    setIsEditingName(false);
  };

  const handleDeleteRegion = () => {
    removeRegion(region.id);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Region Name */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Region Name</Label>
        <div className="flex gap-2">
          {isEditingName ? (
            <>
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="text-xs h-8"
                placeholder="Region name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') handleNameCancel();
                }}
                autoFocus
              />
              <Button size="sm" onClick={handleNameSave} className="h-8 px-2">
                Save
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1 text-xs px-2 py-1 bg-muted rounded border min-h-8 flex items-center">
                {region.id}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingName(true)}
                className="h-8 px-2"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid Controls */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Grid Settings</Label>
        <div className="flex gap-2">
          <Button
            variant={region.gridSnapping ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleSnapping(region.id)}
            className="flex-1 text-xs h-8"
          >
            <Grid3X3 className="w-3 h-3 mr-1" />
            Snap {region.gridSnapping ? 'On' : 'Off'}
          </Button>
          
          {region.gridType !== 'free' && (
            <Button
              variant={region.gridVisible ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleGridVisibility(region.id)}
              className="flex-1 text-xs h-8"
            >
              <Eye className="w-3 h-3 mr-1" />
              Grid {region.gridVisible ? 'On' : 'Off'}
            </Button>
          )}
        </div>
        
        {region.gridType !== 'free' && (
          <div className="space-y-1">
            <Label htmlFor="gridSize" className="text-xs">Grid Size (px)</Label>
            <Input
              id="gridSize"
              type="number"
              min="10"
              max="500"
              step="5"
              value={gridSizeInput}
              onChange={(e) => {
                setGridSizeInput(e.target.value);
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 10) {
                  updateRegion(region.id, { gridSize: value });
                }
              }}
              onBlur={() => {
                if (!gridSizeInput || parseInt(gridSizeInput) < 10) {
                  setGridSizeInput(region.gridSize.toString());
                }
              }}
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Appearance</Label>
        <div className="space-y-1">
          <Label htmlFor="backgroundColor" className="text-xs">Background Color</Label>
          <div className="flex gap-2">
            <Input
              id="backgroundColor"
              type="color"
              value={region.backgroundColor || '#000000'}
              onChange={(e) => updateRegion(region.id, { backgroundColor: e.target.value })}
              className="h-8 w-16 p-1"
            />
            <Input
              type="text"
              value={region.backgroundColor || 'transparent'}
              onChange={(e) => updateRegion(region.id, { backgroundColor: e.target.value })}
              placeholder="transparent"
              className="h-8 text-xs flex-1"
            />
          </div>
        </div>
      </div>

      {/* Path Smoothing (only for path regions with bezier curves) */}
      {region.regionType === 'path' && region.bezierControlPoints && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Path Settings</Label>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="w-3 h-3" />
              <span className="text-xs">Smoothing</span>
            </div>
            <Switch
              checked={region.smoothing !== false}
              onCheckedChange={(checked) => 
                updateRegion(region.id, { smoothing: checked })
              }
            />
          </div>
        </div>
      )}

      {/* Region Info */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Region Info</Label>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Type: {region.regionType || 'rectangle'}</div>
          <div>Grid: {region.gridType} ({region.gridSize}px)</div>
          {region.regionType === 'rectangle' && (
            <div>Size: {Math.round(region.width)} × {Math.round(region.height)}</div>
          )}
        </div>
      </div>

      {/* Save & Sync */}
      <div className="pt-2 border-t space-y-2">
        <CardSaveButton
          context={{ type: 'region', id: region.id }}
          onSave={() => {
            console.log(`[RegionControlsCard] Save triggered for region ${region.id}`);
          }}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant={region.locked ? "default" : "outline"}
          size="sm"
          onClick={() => updateRegion(region.id, { locked: !region.locked })}
          className="w-full text-xs h-8"
        >
          {region.locked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
          {region.locked ? 'Unlock Region' : 'Lock Region'}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteRegion}
          disabled={region.locked}
          className="w-full text-xs h-8"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete Region
        </Button>
      </div>
    </div>
  );
};
