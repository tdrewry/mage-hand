import { useState, useMemo } from 'react';
import {
  Circle, Square, Move, Trash2, Eye, EyeOff, SunMedium, Moon,
  DoorOpen, DoorClosed, Waypoints, Link2, Link2Off, Lock, Unlock,
  Copy, Image, ChevronUp, ChevronDown, Mountain, Armchair,
  Lamp, Search, X, Filter, Layers, Plus, AlertTriangle,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useMapStore } from '@/stores/mapStore';
import {
  MapObject, MapObjectCategory,
  MAP_OBJECT_CATEGORY_LABELS, MAP_OBJECT_CATEGORY_GROUPS,
  DOOR_TYPE_STYLES,
} from '@/types/mapObjectTypes';
import type { IlluminationSource } from '@/types/illumination';
import { DEFAULT_ILLUMINATION } from '@/types/illumination';
import { TokenIlluminationModal } from '@/components/modals/TokenIlluminationModal';
import { mapObjectToIlluminationSource } from '@/lib/lightMapObjectUtils';
import { ILLUMINATION_PRESETS, type PresetKey } from '@/lib/illuminationPresets';
import { CardSaveButton } from './CardSaveButton';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const GROUP_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Mountain, Armchair, DoorOpen, Waypoints, Lamp,
};

function CategoryDot({ obj }: { obj: MapObject }) {
  const color = obj.fillColor?.startsWith('rgba') ? obj.strokeColor : obj.fillColor;
  return (
    <span
      className="w-2.5 h-2.5 rounded-full border border-white/20 flex-shrink-0"
      style={{ backgroundColor: color || '#6b7280' }}
    />
  );
}

function ObjectIcon({ obj }: { obj: MapObject }) {
  if (obj.category === 'door') {
    return obj.isOpen
      ? <DoorOpen className="w-3 h-3 text-green-500 flex-shrink-0" />
      : <DoorClosed className="w-3 h-3 text-red-500 flex-shrink-0" />;
  }
  if (obj.category === 'portal') {
    return <Waypoints className="w-3 h-3 flex-shrink-0" style={{ color: obj.strokeColor || '#8b5cf6' }} />;
  }
  if (obj.category === 'annotation') {
    return (
      <span className="w-3 h-3 rounded-full text-[8px] font-bold flex items-center justify-center flex-shrink-0"
        style={{ background: obj.fillColor || '#3b82f6', color: '#fff' }}>
        {obj.annotationReference?.slice(0, 1) || '!'}
      </span>
    );
  }
  if (obj.category === 'deployment-zone') return <Layers className="w-3 h-3 text-green-500 flex-shrink-0" />;
  if (obj.category === 'light') return <Lamp className="w-3 h-3 text-amber-400 flex-shrink-0" />;
  if (obj.category === 'wall') return <Square className="w-3 h-3 text-red-400 flex-shrink-0" />;
  if (obj.shape === 'circle') return <Circle className="w-3 h-3 flex-shrink-0" style={{ color: obj.fillColor || '#6b7280' }} />;
  return <Square className="w-3 h-3 flex-shrink-0" style={{ color: obj.fillColor || '#6b7280' }} />;
}

// ─── Create Tab ───────────────────────────────────────────────────────────────

