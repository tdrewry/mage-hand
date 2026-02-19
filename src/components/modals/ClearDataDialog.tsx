import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRegionStore } from '@/stores/regionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useGroupStore } from '@/stores/groupStore';
import { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';

interface ClearDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fabricCanvas?: FabricCanvas | null;
}

export const ClearDataDialog: React.FC<ClearDataDialogProps> = ({
  open,
  onOpenChange,
  fabricCanvas,
}) => {
  const [shouldClearTokens, setShouldClearTokens] = useState(false);
  const [shouldClearRegions, setShouldClearRegions] = useState(false);
  const [shouldClearMapObjects, setShouldClearMapObjects] = useState(false);
  const [shouldClearMarkers, setShouldClearMarkers] = useState(false);
  const [shouldClearGroups, setShouldClearGroups] = useState(false);

  const { clearRegions } = useRegionStore();
  const { clearAllTokens } = useSessionStore();
  const { clearTerrainFeatures, clearAnnotations } = useDungeonStore();
  const { clearMapObjects } = useMapObjectStore();
  const { clearAllGroups } = useGroupStore();

  const handleClear = () => {
    const cleared: string[] = [];

    if (shouldClearTokens) {
      if (fabricCanvas) {
        const objects = fabricCanvas.getObjects();
        objects.forEach((obj: any) => {
          if (obj.tokenId || obj.isTokenLabel) {
            fabricCanvas.remove(obj);
          }
        });
        fabricCanvas.renderAll();
      }
      clearAllTokens();
      cleared.push('tokens');
    }

    if (shouldClearRegions) {
      clearRegions();
      cleared.push('regions');
    }

    if (shouldClearMapObjects) {
      clearMapObjects();
      clearTerrainFeatures();
      cleared.push('map objects');
    }

    if (shouldClearMarkers) {
      clearAnnotations();
      cleared.push('markers');
    }

    if (shouldClearGroups) {
      clearAllGroups();
      cleared.push('groups');
    }

    if (cleared.length > 0) {
      toast.success(`Cleared: ${cleared.join(', ')}`);
    }

    // Reset checkboxes and close
    setShouldClearTokens(false);
    setShouldClearRegions(false);
    setShouldClearMapObjects(false);
    setShouldClearMarkers(false);
    setShouldClearGroups(false);
    onOpenChange(false);
  };

  const hasSelection = shouldClearTokens || shouldClearRegions || shouldClearMapObjects || shouldClearMarkers || shouldClearGroups;
  const allSelected = shouldClearTokens && shouldClearRegions && shouldClearMapObjects && shouldClearMarkers && shouldClearGroups;

  const handleSelectAll = (checked: boolean) => {
    setShouldClearTokens(checked);
    setShouldClearRegions(checked);
    setShouldClearMapObjects(checked);
    setShouldClearMarkers(checked);
    setShouldClearGroups(checked);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Clear Data</DialogTitle>
          <DialogDescription>
            Select what you want to clear from the canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-3 pb-2 border-b border-border">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={(checked) => handleSelectAll(checked === true)}
            />
            <Label htmlFor="select-all" className="cursor-pointer font-medium">
              Select All
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="clear-tokens"
              checked={shouldClearTokens}
              onCheckedChange={(checked) => setShouldClearTokens(checked === true)}
            />
            <Label htmlFor="clear-tokens" className="cursor-pointer">
              Tokens
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="clear-regions"
              checked={shouldClearRegions}
              onCheckedChange={(checked) => setShouldClearRegions(checked === true)}
            />
            <Label htmlFor="clear-regions" className="cursor-pointer">
              Regions
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="clear-map-objects"
              checked={shouldClearMapObjects}
              onCheckedChange={(checked) => setShouldClearMapObjects(checked === true)}
            />
            <Label htmlFor="clear-map-objects" className="cursor-pointer">
              Map Objects & Terrain Features
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="clear-markers"
              checked={shouldClearMarkers}
              onCheckedChange={(checked) => setShouldClearMarkers(checked === true)}
            />
            <Label htmlFor="clear-markers" className="cursor-pointer">
              Markers
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="clear-groups"
              checked={shouldClearGroups}
              onCheckedChange={(checked) => setShouldClearGroups(checked === true)}
            />
            <Label htmlFor="clear-groups" className="cursor-pointer">
              Groups
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={!hasSelection}
          >
            Clear Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
