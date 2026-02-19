import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Unlock, Ungroup, FileDown, Pencil, X } from 'lucide-react';
import { useGroupStore } from '@/stores/groupStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { exportGroupToPrefab } from '@/lib/groupSerializer';
import { Z_INDEX } from '@/lib/zIndex';
import { toast } from 'sonner';

interface GroupControlBarProps {
  onUpdateCanvas?: () => void;
}

export const GroupControlBar: React.FC<GroupControlBarProps> = ({ onUpdateCanvas }) => {
  const groups = useGroupStore((s) => s.groups);
  const getGroupForEntity = useGroupStore((s) => s.getGroupForEntity);
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const removeGroup = useGroupStore((s) => s.removeGroup);

  const selectedTokenIds = useSessionStore((s) => s.tokens.filter(t => t.id).map(t => t.id)); // not ideal, but we need to detect
  const selectedMapObjectIds = useMapObjectStore((s) => s.selectedMapObjectIds);
  const selectedLightIds = useLightStore((s) => s.selectedLightIds);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Find the active group: check if any currently-selected entity belongs to a group
  // We check all selected entities to find a common group
  const findActiveGroup = () => {
    // Check selected tokens first
    const allTokens = useSessionStore.getState().tokens;
    const allRegions = useRegionStore.getState().regions;
    
    for (const id of selectedMapObjectIds) {
      const g = getGroupForEntity(id);
      if (g) return g;
    }
    for (const id of selectedLightIds) {
      const g = getGroupForEntity(id);
      if (g) return g;
    }
    // Check regions
    for (const r of allRegions) {
      if (r.selected) {
        const g = getGroupForEntity(r.id);
        if (g) return g;
      }
    }
    return null;
  };

  const activeGroup = findActiveGroup();
  if (!activeGroup) return null;

  const handleToggleLock = () => {
    updateGroup(activeGroup.id, { locked: !activeGroup.locked });
    toast.success(activeGroup.locked ? 'Group unlocked' : 'Group locked');
    onUpdateCanvas?.();
  };

  const handleUngroup = () => {
    removeGroup(activeGroup.id);
    toast.success(`Ungrouped "${activeGroup.name}"`);
    onUpdateCanvas?.();
  };

  const handleExport = () => {
    exportGroupToPrefab(activeGroup.id);
  };

  const handleStartRename = () => {
    setRenameValue(activeGroup.name);
    setIsRenaming(true);
  };

  const handleFinishRename = () => {
    const name = renameValue.trim();
    if (name && name !== activeGroup.name) {
      updateGroup(activeGroup.id, { name });
      toast.success(`Renamed to "${name}"`);
    }
    setIsRenaming(false);
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg px-2 py-1.5"
      style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
    >
      <div className="flex items-center gap-1">
        {/* Group name / rename */}
        {isRenaming ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={(e) => e.key === 'Enter' && handleFinishRename()}
            className="h-6 w-32 text-xs"
            autoFocus
          />
        ) : (
          <button
            onClick={handleStartRename}
            className="flex items-center gap-1 text-xs font-medium text-foreground px-1.5 hover:text-primary transition-colors"
          >
            <span>{activeGroup.name}</span>
            <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        )}

        <div className="h-4 w-px bg-border" />

        <span className="text-xs text-muted-foreground px-1">
          {activeGroup.members.length} items
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Lock / Unlock */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleToggleLock}
        >
          {activeGroup.locked ? (
            <><Lock className="h-3 w-3 mr-1" /> Locked</>
          ) : (
            <><Unlock className="h-3 w-3 mr-1" /> Unlocked</>
          )}
        </Button>

        <div className="h-4 w-px bg-border" />

        {/* Export as Prefab */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleExport}
        >
          <FileDown className="h-3 w-3 mr-1" />
          Export
        </Button>

        {/* Ungroup */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleUngroup}
        >
          <Ungroup className="h-3 w-3 mr-1" />
          Ungroup
        </Button>
      </div>
    </div>
  );
};
