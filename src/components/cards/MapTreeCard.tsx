import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Lock, LockOpen, CircleDot, Square,
  Lightbulb, Box, FolderOpen, Folder, Trash2, Pencil, Check, X,
  Plus, ArrowRightFromLine, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { useGroupStore } from '@/stores/groupStore';
import { EntityGroup, EntityGeometry } from '@/lib/groupTransforms';
import { CATEGORY_DEFAULT_RENDER_ORDER } from '@/lib/mapObjectRenderer';
import { toast } from 'sonner';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const entityTypeIcon: Record<string, React.ReactNode> = {
  token:     <CircleDot className="h-3.5 w-3.5 text-primary" />,
  region:    <Square    className="h-3.5 w-3.5 text-accent-foreground" />,
  mapObject: <Box       className="h-3.5 w-3.5 text-muted-foreground" />,
  light:     <Lightbulb className="h-3.5 w-3.5 text-foreground" />,
};

// Notional render orders for non-MapObject types (for tree sorting only)
const TYPE_NOTIONAL_ORDER: Record<string, number> = {
  token:  200, // Always frontmost
  light:  150,
  region:   5, // Always at the back
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TreeEntity {
  id: string;
  name: string;
  type: 'token' | 'region' | 'mapObject' | 'light';
  groupId?: string;
  x: number;
  y: number;
  locked?: boolean;
  renderOrder?: number; // effective render order for sorting
}

function getEffectiveRenderOrder(entity: TreeEntity): number {
  if (entity.type === 'mapObject') {
    return entity.renderOrder ?? 50;
  }
  return TYPE_NOTIONAL_ORDER[entity.type] ?? 50;
}

function getEntityName(entity: TreeEntity): string {
  return entity.name || `${entity.type}-${entity.id.slice(-4)}`;
}

// ─── Inline rename input ───────────────────────────────────────────────────────
function RenameInput({ value, onCommit, onCancel }: { value: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  React.useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
      <Input
        ref={inputRef}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(v.trim() || value); if (e.key === 'Escape') onCancel(); }}
        className="h-5 text-xs px-1 py-0 flex-1 min-w-0"
      />
      <button className="shrink-0 text-primary" onClick={() => onCommit(v.trim() || value)}><Check className="h-3 w-3" /></button>
      <button className="shrink-0 text-muted-foreground" onClick={onCancel}><X className="h-3 w-3" /></button>
    </div>
  );
}

