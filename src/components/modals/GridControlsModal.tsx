import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grid3X3 } from 'lucide-react';

interface GridControlsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gridType: string;
  gridSize: number;
  isGridVisible: boolean;
  onGridTypeChange: (type: any) => void;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityChange: (visible: boolean) => void;
}

export const GridControlsModal = ({
  open,
  onOpenChange,
  gridType,
  gridSize,
  isGridVisible,
  onGridTypeChange,
  onGridSizeChange,
  onGridVisibilityChange,
}: GridControlsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Grid Controls
          </DialogTitle>
          <DialogDescription>
            Configure the grid system for your tabletop
          </DialogDescription>
        </DialogHeader>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="grid-visible" className="text-sm font-medium">
                  Show Grid
                </Label>
                <Switch
                  id="grid-visible"
                  checked={isGridVisible}
                  onCheckedChange={onGridVisibilityChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grid-type" className="text-sm font-medium">
                  Grid Type
                </Label>
                <Select value={gridType} onValueChange={onGridTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square Grid</SelectItem>
                    <SelectItem value="hex">Hexagonal Grid</SelectItem>
                    <SelectItem value="none">No Grid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grid-size" className="text-sm font-medium">
                  Grid Size: {gridSize}px
                </Label>
                <Input
                  id="grid-size"
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={gridSize}
                  onChange={(e) => onGridSizeChange(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>20px</span>
                  <span>100px</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Grid settings apply when moving tokens or drawing on the map.
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};