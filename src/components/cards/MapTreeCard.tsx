import React, { useMemo } from 'react';
import { ChevronRight, ChevronDown, Lock, CircleDot, Square, Lightbulb, Box, FolderOpen, Folder, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { useGroupStore } from '@/stores/groupStore';
import { EntityGroup } from '@/lib/groupTransforms';
import { toast } from 'sonner';

// Icon map for entity types
const entityTypeIcon: Record<string, React.ReactNode> = {
  token: <CircleDot className="h-3.5 w-3.5 text-primary" />,
  region: <Square className="h-3.5 w-3.5 text-accent-foreground" />,
  mapObject: <Box className="h-3.5 w-3.5 text-muted-foreground" />,
  light: <Lightbulb className="h-3.5 w-3.5 text-foreground" />,
};

interface TreeEntity {
  id: string;
  name: string;
  type: 'token' | 'region' | 'mapObject' | 'light';
  groupId?: string;
  x: number;
  y: number;
  zIndex?: number;
}

function getEntityName(entity: TreeEntity): string {
  return entity.name || `${entity.type}-${entity.id.slice(-4)}`;
}

function EntityRow({ entity, depth = 0 }: { entity: TreeEntity; depth?: number }) {
  return (
    <div
      className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer text-xs"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      {entityTypeIcon[entity.type] || <Box className="h-3.5 w-3.5" />}
      <span className="truncate flex-1 text-foreground">{getEntityName(entity)}</span>
      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
        {entity.type}
      </Badge>
    </div>
  );
}

function GroupNode({ group, entities, onDelete }: { group: EntityGroup; entities: TreeEntity[]; onDelete: (groupId: string) => void }) {
  const [open, setOpen] = React.useState(true);
  const memberEntities = entities.filter(e => 
    group.members.some(m => m.id === e.id && m.type === e.type)
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-0.5">
        <CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer text-xs flex-1 text-left">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {open ? <FolderOpen className="h-3.5 w-3.5 text-primary" /> : <Folder className="h-3.5 w-3.5 text-primary" />}
          <span className="truncate flex-1 font-medium text-foreground">{group.name}</span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {memberEntities.length}
          </Badge>
          {group.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(group.id);
          }}
          title="Delete group (keeps members)"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <CollapsibleContent>
        {memberEntities.map(entity => (
          <EntityRow key={`${entity.type}-${entity.id}`} entity={entity} depth={1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const MapTreeCardContent: React.FC = () => {
  const tokens = useSessionStore(s => s.tokens);
  const regions = useRegionStore(s => s.regions);
  const mapObjects = useMapObjectStore(s => s.mapObjects);
  const lights = useLightStore(s => s.lights);
  const groups = useGroupStore(s => s.groups);
  const removeGroup = useGroupStore(s => s.removeGroup);

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    removeGroup(groupId);
    toast.success(`Group "${group?.name || 'Unknown'}" dissolved (members kept)`);
  };

  const allEntities = useMemo<TreeEntity[]>(() => {
    const entities: TreeEntity[] = [];

    tokens.forEach(t => entities.push({
      id: t.id, name: t.name || t.label || '', type: 'token',
      x: t.x, y: t.y, zIndex: 0,
    }));

    regions.forEach(r => entities.push({
      id: r.id, name: r.id.slice(0, 8), type: 'region',
      x: r.x, y: r.y, zIndex: 0,
    }));

    mapObjects.forEach(o => entities.push({
      id: o.id, name: o.label || o.shape || '', type: 'mapObject',
      x: o.position.x, y: o.position.y, zIndex: 0,
    }));

    lights.forEach(l => entities.push({
      id: l.id, name: l.label || '', type: 'light',
      x: l.position.x, y: l.position.y, zIndex: 0,
    }));

    return entities;
  }, [tokens, regions, mapObjects, lights]);

  // Entities that belong to a group
  const groupedEntityIds = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(g => g.members.forEach(m => set.add(m.id)));
    return set;
  }, [groups]);

  const ungroupedEntities = allEntities.filter(e => !groupedEntityIds.has(e.id));

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {/* Summary */}
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <Badge variant="outline" className="text-[10px]">{tokens.length} tokens</Badge>
          <Badge variant="outline" className="text-[10px]">{regions.length} regions</Badge>
          <Badge variant="outline" className="text-[10px]">{mapObjects.length} objects</Badge>
          <Badge variant="outline" className="text-[10px]">{lights.length} lights</Badge>
        </div>

        {/* Groups */}
        {groups.map(group => (
          <GroupNode key={group.id} group={group} entities={allEntities} onDelete={handleDeleteGroup} />
        ))}

        {/* Ungrouped entities */}
        {ungroupedEntities.length > 0 && groups.length > 0 && (
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
            Ungrouped
          </div>
        )}
        {ungroupedEntities.map(entity => (
          <EntityRow key={`${entity.type}-${entity.id}`} entity={entity} />
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