// ─── Selection bubble ──────────────────────────────────────────────────────────
function SelectionBubble({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full border transition-all
        ${selected
          ? 'bg-primary border-primary text-primary-foreground opacity-100'
          : 'border-muted-foreground/40 opacity-0 group-hover:opacity-60'
        }`}
      onClick={onClick}
      title="Add to selection"
    >
      {selected && <Check className="h-2.5 w-2.5" />}
    </button>
  );
}

// ─── Entity row (inside or outside a group) ────────────────────────────────────
function EntityRow({
  entity,
  depth = 0,
  groupId,
  selected,
  onToggleLock,
  onEjectFromGroup,
  onAddToNewGroup,
  onSelect,
  onSelectAdditive,
  draggable,
  dropIndicator,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  entity: TreeEntity;
  depth?: number;
  groupId?: string;
  selected?: boolean;
  onToggleLock?: (entity: TreeEntity) => void;
  onEjectFromGroup?: (groupId: string, entityId: string) => void;
  onAddToNewGroup?: (entity: TreeEntity) => void;
  onSelect?: (entity: TreeEntity, additive: boolean) => void;
  onSelectAdditive?: (entity: TreeEntity) => void;
  draggable?: boolean;
  dropIndicator?: 'above' | 'below' | null;
  onDragStart?: (entity: TreeEntity) => void;
  onDragOver?: (e: React.DragEvent, entity: TreeEntity) => void;
  onDrop?: (e: React.DragEvent, entity: TreeEntity) => void;
  onDragEnd?: () => void;
}) {
  const canLock = entity.type === 'region' || entity.type === 'mapObject';
  const canDrag = draggable && entity.type === 'mapObject';

  return (
    <div className="relative">
      {dropIndicator === 'above' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
      )}
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer text-xs group
          ${selected ? 'bg-primary/15 text-primary' : ''}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        draggable={canDrag}
        onDragStart={canDrag ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(entity); } : undefined}
        onDragOver={canDrag ? (e) => { e.preventDefault(); onDragOver?.(e, entity); } : undefined}
        onDrop={canDrag ? (e) => { e.preventDefault(); onDrop?.(e, entity); } : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
        onClick={(e) => onSelect?.(entity, e.ctrlKey || e.metaKey)}
      >
        {/* Drag handle */}
        {canDrag ? (
          <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 cursor-grab" />
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}

        {/* Selection bubble */}
        <SelectionBubble
          selected={!!selected}
          onClick={(e) => { e.stopPropagation(); onSelectAdditive?.(entity); }}
        />

        {entityTypeIcon[entity.type] || <Box className="h-3.5 w-3.5" />}
        <span className="truncate flex-1 text-foreground">{getEntityName(entity)}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">{entity.type}</Badge>

        {/* Eject from group (only when inside a group) */}
        {groupId && onEjectFromGroup && (
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-80 transition-opacity"
            title="Remove from group (eject to ungrouped)"
            onClick={e => { e.stopPropagation(); onEjectFromGroup(groupId, entity.id); }}
          >
            <ArrowRightFromLine className="h-3 w-3" />
          </button>
        )}

        {/* Create new group (only ungrouped entities) */}
        {!groupId && onAddToNewGroup && (
          <button
            className="shrink-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-80 transition-opacity"
            title="Create a new group with this entity"
            onClick={e => { e.stopPropagation(); onAddToNewGroup(entity); }}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}

        {/* Lock toggle */}
        {canLock ? (
          <button
            className="ml-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title={entity.locked ? 'Unlock entity' : 'Lock entity'}
            onClick={e => { e.stopPropagation(); onToggleLock?.(entity); }}
          >
            {entity.locked
              ? <Lock className="h-3 w-3 text-primary" />
              : <LockOpen className="h-3 w-3 opacity-40 group-hover:opacity-80" />}
          </button>
        ) : (
          <span className="h-3 w-3 ml-0.5 shrink-0" />
        )}
      </div>
      {dropIndicator === 'below' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
      )}
    </div>
  );
}

// ─── Group node ────────────────────────────────────────────────────────────────
function GroupNode({
  group,
  entities,
  selectedIds,
  onDelete,
  onToggleLock,
  onToggleEntityLock,
  onRename,
  onEjectFromGroup,
  onSelect,
  onSelectAdditive,
}: {
  group: EntityGroup;
  entities: TreeEntity[];
  selectedIds: Set<string>;
  onDelete: (groupId: string) => void;
  onToggleLock: (group: EntityGroup) => void;
  onToggleEntityLock: (entity: TreeEntity) => void;
  onRename: (groupId: string, name: string) => void;
  onEjectFromGroup: (groupId: string, entityId: string) => void;
  onSelect: (entity: TreeEntity, additive: boolean) => void;
  onSelectAdditive: (entity: TreeEntity) => void;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);

  const memberEntities = entities.filter(e =>
    group.members.some(m => m.id === e.id && m.type === e.type)
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-0.5 group">
        <CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer text-xs flex-1 text-left min-w-0">
          {open
            ? <ChevronDown  className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          {open
            ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
            : <Folder     className="h-3.5 w-3.5 shrink-0 text-primary" />}

          {renaming ? (
            <RenameInput
              value={group.name}
              onCommit={name => { onRename(group.id, name); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <>
              <span className="truncate flex-1 font-medium text-foreground">{group.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                {memberEntities.length}
              </Badge>
            </>
          )}
        </CollapsibleTrigger>

        {/* Rename */}
        {!renaming && (
          <button
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-80 transition-opacity"
            title="Rename group"
            onClick={e => { e.stopPropagation(); setRenaming(true); }}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}

        {/* Lock */}
        <button
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
          title={group.locked ? 'Unlock group' : 'Lock group'}
          onClick={e => { e.stopPropagation(); onToggleLock(group); }}
        >
          {group.locked
            ? <Lock    className="h-3 w-3 text-primary" />
            : <LockOpen className="h-3 w-3 opacity-40 group-hover:opacity-80" />}
        </button>

        {/* Delete / dissolve */}
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={e => { e.stopPropagation(); onDelete(group.id); }}
          title="Dissolve group (keeps members)"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <CollapsibleContent>
        {memberEntities.length === 0 && (
          <p className="text-[10px] text-muted-foreground px-8 py-1 italic">Empty group</p>
        )}
        {memberEntities.map(entity => (
          <EntityRow
            key={`${entity.type}-${entity.id}`}
            entity={entity}
            depth={1}
            groupId={group.id}
            selected={selectedIds.has(entity.id)}
            onToggleLock={onToggleEntityLock}
            onEjectFromGroup={onEjectFromGroup}
            onSelect={onSelect}
            onSelectAdditive={onSelectAdditive}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Card content ──────────────────────────────────────────────────────────────
export const MapTreeCardContent: React.FC = () => {
  const tokens      = useSessionStore(s => s.tokens);
  const selectedTokenIds = useSessionStore(s => s.selectedTokenIds ?? []);
  const setSelectedTokens = useSessionStore(s => s.setSelectedTokens);
  const regions     = useRegionStore(s => s.regions);
  const updateRegion = useRegionStore(s => s.updateRegion);
  const selectRegion = useRegionStore(s => s.selectRegion);
  const mapObjects  = useMapObjectStore(s => s.mapObjects);
  const selectedMapObjectIds = useMapObjectStore(s => s.selectedMapObjectIds);
  const updateMapObject = useMapObjectStore(s => s.updateMapObject);
  const selectMapObject = useMapObjectStore(s => s.selectMapObject);
  const reorderMapObject = useMapObjectStore(s => s.reorderMapObject);
  const normalizeRenderOrders = useMapObjectStore(s => s.normalizeRenderOrders);
  const lights      = useLightStore(s => s.lights);
  const { groups, removeGroup, setGroupLocked, updateGroup, removeMemberFromGroup, addGroup } = useGroupStore();

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragEntityRef = useRef<TreeEntity | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allSelectedIds = useMemo(() => {
    const set = new Set<string>(selectedMapObjectIds);
    selectedTokenIds.forEach(id => set.add(id));
    regions.filter(r => r.selected).forEach(r => set.add(r.id));
    return set;
  }, [selectedMapObjectIds, selectedTokenIds, regions]);

  const handleSelect = useCallback((entity: TreeEntity, additive: boolean) => {
    if (entity.type === 'mapObject') {
      selectMapObject(entity.id, additive);
    } else if (entity.type === 'token') {
      if (additive) {
        const next = allSelectedIds.has(entity.id)
          ? selectedTokenIds.filter(id => id !== entity.id)
          : [...selectedTokenIds, entity.id];
        setSelectedTokens?.(next);
      } else {
        setSelectedTokens?.([entity.id]);
      }
    } else if (entity.type === 'region') {
      selectRegion(entity.id);
    }
  }, [selectMapObject, selectRegion, setSelectedTokens, allSelectedIds, selectedTokenIds]);

  const handleSelectAdditive = useCallback((entity: TreeEntity) => {
    handleSelect(entity, true);
  }, [handleSelect]);

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  const handleDragStart = useCallback((entity: TreeEntity) => {
    dragEntityRef.current = entity;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, target: TreeEntity) => {
    if (!dragEntityRef.current || dragEntityRef.current.id === target.id) return;
    if (target.type !== 'mapObject') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';
    setDropTarget({ id: target.id, position });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, target: TreeEntity) => {
    const dragged = dragEntityRef.current;
    if (!dragged || dragged.id === target.id || dragged.type !== 'mapObject') {
      setDropTarget(null);
      dragEntityRef.current = null;
      return;
    }

    // Compute new renderOrder: midpoint between neighbours in the sorted list.
    // allEntities is sorted descending (frontmost first), so higher index = lower order.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dropPos: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';

    // Get sorted mapObjects by effective renderOrder ascending
    const sortedObjs = [...mapObjects].sort((a, b) => {
      const ao = a.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[a.category] ?? 50;
      const bo = b.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[b.category] ?? 50;
      return ao - bo;
    });

    const targetIdx = sortedObjs.findIndex(o => o.id === target.id);
    // In tree view ascending = bottom of list (lower draw order), so "above" in tree = higher draw order
    let prevOrder: number;
    let nextOrder: number;

    if (dropPos === 'above') {
      // Insert just above target in tree = just after target in ascending draw order
      const prevObj = sortedObjs[targetIdx + 1];
      const nextObj = sortedObjs[targetIdx];
      prevOrder = nextObj ? (nextObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[nextObj.category] ?? 50) : 0;
      nextOrder = prevObj ? (prevObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[prevObj.category] ?? 50) : prevOrder + 100;
    } else {
      // Insert just below target in tree = just before target in ascending draw order
      const prevObj = sortedObjs[targetIdx];
      const nextObj = sortedObjs[targetIdx - 1];
      nextOrder = prevObj ? (prevObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[prevObj.category] ?? 50) : 0;
      prevOrder = nextObj ? (nextObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[nextObj.category] ?? 50) : nextOrder - 100;
    }

    const newOrder = (prevOrder + nextOrder) / 2;

    if (Math.abs(nextOrder - prevOrder) < 1) {
      // Gap too small — normalize first, then reorder
      normalizeRenderOrders();
      // After normalization, just set to the target's new order ±5
      const tgt = mapObjects.find(o => o.id === target.id);
      const tgtNorm = tgt ? ((mapObjects.indexOf(tgt) + 1) * 10) : 50;
      reorderMapObject(dragged.id, dropPos === 'above' ? tgtNorm + 5 : tgtNorm - 5);
    } else {
      reorderMapObject(dragged.id, newOrder);
    }

    dragEntityRef.current = null;
    setDropTarget(null);
  }, [mapObjects, reorderMapObject, normalizeRenderOrders]);

  const handleDragEnd = useCallback(() => {
    dragEntityRef.current = null;
    setDropTarget(null);
  }, []);

  // ── Other handlers ─────────────────────────────────────────────────────────
  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    removeGroup(groupId);
    toast.success(`Group "${group?.name || 'Unknown'}" dissolved — members kept`);
  };

  const handleToggleGroupLock = (group: EntityGroup) => {
    const next = !group.locked;
    setGroupLocked(group.id, next);
    toast.success(`Group "${group.name}" ${next ? 'locked' : 'unlocked'}`);
  };

  const handleToggleEntityLock = (entity: TreeEntity) => {
    const next = !entity.locked;
    if (entity.type === 'region')    updateRegion(entity.id, { locked: next });
    if (entity.type === 'mapObject') updateMapObject(entity.id, { locked: next });
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    updateGroup(groupId, { name });
    toast.success(`Group renamed to "${name}"`);
  };

  const handleEjectFromGroup = (groupId: string, entityId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.members.length <= 2) {
      removeGroup(groupId);
      toast.info('Group dissolved — too few members remaining');
    } else {
      removeMemberFromGroup(groupId, entityId);
      toast.success('Entity removed from group');
    }
  };

  const handleAddToNewGroup = (entity: TreeEntity) => {
    const name = prompt('New group name:', 'Group');
    if (!name) return;

    let geometry: EntityGeometry;
    if (entity.type === 'region') {
      const r = regions.find(r => r.id === entity.id);
      geometry = { id: entity.id, x: r?.x ?? entity.x, y: r?.y ?? entity.y, width: r?.width ?? 80, height: r?.height ?? 80 };
    } else if (entity.type === 'mapObject') {
      const o = mapObjects.find(o => o.id === entity.id);
      geometry = { id: entity.id, x: o?.position.x ?? entity.x, y: o?.position.y ?? entity.y, width: o?.width ?? 40, height: o?.height ?? 40 };
    } else {
      geometry = { id: entity.id, x: entity.x, y: entity.y, width: 40, height: 40 };
    }

    addGroup(name, [{ id: entity.id, type: entity.type }], [geometry]);
    toast.success(`Created group "${name}"`);
  };

  // ── Build flat entity list sorted by renderOrder descending (frontmost first) ─
  const allEntities = useMemo<TreeEntity[]>(() => {
    const entities: TreeEntity[] = [];
    tokens.forEach(t => entities.push({
      id: t.id, name: t.name || t.label || '', type: 'token',
      x: t.x, y: t.y,
      renderOrder: TYPE_NOTIONAL_ORDER.token,
    }));
    regions.forEach(r => entities.push({
      id: r.id, name: r.id.slice(0, 8), type: 'region',
      x: r.x, y: r.y, locked: r.locked,
      renderOrder: TYPE_NOTIONAL_ORDER.region,
    }));
    mapObjects.forEach(o => entities.push({
      id: o.id, name: o.label || o.shape || '', type: 'mapObject',
      x: o.position.x, y: o.position.y, locked: o.locked,
      renderOrder: o.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[o.category] ?? 50,
    }));
    lights.forEach(l => entities.push({
      id: l.id, name: l.label || '', type: 'light',
      x: l.position.x, y: l.position.y,
      renderOrder: TYPE_NOTIONAL_ORDER.light,
    }));

    // Sort descending: highest renderOrder = frontmost = top of list (Photoshop convention)
    entities.sort((a, b) => getEffectiveRenderOrder(b) - getEffectiveRenderOrder(a));
    return entities;
  }, [tokens, regions, mapObjects, lights]);

  const groupedEntityIds = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(g => g.members.forEach(m => set.add(m.id)));
    return set;
  }, [groups]);

  const ungroupedEntities = allEntities.filter(e => !groupedEntityIds.has(e.id));

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {/* Summary badges */}
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <Badge variant="outline" className="text-[10px]">{tokens.length} tokens</Badge>
          <Badge variant="outline" className="text-[10px]">{regions.length} regions</Badge>
          <Badge variant="outline" className="text-[10px]">{mapObjects.length} objects</Badge>
          <Badge variant="outline" className="text-[10px]">{lights.length} lights</Badge>
          {groups.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{groups.length} groups</Badge>
          )}
        </div>

        {/* Info banner */}
        <div className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-2 leading-relaxed">
          Drag map objects to reorder draw order. Tokens always draw above map objects.
        </div>

        {/* ── Groups ── */}
        {groups.map(group => (
          <GroupNode
            key={group.id}
            group={group}
            entities={allEntities}
            selectedIds={allSelectedIds}
            onDelete={handleDeleteGroup}
            onToggleLock={handleToggleGroupLock}
            onToggleEntityLock={handleToggleEntityLock}
            onRename={handleRenameGroup}
            onEjectFromGroup={handleEjectFromGroup}
            onSelect={handleSelect}
            onSelectAdditive={handleSelectAdditive}
          />
        ))}

        {/* ── Ungrouped section header ── */}
        {ungroupedEntities.length > 0 && groups.length > 0 && (
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1 border-t border-border/40 mt-2">
            Ungrouped
          </div>
        )}

        {/* ── Ungrouped entities ── */}
        {ungroupedEntities.map(entity => (
          <EntityRow
            key={`${entity.type}-${entity.id}`}
            entity={entity}
            selected={allSelectedIds.has(entity.id)}
            onToggleLock={handleToggleEntityLock}
            onAddToNewGroup={handleAddToNewGroup}
            onSelect={handleSelect}
            onSelectAdditive={handleSelectAdditive}
            draggable={entity.type === 'mapObject'}
            dropIndicator={dropTarget?.id === entity.id ? dropTarget.position : null}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}

        {allEntities.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No entities on the map yet.
          </p>
        )}
      </div>
    </ScrollArea>
  );
};
