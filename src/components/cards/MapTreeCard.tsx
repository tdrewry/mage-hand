import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Lock, LockOpen, CircleDot, Square,
  Lightbulb, Box, FolderOpen, Folder, Trash2, Pencil, Check, X,
  Plus, ArrowRightFromLine, GripVertical, Search, ArrowUpDown,
  SortAsc, SortDesc, Eye, EyeOff, ArrowUp, ArrowDown,
  ChevronsUp, ChevronsDown, Copy, Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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

// ─── Context menu actions per entity type ─────────────────────────────────────
interface EntityContextActions {
  onSelect: (entity: TreeEntity, additive: boolean) => void;
  onSelectAdditive: (entity: TreeEntity) => void;
  onToggleLock: (entity: TreeEntity) => void;
  onDelete: (entity: TreeEntity) => void;
  onRename: (entity: TreeEntity) => void;
  onToggleVisibility?: (entity: TreeEntity) => void;
  onBringToFront?: (entity: TreeEntity) => void;
  onSendToBack?: (entity: TreeEntity) => void;
  onMoveUp?: (entity: TreeEntity) => void;
  onMoveDown?: (entity: TreeEntity) => void;
  onDuplicate?: (entity: TreeEntity) => void;
  onToggleDoor?: (entity: TreeEntity) => void;
  onEjectFromGroup?: (groupId: string, entityId: string) => void;
  groupId?: string;
}

