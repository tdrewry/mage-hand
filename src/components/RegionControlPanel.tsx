import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Move, 
  RotateCcw, 
  Scaling, 
  Grid3X3, 
  Eye, 
  X, 
  Settings, 
  Trash2,
  Edit3,
  Waves
} from 'lucide-react';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CanvasRegion } from '../stores/regionStore';

export type TransformMode = 'move' | 'scale' | 'rotate';

interface RegionControlPanelProps {
  region: CanvasRegion;
  transformMode: TransformMode;
  onTransformModeChange: (mode: TransformMode) => void;
  onUpdateRegion: (id: string, updates: Partial<CanvasRegion>) => void;
  onDeleteRegion: (id: string) => void;
  onClose: () => void;
  onToggleSnapping: (id: string) => void;
  onToggleGridVisibility: (id: string) => void;
}

export const RegionControlPanel: React.FC<RegionControlPanelProps> = ({
  region,
  transformMode,
  onTransformModeChange,
  onUpdateRegion,
  onDeleteRegion,
  onClose,
  onToggleSnapping,
  onToggleGridVisibility
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(region.id);

  const handleNameSave = () => {
    onUpdateRegion(region.id, { id: tempName }); // Note: this might need a different approach for renaming
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(region.id);
    setIsEditingName(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Region Controls
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
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

          {/* Transformation Mode */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Transform Mode</Label>
            <div className="flex gap-1">
              <Button
                variant={transformMode === 'move' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTransformModeChange('move')}
                className="flex-1 text-xs h-8"
                title="Move Mode"
              >
                <Move className="w-3 h-3 mr-1" />
                Move
              </Button>
              
              <Button
                variant={transformMode === 'scale' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTransformModeChange('scale')}
                className="flex-1 text-xs h-8"
                title="Scale Mode"
              >
                <Scaling className="w-3 h-3 mr-1" />
                Scale
              </Button>
              
              <Button
                variant={transformMode === 'rotate' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTransformModeChange('rotate')}
                className="flex-1 text-xs h-8"
                title="Rotate Mode"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Rotate
              </Button>
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
                  value={region.gridSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value > 0) {
                      onUpdateRegion(region.id, { gridSize: value });
                    }
                  }}
                  className="h-8 text-xs"
                />
              </div>
            )}
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
                    onUpdateRegion(region.id, { smoothing: checked })
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

          {/* Actions */}
          <div className="pt-2 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDeleteRegion(region.id)}
              className="w-full text-xs h-8"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Region
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};