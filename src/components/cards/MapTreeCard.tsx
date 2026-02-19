import React, { useMemo, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { useGroupStore } from '@/stores/groupStore';
import { ChevronRight, ChevronDown, Circle, Square, Lightbulb, Users, MapPin, Layers, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Unified tree node representing any canvas entity
interface TreeNode {
  id: string;
  label: string;
  type: 'region' | 'token' | 'mapObject' | 'light' | 'group';
  zIndex: number;
  children: TreeNode[];
  groupId?: string;
  isSelected?: boolean;
  position?: { x: number; y: number };
}

const ICON_MAP = {
  region: Square,
  token: Circle,
  mapObject: MapPin,
  light: Sun,
  group: Users,
} as const;

const TYPE_COLORS: Record<string, string> = {
  region: 'text-blue-400',
  token: 'text-green-400',
  mapObject: 'text-amber-400',
  light: 'text-yellow-300',
  group: 'text-purple-400',
};

function TreeNodeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const Icon = ICON_MAP[node.type] || Layers;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-1 rounded text-xs hover:bg-accent/50 cursor-default select-none',
          node.isSelected && 'bg-accent'
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon className={cn('h-3 w-3 shrink-0', TYPE_COLORS[node.type])} />
        <span className="truncate flex-1 text-foreground">{node.label}</span>
        {node.groupId && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">
            grp
          </Badge>
        )}
        <span className="text-muted-foreground text-[9px] tabular-nums shrink-0">
          z:{node.zIndex}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export const MapTreeCardContent: React.FC = () => {
  const tokens = useSessionStore((s) => s.tokens);
  const selectedTokenIds = useSessionStore((s) => s.selectedTokenIds);
  const regions = useRegionStore((s) => s.regions);
  const mapObjects = useMapObjectStore((s) => s.mapObjects);
  const selectedMapObjectIds = useMapObjectStore((s) => s.selectedMapObjectIds);
  const lights = useLightStore((s) => s.lights);
  const selectedLightIds = useLightStore((s) => s.selectedLightIds);
  const groups = useGroupStore((s) => s.groups);
  const getGroupForEntity = useGroupStore((s) => s.getGroupForEntity);

  const tree = useMemo(() => {
    // Build flat list of all entities with approximate z-order
    const allEntities: TreeNode[] = [];

    // Regions: z ~5000 base, order by array index
    regions.forEach((r, i) => {
      allEntities.push({
        id: r.id,
        label: `Region ${i + 1}`,
        type: 'region',
        zIndex: 5000 + i,
        children: [],
        groupId: getGroupForEntity(r.id)?.id,
        isSelected: r.selected,
        position: { x: r.x, y: r.y },
      });
    });

    // Map objects: z ~10000
    mapObjects.forEach((mo, i) => {
      allEntities.push({
        id: mo.id,
        label: mo.label || mo.shape || `Object ${i + 1}`,
        type: 'mapObject',
        zIndex: 10000 + i,
        children: [],
        groupId: getGroupForEntity(mo.id)?.id,
        isSelected: selectedMapObjectIds.includes(mo.id),
        position: mo.position,
      });
    });

    // Tokens: z ~20000
    tokens.forEach((t, i) => {
      allEntities.push({
        id: t.id,
        label: t.label || t.name || `Token ${i + 1}`,
        type: 'token',
        zIndex: 20000 + i,
        children: [],
        groupId: getGroupForEntity(t.id)?.id,
        isSelected: selectedTokenIds?.includes(t.id),
        position: { x: t.x, y: t.y },
      });
    });

    // Lights: z ~28000
    lights.forEach((l, i) => {
      allEntities.push({
        id: l.id,
        label: l.label || `Light ${i + 1}`,
        type: 'light',
        zIndex: 28000 + i,
        children: [],
        groupId: getGroupForEntity(l.id)?.id,
        isSelected: selectedLightIds.includes(l.id),
        position: l.position,
      });
    });

    // Sort by z-index
    allEntities.sort((a, b) => a.zIndex - b.zIndex);

    // Build spatial hierarchy: nest entities inside regions that contain them
    const regionNodes = allEntities.filter((e) => e.type === 'region');
    const nonRegionNodes = allEntities.filter((e) => e.type !== 'region');

    // For each non-region entity, check if it falls within a region's bounds
    const assignedIds = new Set<string>();

    for (const entity of nonRegionNodes) {
      if (!entity.position) continue;
      // Find innermost (highest z-index) region containing this entity
      for (let i = regionNodes.length - 1; i >= 0; i--) {
        const region = regions.find((r) => r.id === regionNodes[i].id);
        if (!region) continue;
        const pos = entity.position;
        if (
          pos.x >= region.x &&
          pos.x <= region.x + region.width &&
          pos.y >= region.y &&
          pos.y <= region.y + region.height
        ) {
          regionNodes[i].children.push(entity);
          assignedIds.add(entity.id);
          break;
        }
      }
    }

    // Collect unassigned entities
    const rootNodes: TreeNode[] = [];
    for (const node of allEntities) {
      if (node.type === 'region' || !assignedIds.has(node.id)) {
        rootNodes.push(node);
      }
    }

    // Re-sort root nodes by z-index
    rootNodes.sort((a, b) => a.zIndex - b.zIndex);

    return rootNodes;
  }, [tokens, regions, mapObjects, lights, groups, selectedTokenIds, selectedMapObjectIds, selectedLightIds, getGroupForEntity]);

  const totalCount = tokens.length + regions.length + mapObjects.length + lights.length;

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">Canvas Entities</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {totalCount}
        </Badge>
      </div>

      {/* Groups summary */}
      {groups.length > 0 && (
        <div className="px-1 pb-1 border-b border-border">
          <span className="text-[10px] text-muted-foreground">
            {groups.length} group{groups.length !== 1 ? 's' : ''} ({groups.reduce((acc, g) => acc + g.members.length, 0)} members)
          </span>
        </div>
      )}

      {totalCount === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No entities on canvas</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-0">
          {tree.map((node) => (
            <TreeNodeRow key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
};
