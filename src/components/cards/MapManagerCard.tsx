import React, { useState } from 'react';
import { useMapStore, type GameMap } from '@/stores/mapStore';
import { MapFocusSettings } from '@/components/MapFocusSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Layers,
  MousePointer2,
  ArrowUp,
  ArrowDown,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { MapImageImportModal, type MapImageImportResult } from '@/components/modals/MapImageImportModal';
import { useRegionStore } from '@/stores/regionStore';
import { WatabouImportCardContent } from '@/components/cards/WatabouImportCard';

export const MapManagerCardContent = () => {
  const {
    maps,
    selectedMapId,
    addMap,
    updateMap,
    removeMap,
    setSelectedMap,
    reorderMaps,
    addRegion,
    updateRegion,
    removeRegion,
  } = useMapStore();

  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set([selectedMapId || '']));
  const [newMapName, setNewMapName] = useState('');
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const [vttImportOpen, setVttImportOpen] = useState(false);
  const [compoundName, setCompoundName] = useState('');
  const [compoundSelectMode, setCompoundSelectMode] = useState(false);
  const [compoundSelectedIds, setCompoundSelectedIds] = useState<Set<string>>(new Set());

  const selectedMap = maps.find(m => m.id === selectedMapId);

  const toggleMapExpanded = (mapId: string) => {
    setExpandedMaps(prev => {
      const next = new Set(prev);
      next.has(mapId) ? next.delete(mapId) : next.add(mapId);
      return next;
    });
  };

  // ── Add blank map ──
  const handleAddBlankMap = () => {
    const name = newMapName.trim() || `Map ${maps.length + 1}`;
    addMap({
      name,
      bounds: { x: 0, y: 0, width: 1600, height: 1200 },
      backgroundColor: '#2a2a2a',
      active: true,
      zIndex: maps.length,
      regions: [{
        name: 'Main Region',
        points: [
          { x: 0, y: 0 },
          { x: 1600, y: 0 },
          { x: 1600, y: 1200 },
          { x: 0, y: 1200 },
        ],
        gridType: 'square' as const,
        gridSize: 40,
        gridColor: '#ffffff',
        gridOpacity: 80,
        visible: true,
      }],
    });
    setNewMapName('');
    toast.success(`Map "${name}" created`);
  };

  // ── Add map from image ──
  const handleImageImportConfirm = (result: MapImageImportResult) => {
    const scaledW = Math.round(result.naturalWidth * result.imageScale);
    const scaledH = Math.round(result.naturalHeight * result.imageScale);
    const mapCountBefore = useMapStore.getState().maps.length;
    addMap({
      name: result.mapName,
      imageUrl: result.imageUrl,
      imageScale: result.imageScale,
      imageOffsetX: result.imageOffsetX,
      imageOffsetY: result.imageOffsetY,
      bounds: { x: 0, y: 0, width: scaledW, height: scaledH },
      backgroundColor: '#2a2a2a',
      active: true,
      zIndex: maps.length,
      regions: [{
        name: 'Full Map',
        points: [
          { x: 0, y: 0 },
          { x: scaledW, y: 0 },
          { x: scaledW, y: scaledH },
          { x: 0, y: scaledH },
        ],
        gridType: 'square' as const,
        gridSize: result.gridSize,
        gridColor: '#ffffff',
        gridOpacity: 80,
        visible: true,
      }],
    });

    // Create a CanvasRegion in regionStore with the image as background texture
    const newMaps = useMapStore.getState().maps;
    const newMap = newMaps.length > mapCountBefore ? newMaps[newMaps.length - 1] : null;
    if (newMap) {
      useRegionStore.getState().addRegion({
        x: 0,
        y: 0,
        width: scaledW,
        height: scaledH,
        selected: false,
        color: '#2a2a2a',
        gridType: 'square',
        gridSize: result.gridSize,
        gridScale: 1,
        gridSnapping: true,
        gridVisible: true,
        backgroundImage: result.imageUrl,
        backgroundRepeat: 'no-repeat',
        backgroundScale: result.imageScale,
        backgroundOffsetX: result.imageOffsetX,
        backgroundOffsetY: result.imageOffsetY,
        regionType: 'rectangle',
        mapId: newMap.id,
      });
    }

    toast.success(`Map "${result.mapName}" created from image`);
  };

  // ── Remove map ──
  const handleRemoveMap = (mapId: string) => {
    if (maps.length <= 1) {
      toast.error('Cannot remove the last map');
      return;
    }
    removeMap(mapId);
    toast.success('Map removed');
  };

  // ── Reorder ──
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    reorderMaps(index, index - 1);
  };
  const handleMoveDown = (index: number) => {
    if (index >= maps.length - 1) return;
    reorderMaps(index, index + 1);
  };

  // ── Compound map ──
  const handleSaveCompound = () => {
    if (compoundSelectedIds.size < 2) {
      toast.error('Select at least 2 maps for a compound map');
      return;
    }
    const name = compoundName.trim() || 'Compound Map';
    const compoundId = `compound-${Date.now()}`;
    compoundSelectedIds.forEach((id) => {
      updateMap(id, { compoundMapId: compoundId });
    });
    toast.success(`Saved "${name}" as compound map (${compoundSelectedIds.size} maps)`);
    setCompoundSelectMode(false);
    setCompoundSelectedIds(new Set());
    setCompoundName('');
  };

  // Helper: grid dimensions for a map
  const getGridInfo = (map: GameMap) => {
    const firstRegion = map.regions[0];
    if (!firstRegion || firstRegion.gridType === 'none') return null;
    const cols = Math.round(map.bounds.width / firstRegion.gridSize);
    const rows = Math.round(map.bounds.height / firstRegion.gridSize);
    return { cols, rows, gridSize: firstRegion.gridSize };
  };

  return (
    <div className="flex flex-col h-full w-full gap-3">
      {/* ── Locked Top Controls ── */}
      <div className="shrink-0 space-y-3">
        {/* ── Actions row ── */}
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleAddBlankMap}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Blank Map
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImageImportOpen(true)}>
            <ImagePlus className="h-3.5 w-3.5 mr-1" /> From Image
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVttImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Import VTT
          </Button>
          <Button
            variant={compoundSelectMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setCompoundSelectMode(!compoundSelectMode);
              setCompoundSelectedIds(new Set());
            }}
          >
            <Layers className="h-3.5 w-3.5 mr-1" /> Compound
          </Button>
        </div>

        {/* Optional name input for blank maps */}
        {!compoundSelectMode && (
          <Input
            value={newMapName}
            onChange={(e) => setNewMapName(e.target.value)}
            placeholder="New map name (optional)"
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleAddBlankMap()}
          />
        )}

        {/* Compound mode controls */}
        {compoundSelectMode && (
          <div className="p-2 border rounded-md border-primary/40 bg-primary/5 space-y-2">
            <Label className="text-xs font-medium">Select maps for compound:</Label>
            <Input
              value={compoundName}
              onChange={(e) => setCompoundName(e.target.value)}
              placeholder="Compound map name"
              className="h-7 text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveCompound} disabled={compoundSelectedIds.size < 2}>
                Save Compound ({compoundSelectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCompoundSelectMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Scrolling Maps List & Focus Settings ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-4">
        {/* ── Maps list ── */}
        <div className="space-y-1.5">
          {maps.map((map, index) => {
          const isSelected = selectedMapId === map.id;
          const gridInfo = getGridInfo(map);
          const isCompoundSelected = compoundSelectedIds.has(map.id);

          return (
            <div
              key={map.id}
              className={`border rounded-lg p-2 space-y-1.5 transition-colors ${
                isSelected ? 'border-primary/60 bg-primary/5' : 'border-border'
              } ${isCompoundSelected ? 'ring-2 ring-primary/40' : ''}`}
            >
              {/* Header row */}
              <div className="flex items-center gap-1.5">
                {/* Drag handle / reorder arrows */}
                <div className="flex flex-col gap-0">
                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleMoveDown(index)} disabled={index >= maps.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                {/* Compound checkbox */}
                {compoundSelectMode && (
                  <input
                    type="checkbox"
                    checked={isCompoundSelected}
                    onChange={() => {
                      setCompoundSelectedIds(prev => {
                        const next = new Set(prev);
                        next.has(map.id) ? next.delete(map.id) : next.add(map.id);
                        return next;
                      });
                    }}
                    className="h-4 w-4"
                  />
                )}

                {/* Expand toggle */}
                <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => toggleMapExpanded(map.id)}>
                  {expandedMaps.has(map.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>

                {/* Map name */}
                <Input
                  value={map.name}
                  onChange={(e) => updateMap(map.id, { name: e.target.value })}
                  className="h-7 text-xs font-medium flex-1"
                />

                {/* Active/Inactive toggle */}
                <div className="flex items-center gap-1" title={map.active ? 'Active — rendered on canvas' : 'Inactive — hidden'}>
                  <Switch
                    checked={map.active}
                    onCheckedChange={(checked) => updateMap(map.id, { active: checked })}
                    className="scale-75"
                  />
                </div>

                {/* Select as focus */}
                <Button
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  className="p-1 h-auto"
                  onClick={() => setSelectedMap(map.id)}
                  title="Set as focused map"
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                </Button>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto text-destructive hover:text-destructive"
                  onClick={() => handleRemoveMap(map.id)}
                  disabled={maps.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Badges row */}
              <div className="flex gap-1 flex-wrap pl-7">
                {map.active && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Active</Badge>}
                {map.compoundMapId && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Compound</Badge>}
                {map.imageUrl && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Image</Badge>}
                {gridInfo && (
                  <span className="text-[10px] text-muted-foreground">
                    {map.bounds.width}×{map.bounds.height}px · {gridInfo.cols}×{gridInfo.rows} cells
                  </span>
                )}
              </div>

              {/* Expanded details */}
              <Collapsible open={expandedMaps.has(map.id)}>
                <CollapsibleContent className="space-y-2 pl-7 pt-1">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px]">Width (px)</Label>
                      <Input
                        type="number"
                        value={map.bounds.width}
                        onChange={(e) => updateMap(map.id, { bounds: { ...map.bounds, width: parseInt(e.target.value) || 0 } })}
                        className="h-6 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Height (px)</Label>
                      <Input
                        type="number"
                        value={map.bounds.height}
                        onChange={(e) => updateMap(map.id, { bounds: { ...map.bounds, height: parseInt(e.target.value) || 0 } })}
                        className="h-6 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Background Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="color"
                        value={map.backgroundColor}
                        onChange={(e) => updateMap(map.id, { backgroundColor: e.target.value })}
                        className="h-6 w-10 p-0 border-0"
                      />
                      <span className="text-[10px] text-muted-foreground">{map.backgroundColor}</span>
                    </div>
                  </div>
                  {/* Regions summary */}
                  <div className="text-[10px] text-muted-foreground">
                    {map.regions.length} region{map.regions.length !== 1 ? 's' : ''} ·{' '}
                    z-index: {map.zIndex}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
        </div>

        {/* Map Focus Settings */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <MapFocusSettings />
        </div>
      </div>

      {/* Map Image Import Modal */}
      <MapImageImportModal
        open={imageImportOpen}
        onOpenChange={setImageImportOpen}
        onConfirm={handleImageImportConfirm}
      />

      {/* VTT/Watabou Import Modal */}
      <Dialog open={vttImportOpen} onOpenChange={setVttImportOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Map Data</DialogTitle>
            <DialogDescription>
              Import Watabou json, Dungeondraft dd2vtt, or d20prefab files.
            </DialogDescription>
          </DialogHeader>
          <WatabouImportCardContent />
        </DialogContent>
      </Dialog>
    </div>
  );
};
