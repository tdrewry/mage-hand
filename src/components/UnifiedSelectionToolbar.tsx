import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Group, Trash2, X, Lock, Unlock, Ungroup, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGroupStore } from '@/stores/groupStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { GroupMember, EntityGeometry } from '@/lib/groupTransforms';
import { exportGroupToPrefab, downloadPrefab } from '@/lib/groupSerializer';
import { Z_INDEX } from '@/lib/zIndex';
import { toast } from 'sonner';

interface UnifiedSelectionToolbarProps {
  selectedTokenIds: string[];
  selectedRegionIds: string[];
  selectedMapObjectIds: string[];
  selectedLightIds: string[];
  onClearAll: () => void;
}

export const UnifiedSelectionToolbar: React.FC<UnifiedSelectionToolbarProps> = ({
  selectedTokenIds,
  selectedRegionIds,
  selectedMapObjectIds,
  selectedLightIds,
  onClearAll,
}) => {
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');

  const addGroup = useGroupStore((s) => s.addGroup);
  const groups = useGroupStore((s) => s.groups);
  const selectedGroupIds = useGroupStore((s) => s.selectedGroupIds);
  const removeGroup = useGroupStore((s) => s.removeGroup);
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const clearGroupSelection = useGroupStore((s) => s.clearGroupSelection);
  const getGroupForEntity = useGroupStore((s) => s.getGroupForEntity);

  // Determine which unique groups are represented by the current selection
  const activeGroups = useMemo(() => {
    const allSelectedIds = [...selectedTokenIds, ...selectedRegionIds, ...selectedMapObjectIds, ...selectedLightIds];
    const groupIdSet = new Set<string>();
    for (const id of allSelectedIds) {
      const g = getGroupForEntity(id);
      if (g) groupIdSet.add(g.id);
    }
    // Also include explicitly selected groups
    for (const gid of selectedGroupIds) {
      groupIdSet.add(gid);
    }
    return groups.filter(g => groupIdSet.has(g.id));
  }, [selectedTokenIds, selectedRegionIds, selectedMapObjectIds, selectedLightIds, selectedGroupIds, groups, getGroupForEntity]);

  const entityCount =
    selectedTokenIds.length +
    selectedRegionIds.length +
    selectedMapObjectIds.length +
    selectedLightIds.length;

  const groupCount = activeGroups.length;
  const totalCount = entityCount + groupCount;

  // Count how many distinct entity types are selected (including groups)
  const typeCount = [
    selectedTokenIds.length > 0,
    selectedRegionIds.length > 0,
    selectedMapObjectIds.length > 0,
    selectedLightIds.length > 0,
    groupCount > 0,
  ].filter(Boolean).length;

  // Show toolbar when multiple types OR a group is active
  const showBar = typeCount >= 2 || groupCount > 0;
  if (!showBar) return null;

  const parts: string[] = [];
  if (selectedTokenIds.length > 0) parts.push(`${selectedTokenIds.length} token${selectedTokenIds.length !== 1 ? 's' : ''}`);
  if (selectedRegionIds.length > 0) parts.push(`${selectedRegionIds.length} region${selectedRegionIds.length !== 1 ? 's' : ''}`);
  if (selectedMapObjectIds.length > 0) parts.push(`${selectedMapObjectIds.length} object${selectedMapObjectIds.length !== 1 ? 's' : ''}`);
  if (selectedLightIds.length > 0) parts.push(`${selectedLightIds.length} light${selectedLightIds.length !== 1 ? 's' : ''}`);
  if (groupCount > 0) parts.push(`${groupCount} group${groupCount !== 1 ? 's' : ''}`);

  const handleCreateGroup = () => {
    const name = groupName.trim() || `Group ${Date.now()}`;
    const members: GroupMember[] = [];
    const geometries: EntityGeometry[] = [];

    const tokens = useSessionStore.getState().tokens;
    const regions = useRegionStore.getState().regions;
    const mapObjects = useMapObjectStore.getState().mapObjects;
    const lights = useLightStore.getState().lights;

    selectedTokenIds.forEach((id) => {
      members.push({ id, type: 'token' });
      const t = tokens.find((tok) => tok.id === id);
      if (t) geometries.push({ id, x: t.x, y: t.y, width: (t.gridWidth || 1) * 40, height: (t.gridHeight || 1) * 40 });
    });

    selectedRegionIds.forEach((id) => {
      members.push({ id, type: 'region' });
      const r = regions.find((reg) => reg.id === id);
      if (r) geometries.push({ id, x: r.x, y: r.y, width: r.width, height: r.height });
    });

    selectedMapObjectIds.forEach((id) => {
      members.push({ id, type: 'mapObject' });
      const obj = mapObjects.find((o) => o.id === id);
      if (obj) geometries.push({ id, x: obj.position.x, y: obj.position.y, width: obj.width || 40, height: obj.height || 40 });
    });

    selectedLightIds.forEach((id) => {
      members.push({ id, type: 'light' });
      const l = lights.find((lt) => lt.id === id);
      if (l) geometries.push({ id, x: l.position.x, y: l.position.y, width: 30, height: 30 });
    });

    if (members.length < 2) {
      toast.error('Need at least 2 entities to create a group');
      return;
    }

    addGroup(name, members, geometries);
    setShowGroupDialog(false);
    setGroupName('');
    toast.success(`Created group "${name}" with ${members.length} members`);
  };

  // --- Group control actions (when exactly 1 group is active) ---
  const singleGroup = activeGroups.length === 1 ? activeGroups[0] : null;

  const handleToggleLock = () => {
    if (!singleGroup) return;
    updateGroup(singleGroup.id, { locked: !singleGroup.locked });
    toast.success(singleGroup.locked ? 'Group unlocked' : 'Group locked');
  };

  const handleUngroup = () => {
    if (!singleGroup) return;
    removeGroup(singleGroup.id);
    clearGroupSelection();
    toast.success(`Dissolved group "${singleGroup.name}"`);
  };

  const handleExportPrefab = async () => {
    if (!singleGroup) return;
    try {
      const tokens = useSessionStore.getState().tokens;
      const regions = useRegionStore.getState().regions;
      const mapObjects = useMapObjectStore.getState().mapObjects;
      const lights = useLightStore.getState().lights;
      const prefab = await exportGroupToPrefab(singleGroup, tokens, regions, mapObjects, lights);
      downloadPrefab(prefab);
      toast.success(`Exported "${singleGroup.name}" as prefab`);
    } catch (e) {
      toast.error('Failed to export prefab');
    }
  };

  const handleClear = () => {
    onClearAll();
    clearGroupSelection();
  };

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg px-2 py-1.5"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground px-1.5">
            {totalCount} selected ({parts.join(', ')})
          </span>

          <div className="h-4 w-px bg-border" />

          {/* Group control section when a single group is selected */}
          {singleGroup && (
            <>
              <span className="text-xs font-semibold text-primary px-1.5 truncate max-w-[120px]" title={singleGroup.name}>
                {singleGroup.name}
              </span>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleToggleLock}
                title={singleGroup.locked ? 'Unlock group' : 'Lock group'}
              >
                {singleGroup.locked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                {singleGroup.locked ? 'Unlock' : 'Lock'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleUngroup}
                title="Dissolve group (keep members)"
              >
                <Ungroup className="h-3 w-3 mr-1" />
                Ungroup
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleExportPrefab}
                title="Export group as .d20prefab"
              >
                <Download className="h-3 w-3 mr-1" />
                Export Prefab
              </Button>

              <div className="h-4 w-px bg-border" />
            </>
          )}

          {/* Create group button (when no single group, i.e. ungrouped multi-select) */}
          {!singleGroup && typeCount >= 2 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowGroupDialog(true)}
              >
                <Group className="h-3 w-3 mr-1" />
                Create Group
              </Button>
              <div className="h-4 w-px bg-border" />
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleClear}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Group {entityCount} selected entities ({parts.join(', ')}) together for unified selection and transformation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Treasure Room"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
