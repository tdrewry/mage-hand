import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Lock, LockOpen, CircleDot, Square,
  Lightbulb, Box, FolderOpen, Folder, Trash2, Pencil, Check, X,
  Plus, ArrowRightFromLine, GripVertical, Search, ArrowUpDown,
  SortAsc, SortDesc, Eye, EyeOff, ArrowUp, ArrowDown,
  ChevronsUp, ChevronsDown, Copy, Unlink, Map, MousePointer2,
  Building2, Cloud, CloudOff, Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
import { useIlluminationStore } from '@/stores/illuminationStore';
import { useGroupStore } from '@/stores/groupStore';
import { useMapStore } from '@/stores/mapStore';
import { EntityGroup, EntityGeometry } from '@/lib/groupTransforms';
import { CATEGORY_DEFAULT_RENDER_ORDER } from '@/lib/mapObjectRenderer';
import { toast } from 'sonner';
import { useFogStore } from '@/stores/fogStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';

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
  mapId?: string;
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
  onSelect: (entity: TreeEntity, additive: boolean, shiftKey?: boolean) => void;
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full border transition-all
            ${selected
              ? 'bg-primary border-primary text-primary-foreground opacity-100'
              : 'border-muted-foreground/40 opacity-0 group-hover:opacity-60'
            }`}
          onClick={onClick}
        >
          {selected && <Check className="h-2.5 w-2.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Add to selection</TooltipContent>
    </Tooltip>
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
  onSelect?: (entity: TreeEntity, additive: boolean, shiftKey?: boolean) => void;
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
  const canDrag = !!draggable;
  const canDropReorder = draggable && entity.type === 'mapObject';
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
        onDragOver={canDropReorder ? (e) => { e.preventDefault(); onDragOver?.(e, entity); } : undefined}
        onDrop={canDropReorder ? (e) => { e.preventDefault(); onDrop?.(e, entity); } : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
        onClick={(e) => onSelect?.(entity, e.ctrlKey || e.metaKey, e.shiftKey)}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-80 transition-opacity"
                onClick={e => { e.stopPropagation(); onEjectFromGroup(groupId, entity.id); }}
              >
                <ArrowRightFromLine className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Remove from group (eject to ungrouped)</TooltipContent>
          </Tooltip>
        )}

        {/* Create new group (only ungrouped entities) */}
        {!groupId && onAddToNewGroup && !isRenaming && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="shrink-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-80 transition-opacity"
                onClick={e => { e.stopPropagation(); onAddToNewGroup(entity); }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Create a new group with this entity</TooltipContent>
          </Tooltip>
        )}

        {/* Lock toggle */}
        {canLock && !isRenaming ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="ml-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                onClick={e => { e.stopPropagation(); onToggleLock?.(entity); }}
              >
                {entity.locked
                  ? <Lock className="h-3 w-3 text-primary" />
                  : <LockOpen className="h-3 w-3 opacity-40 group-hover:opacity-80" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{entity.locked ? 'Unlock entity' : 'Lock entity'}</TooltipContent>
          </Tooltip>
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
  onDropOnGroup,
  isDropTarget,
  onDragOverGroup,
  onDragLeaveGroup,
  onDragStartGroup,
  onDragEndGroup,
  open,
  onOpenChange,
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
  onDropOnGroup?: (groupId: string) => void;
  isDropTarget?: boolean;
  onDragOverGroup?: (e: React.DragEvent, groupId: string) => void;
  onDragLeaveGroup?: () => void;
  onDragStartGroup?: (group: EntityGroup) => void;
  onDragEndGroup?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [renaming, setRenaming] = useState(false);

  const memberEntities = entities.filter(e =>
    group.members.some(m => m.id === e.id && m.type === e.type)
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={`flex items-center gap-0.5 group transition-colors ${
          isDropTarget ? 'bg-primary/20 ring-1 ring-primary/40 rounded' : ''
        }`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartGroup?.(group); }}
        onDragEnd={() => onDragEndGroup?.()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOverGroup?.(e, group.id); }}
        onDragLeave={() => onDragLeaveGroup?.()}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropOnGroup?.(group.id); }}
      >
        {/* Drag handle for group */}
        <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 cursor-grab ml-1" />

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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="shrink-0 p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-80 transition-opacity"
                onClick={e => { e.stopPropagation(); setRenaming(true); }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Rename group</TooltipContent>
          </Tooltip>
        )}

        {/* Lock */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={e => { e.stopPropagation(); onToggleLock(group); }}
            >
              {group.locked
                ? <Lock    className="h-3 w-3 text-primary" />
                : <LockOpen className="h-3 w-3 opacity-40 group-hover:opacity-80" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{group.locked ? 'Unlock group' : 'Lock group'}</TooltipContent>
        </Tooltip>

        {/* Delete / dissolve */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={e => { e.stopPropagation(); onDelete(group.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Dissolve group (keeps members)</TooltipContent>
        </Tooltip>
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
            draggable
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
  const maps = useMapStore(s => s.maps);
  const selectedMapId = useMapStore(s => s.selectedMapId);
  const addMap = useMapStore(s => s.addMap);
  const updateMap = useMapStore(s => s.updateMap);
  const removeMap = useMapStore(s => s.removeMap);
  const setSelectedMap = useMapStore(s => s.setSelectedMap);
  const reorderMaps = useMapStore(s => s.reorderMaps);
  const structures = useMapStore(s => s.structures);
  const addStructure = useMapStore(s => s.addStructure);
  const removeStructure = useMapStore(s => s.removeStructure);
  const renameStructure = useMapStore(s => s.renameStructure);
  const assignMapToStructure = useMapStore(s => s.assignMapToStructure);
  const removeMapFromStructure = useMapStore(s => s.removeMapFromStructure);
  const setStructureExclusiveFocus = useMapStore(s => s.setStructureExclusiveFocus);

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
  const addRegion = useRegionStore(s => s.addRegion);
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

  const lights      = useIlluminationStore(s => s.lights);
  const addLight = useIlluminationStore(s => s.addLight);
  const removeLight = useIlluminationStore(s => s.removeLight);
  const updateLight = useIlluminationStore(s => s.updateLight);
  // toggleLight: illuminationStore doesn't have a dedicated toggle; we patch enabled field
  const toggleLight = useCallback((id: string) => {
    const l = useIlluminationStore.getState().lights.find(x => x.id === id);
    if (l) useIlluminationStore.getState().updateLight(id, { enabled: !l.enabled });
  }, []);

  const { groups, removeGroup, setGroupLocked, updateGroup, removeMemberFromGroup, addGroup, addMembersToGroup } = useGroupStore();

  // ── Search & sort state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('renderOrder');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Inline rename state ───────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingMapId, setRenamingMapId] = useState<string | null>(null);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'renderOrder' ? 'desc' : 'asc');
    }
  }, [sortField]);

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragItemsRef = useRef<{ id: string; type: TreeEntity['type'] }[]>([]);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);
  const [dropGroupTarget, setDropGroupTarget] = useState<string | null>(null);
  const [dropMapTarget, setDropMapTarget] = useState<string | null>(null);

  // ── Shift-click anchor for range selection ────────────────────────────────
  const lastClickedEntityIdRef = useRef<string | null>(null);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allSelectedIds = useMemo(() => {
    const set = new Set<string>(selectedMapObjectIds);
    selectedTokenIds.forEach(id => set.add(id));
    regions.filter(r => r.selected).forEach(r => set.add(r.id));
    return set;
  }, [selectedMapObjectIds, selectedTokenIds, regions]);

  const handleSelect = useCallback((entity: TreeEntity, additive: boolean, shiftKey?: boolean) => {
    // ── Shift-click range selection ──────────────────────────────────────
    if (shiftKey && lastClickedEntityIdRef.current) {
      const anchorId = lastClickedEntityIdRef.current;
      const entities = allEntitiesRef.current;
      const anchorIdx = entities.findIndex(e => e.id === anchorId);
      const targetIdx = entities.findIndex(e => e.id === entity.id);
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        const rangeEntities = entities.slice(start, end + 1);

        // Additively select all entities in range
        const newTokenIds = new Set(selectedTokenIds);
        const newMapObjIds = new Set(selectedMapObjectIds);

        for (const e of rangeEntities) {
          if (e.type === 'token') {
            newTokenIds.add(e.id);
          } else if (e.type === 'mapObject') {
            selectMapObject(e.id, true);
          } else if (e.type === 'region') {
            selectRegion(e.id);
          }
          // lights don't have selection in stores currently
        }

        setSelectedTokens?.([...newTokenIds]);
        // Don't update anchor on shift-click (keep original anchor)
        return;
      }
    }

    // ── Normal / Ctrl click ─────────────────────────────────────────────
    lastClickedEntityIdRef.current = entity.id;
    const alreadySelected = allSelectedIds.has(entity.id);

    if (entity.type === 'mapObject') {
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
    // Multi-select: if the dragged entity is part of the current selection, drag all selected
    if (allSelectedIds.has(entity.id) && allSelectedIds.size > 1) {
      // Build selected items from stores directly to avoid circular dependency with allEntities
      const items: { id: string; type: TreeEntity['type'] }[] = [];
      allSelectedIds.forEach(id => {
        if (tokens.some(t => t.id === id)) items.push({ id, type: 'token' });
        else if (regions.some(r => r.id === id)) items.push({ id, type: 'region' });
        else if (mapObjects.some(o => o.id === id)) items.push({ id, type: 'mapObject' });
        else if (lights.some(l => l.id === id)) items.push({ id, type: 'light' });
      });
      dragItemsRef.current = items;
    } else {
      dragItemsRef.current = [{ id: entity.id, type: entity.type }];
    }
  }, [allSelectedIds, tokens, regions, mapObjects, lights]);

  const handleDragStartGroup = useCallback((group: EntityGroup) => {
    dragItemsRef.current = group.members.map(m => ({ id: m.id, type: m.type as TreeEntity['type'] }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, target: TreeEntity) => {
    if (dragItemsRef.current.length === 0) return;
    if (dragItemsRef.current.some(d => d.id === target.id)) return;
    if (target.type !== 'mapObject') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';
    setDropTarget({ id: target.id, position });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, target: TreeEntity) => {
    const items = dragItemsRef.current;
    if (items.length !== 1 || items[0].id === target.id || items[0].type !== 'mapObject' || target.type !== 'mapObject') {
      setDropTarget(null);
      dragItemsRef.current = [];
      return;
    }

    const dragged = items[0];
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

    dragItemsRef.current = [];
    setDropTarget(null);
  }, [mapObjects, reorderMapObject, normalizeRenderOrders]);

  const handleDragEnd = useCallback(() => {
    dragItemsRef.current = [];
    setDropTarget(null);
    setDropGroupTarget(null);
    setDropMapTarget(null);
  }, []);

  // ── Drop on group ─────────────────────────────────────────────────────────
  const handleDragOverGroup = useCallback((e: React.DragEvent, groupId: string) => {
    if (dragItemsRef.current.length === 0) return;
    setDropGroupTarget(groupId);
    setDropTarget(null);
    setDropMapTarget(null);
  }, []);

  const handleDragLeaveGroup = useCallback(() => {
    setDropGroupTarget(null);
  }, []);

  const handleDropOnGroup = useCallback((groupId: string) => {
    const items = dragItemsRef.current;
    if (items.length === 0) { setDropGroupTarget(null); return; }

    const group = groups.find(g => g.id === groupId);
    if (!group) { setDropGroupTarget(null); return; }

    const newMembers = items
      .filter(item => !group.members.some(m => m.id === item.id))
      .map(item => ({ id: item.id, type: item.type }));

    if (newMembers.length > 0) {
      addMembersToGroup(groupId, newMembers);
      toast.success(`Added ${newMembers.length} item(s) to "${group.name}"`);
    }

    dragItemsRef.current = [];
    setDropGroupTarget(null);
    setDropTarget(null);
  }, [groups, addMembersToGroup]);

  // ── Drop on map ───────────────────────────────────────────────────────────
  const handleDragOverMap = useCallback((e: React.DragEvent, mapId: string) => {
    if (dragItemsRef.current.length === 0) return;
    setDropMapTarget(mapId);
    setDropTarget(null);
    setDropGroupTarget(null);
  }, []);

  const handleDragLeaveMap = useCallback(() => {
    setDropMapTarget(null);
  }, []);

  const handleDropOnMap = useCallback((mapId: string) => {
    const items = dragItemsRef.current;
    if (items.length === 0) { setDropMapTarget(null); return; }

    items.forEach(item => {
      if (item.type === 'token') {
        useSessionStore.setState(state => ({
          tokens: state.tokens.map(t => t.id === item.id ? { ...t, mapId } : t),
        }));
      } else if (item.type === 'region') {
        updateRegion(item.id, { mapId } as any);
      } else if (item.type === 'mapObject') {
        updateMapObject(item.id, { mapId } as any);
      } else if (item.type === 'light') {
        updateLight(item.id, { mapId } as any);
      }
    });

    const mapName = maps.find(m => m.id === mapId)?.name || 'map';
    toast.success(`Moved ${items.length} item(s) to "${mapName}"`);

    dragItemsRef.current = [];
    setDropMapTarget(null);
    setDropTarget(null);
  }, [maps, updateRegion, updateMapObject, updateLight]);

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
      mapId: (t as any).mapId,
      x: t.x, y: t.y,
      renderOrder: TYPE_NOTIONAL_ORDER.token,
    }));
    regions.forEach(r => entities.push({
      id: r.id, name: r.id.slice(0, 8), type: 'region',
      mapId: (r as any).mapId,
      x: r.x, y: r.y, locked: r.locked,
      renderOrder: TYPE_NOTIONAL_ORDER.region,
    }));
    mapObjects.forEach(o => entities.push({
      id: o.id, name: o.label || o.shape || '', type: 'mapObject',
      mapId: (o as any).mapId,
      x: o.position.x, y: o.position.y, locked: o.locked,
      renderOrder: o.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[o.category] ?? 50,
    }));
    lights.forEach(l => entities.push({
      id: l.id, name: l.label || '', type: 'light',
      mapId: (l as any).mapId,
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

  // Keep a ref in sync for use in handleSelect (defined before allEntities)
  const allEntitiesRef = useRef<TreeEntity[]>([]);
  allEntitiesRef.current = allEntities;

  const groupedEntityIds = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(g => g.members.forEach(m => set.add(m.id)));
    return set;
  }, [groups]);

  const ungroupedEntities = allEntities.filter(e => !groupedEntityIds.has(e.id));

  // ── Group entities by mapId ────────────────────────────────────────────────
  const entitiesByMap = useMemo(() => {
    const byMap: Record<string, TreeEntity[]> = {};
    const unassigned: TreeEntity[] = [];
    allEntities.forEach(e => {
      if (e.mapId) {
        (byMap[e.mapId] ??= []).push(e);
      } else {
        unassigned.push(e);
      }
    });
    return { byMap, unassigned };
  }, [allEntities]);

  // ── Expanded map nodes state ──────────────────────────────────────────────
  const [expandedMapNodes, setExpandedMapNodes] = useState<Set<string>>(new Set());
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  const toggleGroupOpen = useCallback((groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }, []);

  const toggleAllGroupsInMap = useCallback((mapId: string) => {
    const entityIds = new Set((entitiesByMap.byMap[mapId] || []).map(e => e.id));
    const relevantGroupIds = groups
      .filter(g => g.members.some(m => entityIds.has(m.id)))
      .map(g => g.id);
    if (relevantGroupIds.length === 0) return;
    // If any are expanded, collapse all; otherwise expand all
    const anyExpanded = relevantGroupIds.some(id => expandedGroupIds.has(id));
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      relevantGroupIds.forEach(id => anyExpanded ? next.delete(id) : next.add(id));
      return next;
    });
  }, [groups, entitiesByMap, expandedGroupIds]);

  const toggleMapNode = useCallback((mapId: string) => {
    setExpandedMapNodes(prev => {
      const next = new Set(prev);
      next.has(mapId) ? next.delete(mapId) : next.add(mapId);
      return next;
    });
  }, []);
  const mapObjectsForContext = useMemo(() =>
    mapObjects.map(o => ({ id: o.id, renderOrder: o.renderOrder, category: o.category })),
    [mapObjects]
  );

  // Helper to render a list of entities (grouped and ungrouped) for a given set
  const renderEntityList = (entitySet: TreeEntity[]) => {
    const setGroupedIds = new Set<string>();
    groups.forEach(g => g.members.forEach(m => setGroupedIds.add(m.id)));
    const setUngrouped = entitySet.filter(e => !setGroupedIds.has(e.id));

    // Only show groups that have members in this entity set
    const entityIds = new Set(entitySet.map(e => e.id));
    const relevantGroups = groups.filter(g =>
      g.members.some(m => entityIds.has(m.id))
    );

    return (
      <>
        {relevantGroups.map(group => (
          <GroupNode
            key={group.id}
            group={group}
            entities={entitySet}
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
            onDropOnGroup={handleDropOnGroup}
            isDropTarget={dropGroupTarget === group.id}
            onDragOverGroup={handleDragOverGroup}
            onDragLeaveGroup={handleDragLeaveGroup}
            onDragStartGroup={handleDragStartGroup}
            onDragEndGroup={handleDragEnd}
            open={expandedGroupIds.has(group.id)}
            onOpenChange={(isOpen) => {
              setExpandedGroupIds(prev => {
                const next = new Set(prev);
                isOpen ? next.add(group.id) : next.delete(group.id);
                return next;
              });
            }}
          />
        ))}
        {setUngrouped.map(entity => (
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
            draggable
            dropIndicator={dropTarget?.id === entity.id ? dropTarget.position : null}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            contextActions={contextActions}
            mapObjects={mapObjectsForContext}
          />
        ))}
      </>
    );
  };

  // ── Select all / none handlers ─────────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    setSelectedTokens?.(tokens.map(t => t.id));
    regions.forEach(r => selectRegion(r.id));
    mapObjects.forEach(o => selectMapObject(o.id, true));
    toast.success(`Selected ${tokens.length + regions.length + mapObjects.length} entities`);
  }, [tokens, regions, mapObjects, setSelectedTokens, selectRegion, selectMapObject]);

  const handleSelectNone = useCallback(() => {
    setSelectedTokens?.([]);
    regions.forEach(r => deselectRegion(r.id));
    selectedMapObjectIds.forEach(id => deselectMapObject(id));
  }, [setSelectedTokens, regions, deselectRegion, selectedMapObjectIds, deselectMapObject]);

  // ── Duplicate map handler ─────────────────────────────────────────────────
  const handleDuplicateMap = useCallback((sourceMapId: string) => {
    const sourceMap = maps.find(m => m.id === sourceMapId);
    if (!sourceMap) return;

    const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMapId = `map-${genId()}`;

    // Clone the map itself (addMap generates an id, so we create via the store directly)
    // We'll use addMap which auto-generates an id, but we need to know the new id.
    // Instead, directly push into the store:
    const newMap: typeof sourceMap = {
      ...sourceMap,
      id: newMapId,
      name: `${sourceMap.name} (copy)`,
      active: true,
      regions: sourceMap.regions.map(r => ({ ...r, id: `region-${genId()}` })),
    };
    useMapStore.setState(state => ({ maps: [...state.maps, newMap] }));

    // Build id mapping for group cloning
    const idMap = new globalThis.Map<string, string>();

    // Clone tokens on this map
    const mapTokens = tokens.filter(t => t.mapId === sourceMapId);
    mapTokens.forEach(token => {
      const newId = `token-${genId()}`;
      idMap.set(token.id, newId);
      useSessionStore.getState().addToken({ ...token, id: newId, mapId: newMapId });
    });

    // Clone regions (canvas regions) on this map
    const mapRegions = regions.filter(r => r.mapId === sourceMapId);
    mapRegions.forEach(region => {
      const newId = `region-${genId()}`;
      idMap.set(region.id, newId);
      const { id: _id, ...rest } = region;
      addRegion({ ...rest, id: newId, mapId: newMapId } as any);
    });

    // Clone map objects on this map
    const mapMapObjects = mapObjects.filter(o => o.mapId === sourceMapId);
    mapMapObjects.forEach(obj => {
      const newId = `mapobj-${genId()}`;
      idMap.set(obj.id, newId);
      const { id: _id, ...rest } = obj;
      addMapObject({ ...rest, id: newId, selected: false, mapId: newMapId });
    });

    // Clone lights on this map
    const mapLights = lights.filter(l => (l as any).mapId === sourceMapId);
    mapLights.forEach(light => {
      const newId = `light-${genId()}`;
      idMap.set(light.id, newId);
      const { id: _id, ...rest } = light;
      addLight({ ...rest, id: newId, mapId: newMapId } as any);
    });

    // Clone groups whose members are all on this map
    const mapEntityIds = new Set([...mapTokens.map(t => t.id), ...mapRegions.map(r => r.id), ...mapMapObjects.map(o => o.id), ...mapLights.map(l => l.id)]);
    groups.forEach(group => {
      const allOnMap = group.members.every(m => mapEntityIds.has(m.id));
      if (!allOnMap) return;
      const newMembers = group.members
        .map(m => ({ ...m, id: idMap.get(m.id) || m.id }))
        .filter(m => idMap.has(m.id) || mapEntityIds.has(m.id));
      if (newMembers.length > 0) {
        addGroup(`${group.name} (copy)`, newMembers, []);
      }
    });

    // Copy fog settings from source map
    const sourceFog = useFogStore.getState().getMapFogSettings(sourceMapId);
    useFogStore.getState().setMapFogSettings(newMapId, { ...sourceFog });

    setSelectedMap(newMapId);
    toast.success(`Duplicated map "${sourceMap.name}" with ${idMap.size} entities`);
  }, [maps, tokens, regions, mapObjects, lights, groups, addRegion, addMapObject, addLight, addGroup, setSelectedMap]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header ── */}
      <div className="shrink-0 p-2 pb-0 space-y-1 border-b border-border/40 bg-background">
        {/* Summary badges — click to select all of that type */}
        <div className="flex items-center gap-1 flex-wrap mb-1">
          <Badge variant="outline" className="text-[10px]">{maps.length} maps</Badge>
          <Badge
            variant="outline"
            className="text-[10px] cursor-pointer hover:bg-primary/15 hover:border-primary/40 transition-colors"
            onClick={() => {
              setSelectedTokens?.(tokens.map(t => t.id));
              toast.success(`Selected ${tokens.length} token(s)`);
            }}
          >{tokens.length} tokens</Badge>
          <Badge
            variant="outline"
            className="text-[10px] cursor-pointer hover:bg-primary/15 hover:border-primary/40 transition-colors"
            onClick={() => {
              regions.forEach(r => selectRegion(r.id));
              toast.success(`Selected ${regions.length} region(s)`);
            }}
          >{regions.length} regions</Badge>
          <Badge
            variant="outline"
            className="text-[10px] cursor-pointer hover:bg-primary/15 hover:border-primary/40 transition-colors"
            onClick={() => {
              mapObjects.forEach(o => selectMapObject(o.id, true));
              toast.success(`Selected ${mapObjects.length} object(s)`);
            }}
          >{mapObjects.length} objects</Badge>
          <Badge variant="outline" className="text-[10px]">{lights.length} lights</Badge>
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

        {/* Sort controls + Select all/none */}
        <div className="flex items-center gap-1 pb-2">
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

          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSelectAll}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  All
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Select all entities</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSelectNone}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  None
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Deselect all entities</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ── Scrollable entity list ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">

        {/* ── Structure headers + Map nodes ── */}
        {(() => {
          // Group maps: structures first, then unstructured
          const structuredMaps = new globalThis.Map<string, typeof maps>();
          const unstructuredMaps: typeof maps = [];
          maps.forEach(map => {
            if (map.structureId) {
              const list = structuredMaps.get(map.structureId) || [];
              list.push(map);
              structuredMaps.set(map.structureId, list);
            } else {
              unstructuredMaps.push(map);
            }
          });

          // Sort floors within each structure
          structuredMaps.forEach((list, key) => {
            list.sort((a, b) => (a.floorNumber ?? 0) - (b.floorNumber ?? 0));
            structuredMaps.set(key, list);
          });

          const renderMapNode = (map: typeof maps[0], index: number, structureContext?: { maps: typeof maps; structureId: string }) => {
          const isExpanded = expandedMapNodes.has(map.id);
          const isFocused = selectedMapId === map.id;
          const mapEntities = entitiesByMap.byMap[map.id] || [];
          const entityCount = mapEntities.length;
          const isMapDropTarget = dropMapTarget === map.id;

          return (
            <ContextMenu key={map.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    isFocused ? 'border-primary/50 bg-primary/5' : 'border-border/60'
                  } ${isMapDropTarget ? 'ring-2 ring-primary/60 bg-primary/10' : ''}`}
                >
                  {/* Map header */}
                  <div
                    className="flex flex-col gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-accent/30 group"
                    onClick={() => toggleMapNode(map.id)}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleDragOverMap(e, map.id); }}
                    onDragLeave={() => handleDragLeaveMap()}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropOnMap(map.id); }}
                  >
                    {/* Row 1: Name and Badges */}
                    <div className="flex items-center gap-1 w-full min-w-0">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <Map className="h-3.5 w-3.5 shrink-0 text-primary" />

                      {renamingMapId === map.id ? (
                        <div onClick={e => e.stopPropagation()} className="flex-1 min-w-0">
                          <RenameInput
                            value={map.name}
                            onCommit={name => { updateMap(map.id, { name }); setRenamingMapId(null); }}
                            onCancel={() => setRenamingMapId(null)}
                          />
                        </div>
                      ) : (
                        <span className="text-xs font-medium truncate flex-1 text-foreground">{map.name}</span>
                      )}

                      {map.structureId && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0 text-muted-foreground">
                          F{map.floorNumber ?? '?'}
                        </Badge>
                      )}

                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                        {entityCount}
                      </Badge>

                      {/* Texture indicator */}
                      {regions.some(r => r.mapId === map.id && (r.backgroundImage || r.textureHash)) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><Image className="h-3 w-3 shrink-0 text-muted-foreground" /></span>
                          </TooltipTrigger>
                          <TooltipContent side="top">Has textured regions</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Collapse/expand groups within this map */}
                      {(() => {
                        const entityIds = new Set(mapEntities.map(e => e.id));
                        const hasGroups = groups.some(g => g.members.some(m => entityIds.has(m.id)));
                        if (!hasGroups) return null;
                        const relevantGroupIds = groups.filter(g => g.members.some(m => entityIds.has(m.id))).map(g => g.id);
                        const anyExpanded = relevantGroupIds.some(id => expandedGroupIds.has(id));
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-80 transition-opacity"
                                onClick={e => { e.stopPropagation(); toggleAllGroupsInMap(map.id); }}
                              >
                                {anyExpanded
                                  ? <ChevronsUp className="h-3.5 w-3.5" />
                                  : <ChevronsDown className="h-3.5 w-3.5" />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{anyExpanded ? 'Collapse all groups' : 'Expand all groups'}</TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </div>

                    {/* Row 2: Toggles and Actions */}
                    <div className="flex items-center justify-end gap-1.5 w-full pr-1">
                      <div className="flex items-center gap-1 transition-opacity text-muted-foreground" onClick={e => e.stopPropagation()}>
                        {structureContext ? (() => {
                          const sMaps = structureContext.maps;
                          const sIdx = sMaps.findIndex(m => m.id === map.id);
                          return (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    disabled={sIdx <= 0}
                                    onClick={() => {
                                      const prev = sMaps[sIdx - 1];
                                      const curFloor = map.floorNumber ?? sIdx;
                                      const prevFloor = prev.floorNumber ?? (sIdx - 1);
                                      updateMap(map.id, { floorNumber: prevFloor });
                                      updateMap(prev.id, { floorNumber: curFloor });
                                      toast.success('Floor order updated');
                                    }}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Move floor up</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    disabled={sIdx >= sMaps.length - 1}
                                    onClick={() => {
                                      const next = sMaps[sIdx + 1];
                                      const curFloor = map.floorNumber ?? sIdx;
                                      const nextFloor = next.floorNumber ?? (sIdx + 1);
                                      updateMap(map.id, { floorNumber: nextFloor });
                                      updateMap(next.id, { floorNumber: curFloor });
                                      toast.success('Floor order updated');
                                    }}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Move floor down</TooltipContent>
                              </Tooltip>
                            </>
                          );
                        })() : (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  disabled={index === 0}
                                  onClick={() => reorderMaps(index, index - 1)}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Move map up</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  disabled={index >= maps.length - 1}
                                  onClick={() => reorderMaps(index, index + 1)}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Move map down</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>

                      <div className="w-px h-3.5 bg-border mx-1" />

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`shrink-0 p-0.5 rounded transition-colors ${
                              isFocused ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={e => { e.stopPropagation(); setSelectedMap(map.id); }}
                          >
                            <MousePointer2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Set as focused map</TooltipContent>
                      </Tooltip>

                      {/* Fog toggle button */}
                      {(() => {
                        const mapFog = useFogStore.getState().getMapFogSettings(map.id);
                        const isFogOn = mapFog.enabled;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={`shrink-0 p-0.5 rounded transition-colors ${
                                  isFogOn ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={e => {
                                  e.stopPropagation();
                                  const cardStore = useCardStore.getState();
                                  cardStore.registerCard({
                                    type: CardType.FOG,
                                    title: `Fog - ${map.name}`,
                                    defaultPosition: { x: 345, y: 80 },
                                    defaultSize: { width: 350, height: 400 },
                                    defaultVisible: true,
                                    metadata: { targetMapId: map.id, targetLabel: map.name },
                                  });
                                }}
                              >
                                {isFogOn ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{isFogOn ? 'Fog enabled — click to open fog controls' : 'Fog disabled — click to open fog controls'}</TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Active toggle */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div onClick={e => e.stopPropagation()} className="ml-1 transition-opacity">
                            <Switch
                              checked={map.active}
                              onCheckedChange={(checked) => updateMap(map.id, { active: checked })}
                              className="scale-[0.7]"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">{map.active ? 'Active — rendered' : 'Inactive — hidden'}</TooltipContent>
                    </Tooltip>
                    </div>
                  </div>

                  {/* Map children */}
                  {isExpanded && (
                    <div className="px-1 pb-1.5">
                      {entityCount === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2 italic">No entities on this map</p>
                      ) : (
                        renderEntityList(mapEntities)
                      )}
                    </div>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52 text-xs">
                {/* Focus */}
                <ContextMenuItem
                  className="text-xs gap-2"
                  onClick={() => setSelectedMap(map.id)}
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                  Set as Focused Map
                </ContextMenuItem>

                <ContextMenuSeparator />

                {/* Rename */}
                <ContextMenuItem
                  className="text-xs gap-2"
                  onClick={() => setRenamingMapId(map.id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </ContextMenuItem>

                {/* Toggle active */}
                <ContextMenuItem
                  className="text-xs gap-2"
                  onClick={() => updateMap(map.id, { active: !map.active })}
                >
                  {map.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {map.active ? 'Deactivate' : 'Activate'}
                </ContextMenuItem>

                {/* Expand / Collapse */}
                <ContextMenuItem
                  className="text-xs gap-2"
                  onClick={() => toggleMapNode(map.id)}
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {isExpanded ? 'Collapse' : 'Expand'}
                </ContextMenuItem>

                {/* Reorder */}
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="text-xs gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Reorder
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-44 text-xs">
                    <ContextMenuItem className="text-xs gap-2" disabled={index === 0} onClick={() => reorderMaps(index, 0)}>
                      <ChevronsUp className="h-3.5 w-3.5" />
                      Move to Top
                    </ContextMenuItem>
                    <ContextMenuItem className="text-xs gap-2" disabled={index === 0} onClick={() => reorderMaps(index, index - 1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                      Move Up
                    </ContextMenuItem>
                    <ContextMenuItem className="text-xs gap-2" disabled={index >= maps.length - 1} onClick={() => reorderMaps(index, index + 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                      Move Down
                    </ContextMenuItem>
                    <ContextMenuItem className="text-xs gap-2" disabled={index >= maps.length - 1} onClick={() => reorderMaps(index, maps.length - 1)}>
                      <ChevronsDown className="h-3.5 w-3.5" />
                      Move to Bottom
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>

                {/* Structure / Floor assignment */}
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="text-xs gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Structure
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-52 text-xs">
                    {map.structureId && (
                      <>
                        <ContextMenuItem
                          className="text-xs gap-2"
                          onClick={() => removeMapFromStructure(map.id)}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Remove from Structure
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="text-xs gap-2"
                          onClick={() => {
                            const floor = prompt('Floor number:', String(map.floorNumber ?? 1));
                            if (floor !== null) updateMap(map.id, { floorNumber: parseInt(floor) || 1 });
                          }}
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" />
                          Set Floor Number ({map.floorNumber ?? '?'})
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                      </>
                    )}
                    {structures.map(s => (
                      <ContextMenuItem
                        key={s.id}
                        className="text-xs gap-2"
                        disabled={map.structureId === s.id}
                        onClick={() => assignMapToStructure(map.id, s.id)}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {map.structureId === s.id ? `✓ ${s.name}` : s.name}
                      </ContextMenuItem>
                    ))}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-xs gap-2"
                      onClick={() => {
                        const name = prompt('New structure name:', 'Building');
                        if (name) {
                          const sid = addStructure(name);
                          assignMapToStructure(map.id, sid);
                          toast.success(`Created structure "${name}"`);
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Structure…
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>

                {/* Duplicate */}
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-xs gap-2"
                  onClick={() => handleDuplicateMap(map.id)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate Map
                </ContextMenuItem>

                {/* Delete */}
                {maps.length > 1 && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-xs gap-2 text-destructive focus:text-destructive"
                      onClick={() => {
                        const ents = entitiesByMap.byMap[map.id] || [];
                        ents.forEach(e => {
                          if (e.type === 'token') removeToken(e.id);
                          if (e.type === 'region') removeRegion(e.id);
                          if (e.type === 'mapObject') removeMapObject(e.id);
                          if (e.type === 'light') removeLight(e.id);
                        });
                        removeMap(map.id);
                        toast.success(`Deleted map "${map.name}" and ${ents.length} entities`);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Map
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
          };

          return (
            <>
              {/* Structures */}
              {structures.map(structure => {
                const structMaps = structuredMaps.get(structure.id);
                if (!structMaps || structMaps.length === 0) return null;
                return (
                  <div key={structure.id} className="space-y-1">
                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 truncate">
                        {structure.name}
                      </span>
                      {/* Structure fog button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              const cardStore = useCardStore.getState();
                              cardStore.registerCard({
                                type: CardType.FOG,
                                title: `Fog - ${structure.name}`,
                                defaultPosition: { x: 345, y: 80 },
                                defaultSize: { width: 350, height: 400 },
                                defaultVisible: true,
                                metadata: { isStructureMode: true, structureId: structure.id, targetLabel: structure.name },
                              });
                            }}
                          >
                            <Cloud className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Open fog controls for entire structure</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="text-[10px] text-muted-foreground hover:text-destructive"
                            onClick={() => { removeStructure(structure.id); toast.success(`Removed structure "${structure.name}"`); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete structure</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              const name = prompt('Rename structure:', structure.name);
                              if (name) renameStructure(structure.id, name);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Rename structure</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`text-[10px] ${structure.exclusiveFocus ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground`}
                            onClick={() => {
                              setStructureExclusiveFocus(structure.id, !structure.exclusiveFocus);
                              toast.success(structure.exclusiveFocus ? 'Exclusive focus disabled' : 'Exclusive focus enabled');
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{structure.exclusiveFocus ? 'Exclusive focus ON — only the focused floor is active' : 'Exclusive focus OFF — multiple floors can be active'}</TooltipContent>
                      </Tooltip>
                    </div>
                    {structMaps.map((map) => {
                      const globalIdx = maps.findIndex(m => m.id === map.id);
                      return renderMapNode(map, globalIdx, { maps: structMaps, structureId: structure.id });
                    })}
                  </div>
                );
              })}

              {/* Unstructured maps */}
              {unstructuredMaps.map((map) => {
                const globalIdx = maps.findIndex(m => m.id === map.id);
                return renderMapNode(map, globalIdx);
              })}
            </>
          );
        })()}

        {/* ── Unassigned entities ── */}
        {entitiesByMap.unassigned.length > 0 && (
          <div className="border border-dashed border-border/60 rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-accent/30"
              onClick={() => setUnassignedExpanded(!unassignedExpanded)}
            >
              {unassignedExpanded
                ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="text-xs font-medium text-muted-foreground flex-1">Unassigned</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                {entitiesByMap.unassigned.length}
              </Badge>
              <div onClick={e => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive ml-1"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to permanently delete ${entitiesByMap.unassigned.length} detached entities? This cannot be undone.`)) {
                      entitiesByMap.unassigned.forEach(e => {
                        if (e.type === 'token') removeToken(e.id);
                        if (e.type === 'region') removeRegion(e.id);
                        if (e.type === 'mapObject') removeMapObject(e.id);
                        if (e.type === 'light') removeLight(e.id);
                      });
                      toast.success(`Cleaned up ${entitiesByMap.unassigned.length} detached entities`);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clean Up All
                </Button>
              </div>
            </div>
            {unassignedExpanded && (
              <div className="px-1 pb-1.5">
                {renderEntityList(entitiesByMap.unassigned)}
              </div>
            )}
          </div>
        )}

        {allEntities.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {searchQuery ? `No entities match "${searchQuery}".` : 'No entities on the map yet.'}
          </p>
        )}
      </div>
    </ScrollArea>
    </div>
  );
};