function CreateTab({ onCreate }: { onCreate: (id: string) => void }) {
  const createFromPresetAtCenter = useMapObjectStore(s => s.createFromPresetAtCenter);
  const selectMapObject = useMapObjectStore(s => s.selectMapObject);

  const handleCreate = (category: MapObjectCategory) => {
    const id = createFromPresetAtCenter(category);
    selectMapObject(id);
    onCreate(id);
  };

  const wallNote = 'Wall objects are free-drawn on canvas. Use the Wall tool in the toolbar.';

  return (
    <div className="p-3 space-y-3">
      {MAP_OBJECT_CATEGORY_GROUPS.map(group => {
        const Icon = GROUP_ICONS[group.icon] ?? Square;
        return (
          <div key={group.label} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {group.categories.map(cat => {
                const isWall = cat === 'wall';
                return (
                  <Tooltip key={cat}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 px-1.5 justify-start gap-1.5 font-normal"
                        disabled={isWall}
                        onClick={() => !isWall && handleCreate(cat)}
                      >
                        <Plus className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{MAP_OBJECT_CATEGORY_LABELS[cat]}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{isWall ? wallNote : `Add ${MAP_OBJECT_CATEGORY_LABELS[cat]}`}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-1 p-2 rounded-md bg-muted/40 flex gap-2">
        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-snug">
          Doors, walls, and imported obstacles are typically created via the Watabou map importer.
          Manual wall placement uses the Wall draw tool in the toolbar.
        </p>
      </div>
    </div>
  );
}

// ─── Objects Tab ──────────────────────────────────────────────────────────────

function ObjectsTab({ onSelect }: { onSelect: (id: string) => void }) {
  const mapObjects = useMapObjectStore(s => s.mapObjects);
  const selectedMapObjectIds = useMapObjectStore(s => s.selectedMapObjectIds);
  const selectMapObject = useMapObjectStore(s => s.selectMapObject);
  const selectMultiple = useMapObjectStore(s => s.selectMultiple);
  const removeMultipleMapObjects = useMapObjectStore(s => s.removeMultipleMapObjects);
  const toggleDoor = useMapObjectStore(s => s.toggleDoor);
  const closeAllDoors = useMapObjectStore(s => s.closeAllDoors);
  const maps = useMapStore(s => s.maps);
  const activeMapId = useMapStore(s => s.selectedMapId);

  const [search, setSearch] = useState('');
  const [mapFilter, setMapFilter] = useState<string>('__all__');
  const [catFilter, setCatFilter] = useState<MapObjectCategory | '__all__'>('__all__');

  const filtered = useMemo(() => {
    return mapObjects.filter(obj => {
      if (mapFilter !== '__all__' && obj.mapId !== mapFilter) return false;
      if (catFilter !== '__all__' && obj.category !== catFilter) return false;
      if (search) {
        const label = (obj.label || MAP_OBJECT_CATEGORY_LABELS[obj.category] || '').toLowerCase();
        if (!label.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [mapObjects, mapFilter, catFilter, search]);

  const doorCount = mapObjects.filter(o => o.category === 'door').length;
  const openDoorCount = mapObjects.filter(o => o.category === 'door' && o.isOpen).length;

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    selectMapObject(id, e.shiftKey || e.ctrlKey || e.metaKey);
    onSelect(id);
  };

  const handleDeleteSelected = () => {
    if (selectedMapObjectIds.length > 0) {
      removeMultipleMapObjects(selectedMapObjectIds);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search objects…"
          className="h-7 text-xs pl-7 pr-6"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        <Select value={mapFilter} onValueChange={setMapFilter}>
          <SelectTrigger className="h-6 text-[10px] flex-1">
            <SelectValue placeholder="Map…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Maps</SelectItem>
            {maps.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || `Map ${m.id.slice(-4)}`}
                {m.id === activeMapId ? ' ★' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={catFilter} onValueChange={v => setCatFilter(v as any)}>
          <SelectTrigger className="h-6 text-[10px] flex-1">
            <Filter className="w-2.5 h-2.5 mr-1" />
            <SelectValue placeholder="Type…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Types</SelectItem>
            {(Object.keys(MAP_OBJECT_CATEGORY_LABELS) as MapObjectCategory[]).map(cat => (
              <SelectItem key={cat} value={cat}>{MAP_OBJECT_CATEGORY_LABELS[cat]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Batch actions */}
      {selectedMapObjectIds.length > 1 && (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1"
            onClick={() => selectMultiple([])}>
            Clear ({selectedMapObjectIds.length})
          </Button>
          <Button variant="destructive" size="sm" className="h-6 text-[10px] flex-1"
            onClick={handleDeleteSelected}>
            <Trash2 className="w-2.5 h-2.5 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Door batch */}
      {doorCount > 0 && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40 rounded-md">
          <span className="text-[10px] text-muted-foreground">
            {openDoorCount}/{doorCount} doors open
          </span>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2"
            onClick={closeAllDoors}>
            Close All
          </Button>
        </div>
      )}

      {/* Object list */}
      <div className="text-[10px] text-muted-foreground px-0.5">
        {filtered.length} object{filtered.length !== 1 ? 's' : ''}
        {search || mapFilter !== '__all__' || catFilter !== '__all__' ? ' (filtered)' : ''}
      </div>

      <ScrollArea className="h-52">
        <div className="space-y-0.5 pr-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No objects match filters</p>
          ) : (
            filtered.map(obj => {
              const isSelected = selectedMapObjectIds.includes(obj.id);
              const mapName = maps.find(m => m.id === obj.mapId)?.name;
              return (
                <button
                  key={obj.id}
                  onClick={e => handleRowClick(obj.id, e)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors
                    ${isSelected
                      ? 'bg-primary/15 border border-primary/30'
                      : 'hover:bg-muted/60 border border-transparent'
                    }
                    ${obj.locked ? 'opacity-50' : ''}
                  `}
                >
                  <ObjectIcon obj={obj} />
                  <span className="flex-1 truncate">
                    {obj.label || MAP_OBJECT_CATEGORY_LABELS[obj.category]}
                  </span>
                  {/* Category badges */}
                  {obj.category === 'door' && (
                    <Badge variant={obj.isOpen ? 'default' : 'secondary'}
                      className="text-[9px] px-1 py-0 h-4">
                      {obj.isOpen ? 'open' : 'closed'}
                    </Badge>
                  )}
                  {obj.locked && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
                  {mapName && maps.length > 1 && (
                    <span className="text-[9px] text-muted-foreground truncate max-w-[50px]">{mapName}</span>
                  )}
                  {/* Quick door toggle */}
                  {obj.category === 'door' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={e => { e.stopPropagation(); toggleDoor(obj.id); }}
                          className="ml-1 p-0.5 rounded hover:bg-muted"
                        >
                          {obj.isOpen
                            ? <DoorClosed className="w-3 h-3 text-muted-foreground" />
                            : <DoorOpen className="w-3 h-3 text-muted-foreground" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{obj.isOpen ? 'Close door' : 'Open door'}</TooltipContent>
                    </Tooltip>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Selected Tab ─────────────────────────────────────────────────────────────

function SelectedTab() {
  const mapObjects = useMapObjectStore(s => s.mapObjects);
  const selectedMapObjectIds = useMapObjectStore(s => s.selectedMapObjectIds);
  const updateMapObject = useMapObjectStore(s => s.updateMapObject);
  const updateMultipleMapObjects = useMapObjectStore(s => s.updateMultipleMapObjects);
  const removeMultipleMapObjects = useMapObjectStore(s => s.removeMultipleMapObjects);
  const addMapObject = useMapObjectStore(s => s.addMapObject);
  const clearSelection = useMapObjectStore(s => s.clearSelection);
  const toggleDoor = useMapObjectStore(s => s.toggleDoor);
  const reorderMapObject = useMapObjectStore(s => s.reorderMapObject);
  const maps = useMapStore(s => s.maps);

  const selectedObjects = mapObjects.filter(o => selectedMapObjectIds.includes(o.id));
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isMulti = selectedObjects.length > 1;
  const allPortals = mapObjects.filter(o => o.category === 'portal');

  const handleBulkUpdate = (updates: Partial<MapObject>) => {
    if (selectedMapObjectIds.length > 0) updateMultipleMapObjects(selectedMapObjectIds, updates);
  };

  const handleDuplicate = () => {
    if (!single) return;
    const { id, ...rest } = single;
    addMapObject({ ...rest, position: { x: single.position.x + 30, y: single.position.y + 30 }, selected: false });
  };

  const [showIlluminationModal, setShowIlluminationModal] = useState(false);

  if (selectedObjects.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
        <Eye className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Select a map object on the canvas<br />or from the Objects tab</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          {single ? (
            <div className="flex items-center gap-2 min-w-0">
              <ObjectIcon obj={single} />
              <span className="text-xs font-medium truncate">
                {single.label || MAP_OBJECT_CATEGORY_LABELS[single.category]}
              </span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {MAP_OBJECT_CATEGORY_LABELS[single.category]}
              </Badge>
            </div>
          ) : (
            <span className="text-xs font-medium">{selectedObjects.length} objects selected</span>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={clearSelection}>
            Desel.
          </Button>
        </div>

        {/* Label (single only) */}
        {single && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Label</Label>
            <Input
              value={single.label || ''}
              onChange={e => updateMapObject(single.id, { label: e.target.value })}
              placeholder="Object label…"
              className="h-7 text-xs"
            />
          </div>
        )}

        {/* ── Door Controls ─────────────────────────────────────── */}
        {single?.category === 'door' && (
          <>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {single.isOpen
                  ? <DoorOpen className="w-4 h-4 text-green-500" />
                  : <DoorClosed className="w-4 h-4 text-red-500" />}
                <span className="text-xs font-medium">{single.isOpen ? 'Open' : 'Closed'}</span>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => toggleDoor(single.id)}>
                {single.isOpen ? 'Close' : 'Open'}
              </Button>
            </div>
            {single.doorType !== undefined && (
              <p className="text-[10px] text-muted-foreground">
                Type: {DOOR_TYPE_STYLES[single.doorType]?.label ?? 'Unknown'}
              </p>
            )}
            <Separator />
          </>
        )}

        {/* ── Portal Controls ───────────────────────────────────── */}
        {single?.category === 'portal' && (
          <>
            <div className="space-y-2 p-2 bg-purple-500/5 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Waypoints className="w-3 h-3 text-purple-400" />
                <span className="text-xs font-medium text-purple-400">Portal</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Name</Label>
                <Input
                  value={single.portalName || ''}
                  onChange={e => updateMapObject(single.id, { portalName: e.target.value })}
                  placeholder="Portal name…"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Link to</Label>
                <Select
                  value={single.portalTargetId ?? '__none__'}
                  onValueChange={v => updateMapObject(single.id, { portalTargetId: v === '__none__' ? undefined : v })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select target…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="flex items-center gap-1.5"><Link2Off className="w-3 h-3" />No link</span>
                    </SelectItem>
                    {allPortals.filter(p => p.id !== single.id).map(p => {
                      const pm = maps.find(m => m.id === p.mapId);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-1.5">
                            <Link2 className="w-3 h-3" />
                            {p.portalName || 'Unnamed'}
                            {pm ? ` (${pm.name})` : ''}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {single.portalTargetId && (
                  <p className="text-[10px] text-green-600">✓ Linked — tokens teleport on drop</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] flex items-center gap-1"><EyeOff className="w-2.5 h-2.5" />Hidden in Play</Label>
                  <Switch
                    checked={single.portalHiddenInPlay ?? false}
                    onCheckedChange={v => updateMapObject(single.id, { portalHiddenInPlay: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] flex items-center gap-1"><Eye className="w-2.5 h-2.5" />Auto-activate Map</Label>
                  <Switch
                    checked={single.portalAutoActivateTarget ?? false}
                    onCheckedChange={v => updateMapObject(single.id, { portalAutoActivateTarget: v })}
                  />
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* ── Annotation Controls ───────────────────────────────── */}
        {single?.category === 'annotation' && (
          <>
            <div className="space-y-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <span className="text-xs font-medium text-blue-400">Annotation</span>
              <div className="space-y-1">
                <Label className="text-[10px]">Badge Reference</Label>
                <Input
                  value={single.annotationReference || ''}
                  onChange={e => updateMapObject(single.id, { annotationReference: e.target.value })}
                  placeholder="e.g. 1, A, ★"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Description Text</Label>
                <Textarea
                  value={single.annotationText || ''}
                  onChange={e => updateMapObject(single.id, { annotationText: e.target.value })}
                  placeholder="Annotation details shown on hover…"
                  className="text-xs min-h-[60px] resize-none"
                />
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* ── Deployment Zone Controls ──────────────────────────── */}
        {single?.category === 'deployment-zone' && (
          <>
            <div className="space-y-2 p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-green-400">Deployment Zone</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Zone Label</Label>
                <Input
                  value={single.deploymentZoneLabel || ''}
                  onChange={e => updateMapObject(single.id, { deploymentZoneLabel: e.target.value })}
                  placeholder="e.g. Party Start, Reinforcements"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Token Group</Label>
                <Input
                  value={single.deploymentZoneGroup || ''}
                  onChange={e => updateMapObject(single.id, { deploymentZoneGroup: e.target.value })}
                  placeholder="Role or token group name…"
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* ── Light Controls ────────────────────────────────────── */}
        {single?.category === 'light' && (
          <>
            <div className="space-y-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lamp className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Light Source</span>
                </div>
                <Switch
                  checked={(single.illuminationSource?.enabled ?? single.lightEnabled) !== false}
                  onCheckedChange={v => {
                    updateMapObject(single.id, {
                      illuminationSource: single.illuminationSource
                        ? { ...single.illuminationSource, enabled: v }
                        : undefined,
                      lightEnabled: v,
                    });
                    window.dispatchEvent(new CustomEvent('fog:force-refresh'));
                  }}
                />
              </div>

              {/* Preset summary */}
              {(() => {
                const src = single.illuminationSource;
                if (!src) return (
                  <p className="text-[10px] text-muted-foreground">
                    No preset — using legacy settings.
                  </p>
                );
                // Try to match a known preset name for display
                const presetEntry = Object.entries(ILLUMINATION_PRESETS).find(
                  ([, p]) => p.animation === src.animation && Math.abs(p.range - src.range) < 0.5
                );
                const presetLabel = presetEntry
                  ? `${ILLUMINATION_PRESETS[presetEntry[0] as PresetKey].icon} ${ILLUMINATION_PRESETS[presetEntry[0] as PresetKey].name}`
                  : '⚙️ Custom';
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {presetLabel} · Range {src.range} units
                    </span>
                  </div>
                );
              })()}

              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs mt-1"
                onClick={() => setShowIlluminationModal(true)}
              >
                <Lamp className="w-3 h-3 mr-1.5" />
                Edit Light Settings…
              </Button>
            </div>

            {/* Illumination preset modal — same as token illumination */}
            <TokenIlluminationModal
              open={showIlluminationModal}
              onOpenChange={setShowIlluminationModal}
              tokenIds={[single.id]}
              currentIllumination={
                single.illuminationSource
                  ? single.illuminationSource
                  : mapObjectToIlluminationSource(single)
              }
              onApply={(settings: Partial<IlluminationSource>) => {
                const existing = single.illuminationSource
                  ? single.illuminationSource
                  : mapObjectToIlluminationSource(single);
                updateMapObject(single.id, {
                  illuminationSource: {
                    ...existing,
                    ...settings,
                    id: `mo-light-${single.id}`,
                    name: single.label || single.illuminationSource?.name || 'Light Source',
                    position: single.position,
                    enabled: existing.enabled,
                  } as IlluminationSource,
                  // Keep legacy enabled flag in sync
                  lightEnabled: existing.enabled,
                });
                window.dispatchEvent(new CustomEvent('fog:force-refresh'));
              }}
            />
            <Separator />
          </>
        )}

        {/* ── Transform (single, non-wall) ──────────────────────── */}
        {single && single.category !== 'door' && single.shape !== 'wall' && (
          <>
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">Transform</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[10px]">W</Label>
                  <NumericInput value={single.width}
                    onChange={v => updateMapObject(single.id, { width: v })}
                    className="h-7 text-xs" min={1} />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px]">H</Label>
                  <NumericInput value={single.height}
                    onChange={v => updateMapObject(single.id, { height: v })}
                    className="h-7 text-xs" min={1} />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px]">Rot°</Label>
                  <NumericInput value={single.rotation ?? 0}
                    onChange={v => updateMapObject(single.id, { rotation: v })}
                    className="h-7 text-xs" min={0} max={360} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Appearance ────────────────────────────────────────── */}
        {single && single.category !== 'annotation' && (
          <>
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">Appearance</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[10px]">Fill</Label>
                  <Input type="color" value={single.fillColor}
                    onChange={e => updateMapObject(single.id, { fillColor: e.target.value })}
                    className="h-7 w-full cursor-pointer" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px]">Stroke</Label>
                  <Input type="color" value={single.strokeColor}
                    onChange={e => updateMapObject(single.id, { strokeColor: e.target.value })}
                    className="h-7 w-full cursor-pointer" />
                </div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Opacity ({Math.round((single.opacity ?? 1) * 100)}%)</Label>
                <Slider value={[(single.opacity ?? 1) * 100]}
                  onValueChange={([v]) => updateMapObject(single.id, { opacity: v / 100 })}
                  min={0} max={100} step={5} />
              </div>
            </div>
          </>
        )}

        {/* Multi-select: Appearance header */}
        {isMulti && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Bulk Appearance</Label>
            <div className="grid grid-cols-2 gap-1">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Fill</Label>
                <Input type="color" defaultValue="#6b7280"
                  onChange={e => handleBulkUpdate({ fillColor: e.target.value })}
                  className="h-7 w-full cursor-pointer" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Stroke</Label>
                <Input type="color" defaultValue="#4b5563"
                  onChange={e => handleBulkUpdate({ strokeColor: e.target.value })}
                  className="h-7 w-full cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* ── Behavior ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground">Behavior</Label>
          {[
            { label: 'Blocks Vision', icon: EyeOff, key: 'blocksVision' as const },
            { label: 'Blocks Movement', icon: Move, key: 'blocksMovement' as const },
            { label: 'Casts Shadow', icon: Moon, key: 'castsShadow' as const },
            { label: 'Revealed by Light', icon: SunMedium, key: 'revealedByLight' as const },
          ].map(({ label, icon: Icon, key }) => {
            const val = single ? (single[key] as boolean) : selectedObjects.every(o => o[key]);
            return (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <Icon className="w-3 h-3" />{label}
                </Label>
                <Switch checked={!!val}
                  onCheckedChange={v => single ? updateMapObject(single.id, { [key]: v }) : handleBulkUpdate({ [key]: v })} />
              </div>
            );
          })}
        </div>

        {/* ── Lock ──────────────────────────────────────────────── */}
        {single && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                {single.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {single.locked ? 'Locked' : 'Unlocked'}
              </Label>
              <Switch checked={!!single.locked}
                onCheckedChange={v => updateMapObject(single.id, { locked: v })} />
            </div>
          </>
        )}

        {/* ── Z-Order ───────────────────────────────────────────── */}
        {single && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Z-Order</Label>
              <div className="flex items-center gap-1.5">
                <NumericInput
                  value={single.renderOrder ?? 50}
                  onChange={v => reorderMapObject(single.id, v)}
                  className="h-7 text-xs flex-1"
                  min={0} max={9999}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2"
                      onClick={() => reorderMapObject(single.id, 1000)}>
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Move to front</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2"
                      onClick={() => reorderMapObject(single.id, 0)}>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Move to back</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[10px] text-muted-foreground">Lower = drawn first/behind</p>
            </div>
          </>
        )}

        {/* ── Save / Sync ───────────────────────────────────────── */}
        {single && (
          <>
            <Separator />
            <CardSaveButton
              context={{ type: 'map-object', id: single.id }}
              onSave={() => { }}
            />
          </>
        )}

        {/* ── Actions ───────────────────────────────────────────── */}
        <Separator />
        <div className="flex gap-1.5">
          {single && (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs"
              onClick={handleDuplicate}>
              <Copy className="w-3 h-3 mr-1" />Dup.
            </Button>
          )}
          <Button variant="destructive" size="sm" className="flex-1 h-7 text-xs"
            onClick={() => removeMultipleMapObjects(selectedMapObjectIds)}
            disabled={selectedObjects.some(o => o.locked)}>
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        </div>

      </div>
    </ScrollArea>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export const MapObjectPanelCardContent = () => {
  const mapObjects = useMapObjectStore(s => s.mapObjects);
  const selectedMapObjectIds = useMapObjectStore(s => s.selectedMapObjectIds);
  const [activeTab, setActiveTab] = useState<'create' | 'objects' | 'selected'>('objects');

  const handleCreated = (_id: string) => {
    setActiveTab('selected');
  };

  const handleObjectSelected = (_id: string) => {
    setActiveTab('selected');
  };

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex flex-col h-full">
      <div className="px-3 pt-2 pb-0">
        <TabsList className="w-full h-7 grid grid-cols-3">
          <TabsTrigger value="create" className="text-[10px] h-6">
            <Plus className="w-2.5 h-2.5 mr-1" />Create
          </TabsTrigger>
          <TabsTrigger value="objects" className="text-[10px] h-6">
            <Layers className="w-2.5 h-2.5 mr-1" />
            Objects
            {mapObjects.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">
                {mapObjects.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="selected" className="text-[10px] h-6">
            <Eye className="w-2.5 h-2.5 mr-1" />
            Selected
            {selectedMapObjectIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">
                {selectedMapObjectIds.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="create" className="flex-1 overflow-auto mt-0">
        <CreateTab onCreate={handleCreated} />
      </TabsContent>

      <TabsContent value="objects" className="flex-1 overflow-hidden mt-0">
        <ObjectsTab onSelect={handleObjectSelected} />
      </TabsContent>

      <TabsContent value="selected" className="flex-1 overflow-hidden mt-0">
        <SelectedTab />
      </TabsContent>
    </Tabs>
  );
};