// ─── Tree Context Menu ─────────────────────────────────────────────────────────
function TreeContextMenu({
  entity,
  children,
  actions,
  mapObjects,
}: {
  entity: TreeEntity;
  children: React.ReactNode;
  actions: EntityContextActions;
  mapObjects?: Array<{ id: string; renderOrder?: number; category: string }>;
}) {
  const isMapObject = entity.type === 'mapObject';
  const isToken = entity.type === 'token';
  const isRegion = entity.type === 'region';
  const isLight = entity.type === 'light';
  const isDoor = isMapObject && mapObjects?.find(o => o.id === entity.id)?.category === 'door';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52 text-xs">
        {/* Universal: select */}
        <ContextMenuItem
          className="text-xs gap-2"
          onClick={() => actions.onSelect(entity, false)}
        >
          <CircleDot className="h-3.5 w-3.5" />
          Select
        </ContextMenuItem>
        <ContextMenuItem
          className="text-xs gap-2"
          onClick={() => actions.onSelectAdditive(entity)}
        >
          <Check className="h-3.5 w-3.5" />
          Add to Selection
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Rename */}
        <ContextMenuItem
          className="text-xs gap-2"
          onClick={() => actions.onRename(entity)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </ContextMenuItem>

        {/* Lock / unlock */}
        {(isMapObject || isRegion) && (
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => actions.onToggleLock(entity)}
          >
            {entity.locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {entity.locked ? 'Unlock' : 'Lock'}
          </ContextMenuItem>
        )}

        {/* Visibility toggle */}
        {(isToken || isLight) && actions.onToggleVisibility && (
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => actions.onToggleVisibility!(entity)}
          >
            <Eye className="h-3.5 w-3.5" />
            Toggle Visibility
          </ContextMenuItem>
        )}

        {/* Door toggle */}
        {isDoor && actions.onToggleDoor && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-xs gap-2"
              onClick={() => actions.onToggleDoor!(entity)}
            >
              <Square className="h-3.5 w-3.5" />
              Toggle Door Open/Closed
            </ContextMenuItem>
          </>
        )}

        {/* Z-order controls — map objects only */}
        {isMapObject && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="text-xs gap-2">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Draw Order
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44 text-xs">
                <ContextMenuItem className="text-xs gap-2" onClick={() => actions.onBringToFront?.(entity)}>
                  <ChevronsUp className="h-3.5 w-3.5" />
                  Bring to Front
                </ContextMenuItem>
                <ContextMenuItem className="text-xs gap-2" onClick={() => actions.onMoveUp?.(entity)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                  Move Up One Layer
                </ContextMenuItem>
                <ContextMenuItem className="text-xs gap-2" onClick={() => actions.onMoveDown?.(entity)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                  Move Down One Layer
                </ContextMenuItem>
                <ContextMenuItem className="text-xs gap-2" onClick={() => actions.onSendToBack?.(entity)}>
                  <ChevronsDown className="h-3.5 w-3.5" />
                  Send to Back
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {/* Duplicate */}
        {(isMapObject || isToken) && actions.onDuplicate && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-xs gap-2"
              onClick={() => actions.onDuplicate!(entity)}
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </ContextMenuItem>
          </>
        )}

        {/* Eject from group */}
        {actions.groupId && actions.onEjectFromGroup && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-xs gap-2"
              onClick={() => actions.onEjectFromGroup!(actions.groupId!, entity.id)}
            >
              <Unlink className="h-3.5 w-3.5" />
              Remove from Group
            </ContextMenuItem>
          </>
        )}

        <ContextMenuSeparator />

        {/* Delete */}
        <ContextMenuItem
          className="text-xs gap-2 text-destructive focus:text-destructive"
          onClick={() => actions.onDelete(entity)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
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
  renamingId,
  onRenameCommit,
  onRenameCancel,
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
  contextActions,
  mapObjects,
}: {
  entity: TreeEntity;
  depth?: number;
  groupId?: string;
  selected?: boolean;
  renamingId?: string | null;
  onRenameCommit?: (entity: TreeEntity, name: string) => void;
  onRenameCancel?: () => void;
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
  contextActions: EntityContextActions;
  mapObjects?: Array<{ id: string; renderOrder?: number; category: string }>;
}) {
  const canLock = entity.type === 'region' || entity.type === 'mapObject';
  const canDrag = draggable && entity.type === 'mapObject';
  const isRenaming = renamingId === entity.id;

  const rowContent = (
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

        {isRenaming ? (
          <RenameInput
            value={getEntityName(entity)}
            onCommit={(name) => onRenameCommit?.(entity, name)}
            onCancel={() => onRenameCancel?.()}
          />
        ) : (
          <span className="truncate flex-1 text-foreground">{getEntityName(entity)}</span>
        )}

        {!isRenaming && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">{entity.type}</Badge>
        )}

        {/* Eject from group (only when inside a group) */}
        {groupId && onEjectFromGroup && !isRenaming && (
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-80 transition-opacity"
            title="Remove from group (eject to ungrouped)"
            onClick={e => { e.stopPropagation(); onEjectFromGroup(groupId, entity.id); }}
          >
            <ArrowRightFromLine className="h-3 w-3" />
          </button>
        )}

        {/* Create new group (only ungrouped entities) */}
        {!groupId && onAddToNewGroup && !isRenaming && (
          <button
            className="shrink-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-80 transition-opacity"
            title="Create a new group with this entity"
            onClick={e => { e.stopPropagation(); onAddToNewGroup(entity); }}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}

        {/* Lock toggle */}
        {canLock && !isRenaming ? (
          <button
            className="ml-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title={entity.locked ? 'Unlock entity' : 'Lock entity'}
            onClick={e => { e.stopPropagation(); onToggleLock?.(entity); }}
          >
            {entity.locked
              ? <Lock className="h-3 w-3 text-primary" />
              : <LockOpen className="h-3 w-3 opacity-40 group-hover:opacity-80" />}
          </button>
        ) : !isRenaming ? (
          <span className="h-3 w-3 ml-0.5 shrink-0" />
        ) : null}
      </div>
      {dropIndicator === 'below' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
      )}
    </div>
  );

  return (
    <TreeContextMenu
      entity={entity}
      actions={{ ...contextActions, groupId, onEjectFromGroup }}
      mapObjects={mapObjects}
    >
      {rowContent}
    </TreeContextMenu>
  );
}

