import React, { useMemo, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { useGroupStore } from '@/stores/groupStore';
import { ChevronRight, ChevronDown, Circle, Square, MapPin, Users, Layers, Sun, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TreeNode {
  id: string;
  label: string;
  type: 'region' | 'token' | 'mapObject' | 'light' | 'group';
  zIndex: number;
  children: TreeNode[];
  groupId?: string;
  isSelected?: boolean;
  isLocked?: boolean;
  position?: { x: number; y: number };
  memberCount?: number;
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
  const [expanded, setExpanded] = useState(node.type === 'region');
  const hasChildren = node.children.length > 0;
  const Icon = ICON_MAP[node.type] || Layers;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-1 rounded text-xs hover:bg-accent/50 cursor-default select-none',
          node.isSelected && 'bg-accent',
          node.type === 'group' && 'bg-accent/20'
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
        {node.isLocked && (
          <Lock className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
        )}
        {node.type === 'group' && !expanded && node.memberCount != null && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
            {node.memberCount}
          </Badge>
        )}
        {node.type !== 'group' && (
          <span className="text-muted-foreground text-[9px] tabular-nums shrink-0">
            z:{node.zIndex}
          </span>
        )}
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

  const tree = useMemo(() => {
    // Helper to build a node for any entity
    const makeNode = (
      id: string, label: string, type: TreeNode['type'],
      zIndex: number, position?: { x: number; y: number },
      isSelected?: boolean, isLocked?: boolean
    ): TreeNode => ({ id, label, type, zIndex, children: [], position, isSelected, isLocked });

    // Build entity lookup
    const entityNodes = new Map<string, TreeNode>();

    regions.forEach((r, i) => {
      const n = makeNode(r.id, `Region ${i + 1}`, 'region', 5000 + i,
        { x: r.x, y: r.y }, r.selected, r.locked);
      entityNodes.set(r.id, n);
    });

    mapObjects.forEach((mo, i) => {
      const n = makeNode(mo.id, mo.label || mo.shape || `Object ${i + 1}`, 'mapObject',
        10000 + i, mo.position, selectedMapObjectIds.includes(mo.id));
      entityNodes.set(mo.id, n);
    });

    tokens.forEach((t, i) => {
      const n = makeNode(t.id, t.label || t.name || `Token ${i + 1}`, 'token',
        20000 + i, { x: t.x, y: t.y }, selectedTokenIds?.includes(t.id));
      entityNodes.set(t.id, n);
    });

    lights.forEach((l, i) => {
      const n = makeNode(l.id, l.label || `Light ${i + 1}`, 'light',
        28000 + i, l.position, selectedLightIds.includes(l.id));
      entityNodes.set(l.id, n);
    });

    // Track which entities are consumed by groups
    const groupedIds = new Set<string>();

    // Build group nodes
    const groupNodes: TreeNode[] = groups.map((g) => {
      const memberNodes: TreeNode[] = [];
      let minZ = Infinity;
      for (const member of g.members) {
        const node = entityNodes.get(member.id);
        if (node) {
          memberNodes.push(node);
          groupedIds.add(member.id);
          if (node.zIndex < minZ) minZ = node.zIndex;
        }
      }
      memberNodes.sort((a, b) => a.zIndex - b.zIndex);
      const anySelected = memberNodes.some((n) => n.isSelected);
      return {
        id: g.id,
        label: g.name,
        type: 'group' as const,
        zIndex: minZ === Infinity ? 0 : minZ,
        children: memberNodes,
        isSelected: anySelected,
        isLocked: g.locked,
        memberCount: memberNodes.length,
      };
    });

    // Collect ungrouped entities
    const ungrouped: TreeNode[] = [];
    entityNodes.forEach((node, id) => {
      if (!groupedIds.has(id)) ungrouped.push(node);
    });

    // Merge groups + ungrouped, sort by z
    const allRoot = [...ungrouped, ...groupNodes].sort((a, b) => a.zIndex - b.zIndex);

    // Spatial nesting: nest ungrouped non-region items inside regions
    const regionRoots = allRoot.filter((n) => n.type === 'region');
    const assignedIds = new Set<string>();

    for (const node of allRoot) {
      if (node.type === 'region' || node.type === 'group') continue;
      if (!node.position) continue;
      for (let i = regionRoots.length - 1; i >= 0; i--) {
        const region = regions.find((r) => r.id === regionRoots[i].id);
        if (!region) continue;
        if (
          node.position.x >= region.x &&
          node.position.x <= region.x + region.width &&
          node.position.y >= region.y &&
          node.position.y <= region.y + region.height
        ) {
          regionRoots[i].children.push(node);
          regionRoots[i].children.sort((a, b) => a.zIndex - b.zIndex);
          assignedIds.add(node.id);
          break;
        }
      }
    }

    return allRoot.filter((n) => n.type === 'region' || n.type === 'group' || !assignedIds.has(n.id));
  }, [tokens, regions, mapObjects, lights, groups, selectedTokenIds, selectedMapObjectIds, selectedLightIds]);

  const totalCount = tokens.length + regions.length + mapObjects.length + lights.length;

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">Canvas Entities</span>
        <div className="flex items-center gap-1">
          {groups.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {groups.length} grp{groups.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {totalCount}
          </Badge>
        </div>
      </div>

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
