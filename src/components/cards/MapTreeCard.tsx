import React, { useMemo, useState, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Lock, LockOpen, CircleDot, Square,
  Lightbulb, Box, FolderOpen, Folder, Trash2, Pencil, Check, X,
  Plus, ArrowRightFromLine,
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
import { toast } from 'sonner';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const entityTypeIcon: Record<string, React.ReactNode> = {
  token:     <CircleDot className="h-3.5 w-3.5 text-primary" />,
  region:    <Square    className="h-3.5 w-3.5 text-accent-foreground" />,
  mapObject: <Box       className="h-3.5 w-3.5 text-muted-foreground" />,
  light:     <Lightbulb className="h-3.5 w-3.5 text-foreground" />,
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

// ─── Entity row (inside or outside a group) ────────────────────────────────────
function EntityRow({
  entity,
  depth = 0,
  groupId,
  onToggleLock,
  onEjectFromGroup,
  onAddToNewGroup,
}: {
  entity: TreeEntity;
  depth?: number;
  groupId?: string;
  onToggleLock?: (entity: TreeEntity) => void;
  onEjectFromGroup?: (groupId: string, entityId: string) => void;
  onAddToNewGroup?: (entity: TreeEntity) => void;
}) {
  const canLock = entity.type === 'region' || entity.type === 'mapObject';

  return (
    <div
      className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-accent/50 cursor-default text-xs group"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
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
  );
}

// ─── Group node ────────────────────────────────────────────────────────────────
function GroupNode({
  group,
  entities,
  onDelete,
  onToggleLock,
  onToggleEntityLock,
  onRename,
  onEjectFromGroup,
}: {
  group: EntityGroup;
  entities: TreeEntity[];
  onDelete: (groupId: string) => void;
  onToggleLock: (group: EntityGroup) => void;
  onToggleEntityLock: (entity: TreeEntity) => void;
  onRename: (groupId: string, name: string) => void;
  onEjectFromGroup: (groupId: string, entityId: string) => void;
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
            onToggleLock={onToggleEntityLock}
            onEjectFromGroup={onEjectFromGroup}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Card content ──────────────────────────────────────────────────────────────
export const MapTreeCardContent: React.FC = () => {
  const tokens      = useSessionStore(s => s.tokens);
  const regions     = useRegionStore(s => s.regions);
  const updateRegion = useRegionStore(s => s.updateRegion);
  const mapObjects  = useMapObjectStore(s => s.mapObjects);
  const updateMapObject = useMapObjectStore(s => s.updateMapObject);
  const lights      = useLightStore(s => s.lights);
  const { groups, removeGroup, setGroupLocked, updateGroup, removeMemberFromGroup, addGroup } = useGroupStore();

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  /**
   * Eject an entity from its group.
   * If the group has only 1 member after removal it's dissolved entirely.
   */
  const handleEjectFromGroup = (groupId: string, entityId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.members.length <= 2) {
      // Dissolving: a 1-member group is meaningless
      removeGroup(groupId);
      toast.info('Group dissolved — too few members remaining');
    } else {
      removeMemberFromGroup(groupId, entityId);
      toast.success('Entity removed from group');
    }
  };

  /**
   * Create a new group from a single ungrouped entity.
   * The user gives the group a name; more entities can be added later via marquee + "Create Group".
   */
  const handleAddToNewGroup = (entity: TreeEntity) => {
    const name = prompt('New group name:', 'Group');
    if (!name) return;

    // Build geometry for bounds calculation
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

  // ── Build flat entity list ─────────────────────────────────────────────────
  const allEntities = useMemo<TreeEntity[]>(() => {
    const entities: TreeEntity[] = [];
    tokens.forEach(t => entities.push({
      id: t.id, name: t.name || t.label || '', type: 'token',
      x: t.x, y: t.y,
    }));
    regions.forEach(r => entities.push({
      id: r.id, name: r.id.slice(0, 8), type: 'region',
      x: r.x, y: r.y, locked: r.locked,
    }));
    mapObjects.forEach(o => entities.push({
      id: o.id, name: o.label || o.shape || '', type: 'mapObject',
      x: o.position.x, y: o.position.y, locked: o.locked,
    }));
    lights.forEach(l => entities.push({
      id: l.id, name: l.label || '', type: 'light',
      x: l.position.x, y: l.position.y,
    }));
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

        {/* ── Groups ── */}
        {groups.map(group => (
          <GroupNode
            key={group.id}
            group={group}
            entities={allEntities}
            onDelete={handleDeleteGroup}
            onToggleLock={handleToggleGroupLock}
            onToggleEntityLock={handleToggleEntityLock}
            onRename={handleRenameGroup}
            onEjectFromGroup={handleEjectFromGroup}
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
            onToggleLock={handleToggleEntityLock}
            onAddToNewGroup={handleAddToNewGroup}
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