// ─── Group node ────────────────────────────────────────────────────────────────
function GroupNode({
  group,
  entities,
  selectedIds,
  renamingId,
  onDelete,
  onToggleLock,
  onToggleEntityLock,
  onRename,
  onEjectFromGroup,
  onSelect,
  onSelectAdditive,
  onRenameCommit,
  onRenameCancel,
  contextActions,
  mapObjects,
}: {
  group: EntityGroup;
  entities: TreeEntity[];
  selectedIds: Set<string>;
  renamingId?: string | null;
  onDelete: (groupId: string) => void;
  onToggleLock: (group: EntityGroup) => void;
  onToggleEntityLock: (entity: TreeEntity) => void;
  onRename: (groupId: string, name: string) => void;
  onEjectFromGroup: (groupId: string, entityId: string) => void;
  onSelect: (entity: TreeEntity, additive: boolean) => void;
  onSelectAdditive: (entity: TreeEntity) => void;
  onRenameCommit: (entity: TreeEntity, name: string) => void;
  onRenameCancel: () => void;
  contextActions: EntityContextActions;
  mapObjects?: Array<{ id: string; renderOrder?: number; category: string }>;
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
            renamingId={renamingId}
            onToggleLock={onToggleEntityLock}
            onEjectFromGroup={onEjectFromGroup}
            onSelect={onSelect}
            onSelectAdditive={onSelectAdditive}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
            contextActions={contextActions}
            mapObjects={mapObjects}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Sort options ──────────────────────────────────────────────────────────────
type SortField = 'renderOrder' | 'name' | 'type';
type SortDir   = 'asc' | 'desc';

// ─── Card content ──────────────────────────────────────────────────────────────
export const MapTreeCardContent: React.FC = () => {
  const tokens      = useSessionStore(s => s.tokens);
  const selectedTokenIds = useSessionStore(s => s.selectedTokenIds ?? []);
  const setSelectedTokens = useSessionStore(s => s.setSelectedTokens);
  const removeToken = useSessionStore(s => s.removeToken);
  const updateTokenName = useSessionStore(s => s.updateTokenName);
  const updateTokenHidden = useCallback((id: string, isHidden: boolean) => {
    useSessionStore.setState(state => ({
      tokens: state.tokens.map(t => t.id === id ? { ...t, isHidden } : t),
    }));
  }, []);

  const regions     = useRegionStore(s => s.regions);
  const updateRegion = useRegionStore(s => s.updateRegion);
  const removeRegion = useRegionStore(s => s.removeRegion);
  const selectRegion = useRegionStore(s => s.selectRegion);
  const deselectRegion = useRegionStore(s => s.deselectRegion);

  const mapObjects  = useMapObjectStore(s => s.mapObjects);
  const selectedMapObjectIds = useMapObjectStore(s => s.selectedMapObjectIds);
  const updateMapObject = useMapObjectStore(s => s.updateMapObject);
  const removeMapObject = useMapObjectStore(s => s.removeMapObject);
  const addMapObject = useMapObjectStore(s => s.addMapObject);
  const selectMapObject = useMapObjectStore(s => s.selectMapObject);
  const deselectMapObject = useMapObjectStore(s => s.deselectMapObject);
  const reorderMapObject = useMapObjectStore(s => s.reorderMapObject);
  const normalizeRenderOrders = useMapObjectStore(s => s.normalizeRenderOrders);
  const toggleDoor = useMapObjectStore(s => s.toggleDoor);

  const lights      = useLightStore(s => s.lights);
  const removeLight = useLightStore(s => s.removeLight);
  const updateLight = useLightStore(s => s.updateLight);
  const toggleLight = useLightStore(s => s.toggleLight);

  const { groups, removeGroup, setGroupLocked, updateGroup, removeMemberFromGroup, addGroup } = useGroupStore();

  // ── Search & sort state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('renderOrder');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Inline rename state ───────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'renderOrder' ? 'desc' : 'asc');
    }
  }, [sortField]);

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
    const alreadySelected = allSelectedIds.has(entity.id);

    if (entity.type === 'mapObject') {
      // Toggle deselect on plain click of an already-selected item
      if (!additive && alreadySelected && selectedMapObjectIds.length === 1) {
        deselectMapObject(entity.id);
      } else {
        selectMapObject(entity.id, additive);
      }
    } else if (entity.type === 'token') {
      if (additive) {
        const next = selectedTokenIds.includes(entity.id)
          ? selectedTokenIds.filter(id => id !== entity.id)
          : [...selectedTokenIds, entity.id];
        setSelectedTokens?.(next);
      } else if (!additive && alreadySelected && selectedTokenIds.length === 1) {
        // Toggle deselect
        setSelectedTokens?.([]);
      } else {
        setSelectedTokens?.([entity.id]);
      }
    } else if (entity.type === 'region') {
      if (!additive && alreadySelected) {
        deselectRegion(entity.id);
      } else {
        selectRegion(entity.id);
      }
    }
  }, [selectMapObject, deselectMapObject, selectRegion, deselectRegion, setSelectedTokens, allSelectedIds, selectedTokenIds, selectedMapObjectIds]);

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

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dropPos: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';

    const sortedObjs = [...mapObjects].sort((a, b) => {
      const ao = a.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[a.category] ?? 50;
      const bo = b.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[b.category] ?? 50;
      return ao - bo;
    });

    const targetIdx = sortedObjs.findIndex(o => o.id === target.id);
    let prevOrder: number;
    let nextOrder: number;

    if (dropPos === 'above') {
      const prevObj = sortedObjs[targetIdx + 1];
      const nextObj = sortedObjs[targetIdx];
      prevOrder = nextObj ? (nextObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[nextObj.category] ?? 50) : 0;
      nextOrder = prevObj ? (prevObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[prevObj.category] ?? 50) : prevOrder + 100;
    } else {
      const prevObj = sortedObjs[targetIdx];
      const nextObj = sortedObjs[targetIdx - 1];
      nextOrder = prevObj ? (prevObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[prevObj.category] ?? 50) : 0;
      prevOrder = nextObj ? (nextObj.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[nextObj.category] ?? 50) : nextOrder - 100;
    }

    const newOrder = (prevOrder + nextOrder) / 2;

    if (Math.abs(nextOrder - prevOrder) < 1) {
      normalizeRenderOrders();
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

  // ── Context menu action handlers ──────────────────────────────────────────

  const handleDelete = useCallback((entity: TreeEntity) => {
    if (entity.type === 'mapObject') {
      removeMapObject(entity.id);
      toast.success(`Deleted "${getEntityName(entity)}"`);
    } else if (entity.type === 'token') {
      removeToken(entity.id);
      toast.success(`Deleted token "${getEntityName(entity)}"`);
    } else if (entity.type === 'region') {
      removeRegion(entity.id);
      toast.success(`Deleted region`);
    } else if (entity.type === 'light') {
      removeLight(entity.id);
      toast.success(`Deleted light "${getEntityName(entity)}"`);
    }
  }, [removeMapObject, removeToken, removeRegion, removeLight]);

  const handleRenameStart = useCallback((entity: TreeEntity) => {
    setRenamingId(entity.id);
  }, []);

  const handleRenameCommit = useCallback((entity: TreeEntity, name: string) => {
    if (entity.type === 'mapObject') {
      updateMapObject(entity.id, { label: name });
    } else if (entity.type === 'token') {
      updateTokenName(entity.id, name);
    } else if (entity.type === 'light') {
      updateLight(entity.id, { label: name });
    }
    setRenamingId(null);
    toast.success(`Renamed to "${name}"`);
  }, [updateMapObject, updateTokenName, updateLight]);

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleToggleVisibility = useCallback((entity: TreeEntity) => {
    if (entity.type === 'token') {
      const token = tokens.find(t => t.id === entity.id);
      if (token) {
        updateTokenHidden(entity.id, !token.isHidden);
        toast.success(`Token ${token.isHidden ? 'shown' : 'hidden'}`);
      }
    } else if (entity.type === 'light') {
      toggleLight(entity.id);
      toast.success('Light toggled');
    }
  }, [tokens, updateTokenHidden, toggleLight]);

  const handleToggleDoor = useCallback((entity: TreeEntity) => {
    toggleDoor(entity.id);
    toast.success('Door toggled');
  }, [toggleDoor]);

  const handleDuplicate = useCallback((entity: TreeEntity) => {
    if (entity.type === 'mapObject') {
      const obj = mapObjects.find(o => o.id === entity.id);
      if (!obj) return;
      const { id: _id, ...rest } = obj;
      addMapObject({
        ...rest,
        selected: false,
        position: { x: obj.position.x + 20, y: obj.position.y + 20 },
      });
      toast.success(`Duplicated "${getEntityName(entity)}"`);
    } else if (entity.type === 'token') {
      const token = tokens.find(t => t.id === entity.id);
      if (!token) return;
      const newId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      useSessionStore.getState().addToken({ ...token, id: newId, x: token.x + 50, y: token.y + 50 });
      toast.success(`Duplicated token "${getEntityName(entity)}"`);
    }
  }, [mapObjects, tokens, addMapObject]);

  const getSortedMapObjectIds = useCallback(() => {
    return [...mapObjects]
      .sort((a, b) => {
        const ao = a.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[a.category] ?? 50;
        const bo = b.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[b.category] ?? 50;
        return ao - bo;
      })
      .map(o => o.id);
  }, [mapObjects]);

  const handleBringToFront = useCallback((entity: TreeEntity) => {
    const sorted = getSortedMapObjectIds();
    const maxOrder = Math.max(...mapObjects.map(o => o.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[o.category] ?? 50));
    reorderMapObject(entity.id, maxOrder + 10);
    toast.success('Brought to front');
  }, [mapObjects, getSortedMapObjectIds, reorderMapObject]);

  const handleSendToBack = useCallback((entity: TreeEntity) => {
    const minOrder = Math.min(...mapObjects.map(o => o.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[o.category] ?? 50));
    reorderMapObject(entity.id, Math.max(0, minOrder - 10));
    toast.success('Sent to back');
  }, [mapObjects, reorderMapObject]);

  const handleMoveUp = useCallback((entity: TreeEntity) => {
    const sorted = [...mapObjects].sort((a, b) => {
      const ao = a.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[a.category] ?? 50;
      const bo = b.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[b.category] ?? 50;
      return ao - bo;
    });
    const currentIdx = sorted.findIndex(o => o.id === entity.id);
    if (currentIdx < sorted.length - 1) {
      const above = sorted[currentIdx + 1];
      const aboveAbove = sorted[currentIdx + 2];
      const currentOrder = sorted[currentIdx].renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[sorted[currentIdx].category] ?? 50;
      const aboveOrder = above.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[above.category] ?? 50;
      const aboveAboveOrder = aboveAbove ? (aboveAbove.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[aboveAbove.category] ?? 50) : aboveOrder + 20;
      const newOrder = (aboveOrder + aboveAboveOrder) / 2;
      if (Math.abs(aboveAboveOrder - aboveOrder) < 1) {
        normalizeRenderOrders();
        reorderMapObject(entity.id, aboveOrder + 5);
      } else {
        reorderMapObject(entity.id, newOrder);
      }
      toast.success('Moved up one layer');
    } else {
      toast.info('Already at front');
    }
  }, [mapObjects, reorderMapObject, normalizeRenderOrders]);

  const handleMoveDown = useCallback((entity: TreeEntity) => {
    const sorted = [...mapObjects].sort((a, b) => {
      const ao = a.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[a.category] ?? 50;
      const bo = b.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[b.category] ?? 50;
      return ao - bo;
    });
    const currentIdx = sorted.findIndex(o => o.id === entity.id);
    if (currentIdx > 0) {
      const below = sorted[currentIdx - 1];
      const belowBelow = sorted[currentIdx - 2];
      const belowOrder = below.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[below.category] ?? 50;
      const belowBelowOrder = belowBelow ? (belowBelow.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[belowBelow.category] ?? 50) : belowOrder - 20;
      const newOrder = (belowOrder + belowBelowOrder) / 2;
      if (Math.abs(belowOrder - belowBelowOrder) < 1) {
        normalizeRenderOrders();
        reorderMapObject(entity.id, belowOrder - 5);
      } else {
        reorderMapObject(entity.id, newOrder);
      }
      toast.success('Moved down one layer');
    } else {
      toast.info('Already at back');
    }
  }, [mapObjects, reorderMapObject, normalizeRenderOrders]);

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

  // ── Build contextActions object ────────────────────────────────────────────
  const contextActions: EntityContextActions = useMemo(() => ({
    onSelect: handleSelect,
    onSelectAdditive: handleSelectAdditive,
    onToggleLock: handleToggleEntityLock,
    onDelete: handleDelete,
    onRename: handleRenameStart,
    onToggleVisibility: handleToggleVisibility,
    onBringToFront: handleBringToFront,
    onSendToBack: handleSendToBack,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onDuplicate: handleDuplicate,
    onToggleDoor: handleToggleDoor,
    onEjectFromGroup: handleEjectFromGroup,
  }), [
    handleSelect, handleSelectAdditive, handleToggleEntityLock, handleDelete,
    handleRenameStart, handleToggleVisibility, handleBringToFront, handleSendToBack,
    handleMoveUp, handleMoveDown, handleDuplicate, handleToggleDoor, handleEjectFromGroup,
  ]);

  // ── Build flat entity list ────────────────────────────────────────────────
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

    // Apply search filter
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? entities.filter(e =>
          getEntityName(e).toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q)
        )
      : entities;

    // Apply sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'renderOrder') {
        cmp = getEffectiveRenderOrder(a) - getEffectiveRenderOrder(b);
      } else if (sortField === 'name') {
        cmp = getEntityName(a).localeCompare(getEntityName(b));
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [tokens, regions, mapObjects, lights, searchQuery, sortField, sortDir]);

  const groupedEntityIds = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(g => g.members.forEach(m => set.add(m.id)));
    return set;
  }, [groups]);

  const ungroupedEntities = allEntities.filter(e => !groupedEntityIds.has(e.id));

  // Expose mapObjects as a simpler shape for context menu category detection
  const mapObjectsForContext = useMemo(() =>
    mapObjects.map(o => ({ id: o.id, renderOrder: o.renderOrder, category: o.category })),
    [mapObjects]
  );

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

        {/* Search bar */}
        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search entities…"
            className="h-7 text-xs pl-6 pr-6"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] text-muted-foreground mr-0.5">Sort:</span>
          {(['renderOrder', 'name', 'type'] as SortField[]).map(field => {
            const active = sortField === field;
            const labels: Record<SortField, string> = { renderOrder: 'Depth', name: 'Name', type: 'Type' };
            return (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors
                  ${active
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
              >
                {labels[field]}
                {active && (sortDir === 'asc'
                  ? <SortAsc className="h-2.5 w-2.5 ml-0.5" />
                  : <SortDesc className="h-2.5 w-2.5 ml-0.5" />
                )}
                {!active && <ArrowUpDown className="h-2.5 w-2.5 ml-0.5 opacity-40" />}
              </button>
            );
          })}
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
            renamingId={renamingId}
            onDelete={handleDeleteGroup}
            onToggleLock={handleToggleGroupLock}
            onToggleEntityLock={handleToggleEntityLock}
            onRename={handleRenameGroup}
            onEjectFromGroup={handleEjectFromGroup}
            onSelect={handleSelect}
            onSelectAdditive={handleSelectAdditive}
            onRenameCommit={handleRenameCommit}
            onRenameCancel={handleRenameCancel}
            contextActions={contextActions}
            mapObjects={mapObjectsForContext}
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
            renamingId={renamingId}
            onToggleLock={handleToggleEntityLock}
            onAddToNewGroup={handleAddToNewGroup}
            onSelect={handleSelect}
            onSelectAdditive={handleSelectAdditive}
            onRenameCommit={handleRenameCommit}
            onRenameCancel={handleRenameCancel}
            draggable={entity.type === 'mapObject'}
            dropIndicator={dropTarget?.id === entity.id ? dropTarget.position : null}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            contextActions={contextActions}
            mapObjects={mapObjectsForContext}
          />
        ))}

        {allEntities.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {searchQuery ? `No entities match "${searchQuery}".` : 'No entities on the map yet.'}
          </p>
        )}
      </div>
    </ScrollArea>
  );
};
