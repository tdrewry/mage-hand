import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Grid3X3, Hexagon, MousePointer } from 'lucide-react';
import { GridType } from './VirtualTabletop';

interface GridControlsProps {
  gridType: GridType;
  gridSize: number;
  isGridVisible: boolean;
  onGridTypeChange: (type: GridType) => void;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityChange: (visible: boolean) => void;
}

export const GridControls = ({
  gridType,
  gridSize,
  isGridVisible,
  onGridTypeChange,
  onGridSizeChange,
  onGridVisibilityChange,
}: GridControlsProps) => {
  return (
    <Card className="m-4 bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground">Grid Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grid Type Selection */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Grid Type</Label>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant={gridType === 'square' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGridTypeChange('square')}
              className="text-xs"
            >
              <Grid3X3 className="h-3 w-3" />
            </Button>
            <Button
              variant={gridType === 'hex' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGridTypeChange('hex')}
              className="text-xs"
            >
              <Hexagon className="h-3 w-3" />
            </Button>
            <Button
              variant={gridType === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGridTypeChange('none')}
              className="text-xs"
            >
              <MousePointer className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Grid Size */}
        {gridType !== 'none' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Grid Size: {gridSize}px
            </Label>
            <Slider
              value={[gridSize]}
              onValueChange={(value) => onGridSizeChange(value[0])}
              min={20}
              max={100}
              step={10}
              className="w-full"
            />
          </div>
        )}

        {/* Grid Visibility */}
        {gridType !== 'none' && (
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Show Grid</Label>
            <Switch
              checked={isGridVisible}
              onCheckedChange={onGridVisibilityChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};