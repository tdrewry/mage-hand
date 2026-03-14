import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Group, Trash2, X, Lock, Unlock, Ungroup, Download,
  Shield, Eye, EyeOff, Plus, Palette, Lightbulb, Sparkles, Dices 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSessionStore } from '@/stores/sessionStore';
import { useGroupStore } from '@/stores/groupStore';
import { useRegionStore } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { useRoleStore } from '@/stores/roleStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { canAssignTokenRoles } from '@/lib/rolePermissions';
import { GroupMember, EntityGeometry } from '@/lib/groupTransforms';
import { exportGroupToPrefab, downloadPrefab } from '@/lib/groupSerializer';
import { toast } from 'sonner';
import { Z_INDEX } from '@/lib/zIndex';
import { TokenIlluminationModal } from './modals/TokenIlluminationModal';
import { getSelectablePresets, presetToIlluminationSource, type PresetKey } from '@/lib/illuminationPresets';
import { cn } from '@/lib/utils';
import { useUiStateStore } from '@/stores/uiStateStore';

interface BottomNavbarProps {
  onClearSelection: () => void;
  onUpdateCanvas?: () => void;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  onClearSelection,
  onUpdateCanvas
}) => {
  const { 
    tokens, currentPlayerId, players, removeToken, updateTokenIllumination,
    selectedTokenIds, selectedRegionIds, selectedMapObjectIds, selectedLightIds
  } = useSessionStore();
  
  const { isFocusMode } = useUiStateStore();

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');

  const addGroup = useGroupStore((s) => s.addGroup);
  const groups = useGroupStore((s) => s.groups);
  const selectedGroupIds = useGroupStore((s) => s.selectedGroupIds);
  const removeGroup = useGroupStore((s) => s.removeGroup);
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const setGroupLocked = useGroupStore((s) => s.setGroupLocked);
  const clearGroupSelection = useGroupStore((s) => s.clearGroupSelection);
  const getGroupForEntity = useGroupStore((s) => s.getGroupForEntity);

  const { roles } = useRoleStore();
  const { addToInitiative } = useInitiativeStore();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [initiativeValues, setInitiativeValues] = useState<Record<string, string>>({});
  const [showColorModal, setShowColorModal] = useState(false);
  const [colorValue, setColorValue] = useState('#FF6B6B');
  const [showIlluminationModal, setShowIlluminationModal] = useState(false);

  const selectedTokens = tokens.filter(t => selectedTokenIds.includes(t.id));
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const canAssignRoles = currentPlayer && canAssignTokenRoles(currentPlayer, roles);

  const activeGroups = useMemo(() => {
    const allSelectedIds = [...selectedTokenIds, ...selectedRegionIds, ...selectedMapObjectIds, ...selectedLightIds];
    const groupIdSet = new Set<string>();
    for (const id of allSelectedIds) {
      const g = getGroupForEntity(id);
      if (g) groupIdSet.add(g.id);
    }
    for (const gid of selectedGroupIds) {
      groupIdSet.add(gid);
    }
    return groups.filter(g => groupIdSet.has(g.id));
  }, [selectedTokenIds, selectedRegionIds, selectedMapObjectIds, selectedLightIds, selectedGroupIds, groups, getGroupForEntity]);

  const entityCount = selectedTokenIds.length + selectedRegionIds.length + selectedMapObjectIds.length + selectedLightIds.length;
  const groupCount = activeGroups.length;
  const totalCount = entityCount + groupCount;

  const showBar = entityCount > 0 || groupCount > 0;
  if (!showBar) return null;

  const parts: string[] = [];
  if (selectedTokenIds.length > 0) parts.push(`${selectedTokenIds.length} token${selectedTokenIds.length !== 1 ? 's' : ''}`);
  if (selectedRegionIds.length > 0) parts.push(`${selectedRegionIds.length} region${selectedRegionIds.length !== 1 ? 's' : ''}`);
  if (selectedMapObjectIds.length > 0) parts.push(`${selectedMapObjectIds.length} object${selectedMapObjectIds.length !== 1 ? 's' : ''}`);
  if (selectedLightIds.length > 0) parts.push(`${selectedLightIds.length} light${selectedLightIds.length !== 1 ? 's' : ''}`);
  if (groupCount > 0) parts.push(`${groupCount} group${groupCount !== 1 ? 's' : ''}`);

  // --- Group Actions ---
  const handleCreateGroup = () => {
    const name = groupName.trim() || `Group ${Date.now()}`;
    const members: GroupMember[] = [];
    const geometries: EntityGeometry[] = [];

    const currentTokens = useSessionStore.getState().tokens;
    const currentRegions = useRegionStore.getState().regions;
    const currentMapObjects = useMapObjectStore.getState().mapObjects;
    const currentLights = useLightStore.getState().lights;

    selectedTokenIds.forEach((id) => {
      members.push({ id, type: 'token' });
      const t = currentTokens.find((tok) => tok.id === id);
      if (t) geometries.push({ id, x: t.x, y: t.y, width: (t.gridWidth || 1) * 40, height: (t.gridHeight || 1) * 40 });
    });

    selectedRegionIds.forEach((id) => {
      members.push({ id, type: 'region' });
      const r = currentRegions.find((reg) => reg.id === id);
      if (r) geometries.push({ id, x: r.x, y: r.y, width: r.width, height: r.height });
    });

    selectedMapObjectIds.forEach((id) => {
      members.push({ id, type: 'mapObject' });
      const obj = currentMapObjects.find((o) => o.id === id);
      if (obj) geometries.push({ id, x: obj.position.x, y: obj.position.y, width: obj.width || 40, height: obj.height || 40 });
    });

    selectedLightIds.forEach((id) => {
      members.push({ id, type: 'light' });
      const l = currentLights.find((lt) => lt.id === id);
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

  const singleGroup = activeGroups.length === 1 ? activeGroups[0] : null;

  const handleToggleLock = () => {
    if (!singleGroup) return;
    setGroupLocked(singleGroup.id, !singleGroup.locked);
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
      const currentTokens = useSessionStore.getState().tokens;
      const currentRegions = useRegionStore.getState().regions;
      const currentMapObjects = useMapObjectStore.getState().mapObjects;
      const currentLights = useLightStore.getState().lights;
      const prefab = await exportGroupToPrefab(singleGroup, currentTokens, currentRegions, currentMapObjects, currentLights);
      downloadPrefab(prefab);
      toast.success(`Exported "${singleGroup.name}" as prefab`);
    } catch (e) {
      toast.error('Failed to export prefab');
    }
  };

  // --- Token Actions ---
  const handleAssignRole = (roleId: string) => {
    if (!canAssignRoles) {
      toast.error("You don't have permission to assign roles");
      return;
    }
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) => t.id === token.id ? { ...t, roleId } : t),
      }));
    });
    onUpdateCanvas?.();
    toast.success(`Assigned ${selectedTokens.length} token(s) to ${role.name}`);
  };
  
  const handleToggleHidden = (hide: boolean) => {
    if (!canAssignRoles) {
      toast.error("You don't have permission to hide/show tokens");
      return;
    }
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) => t.id === token.id ? { ...t, isHidden: hide } : t),
      }));
    });
    onUpdateCanvas?.();
    toast.success(`${hide ? 'Hidden' : 'Shown'} ${selectedTokens.length} token(s)`);
  };
  
  const handleToggleVision = (enabled: boolean) => {
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) => t.id === token.id ? { ...t, hasVision: enabled } : t),
      }));
    });
    onUpdateCanvas?.();
    toast.success(`Vision ${enabled ? 'enabled' : 'disabled'} for ${selectedTokens.length} token(s)`);
  };
  
  const handleApplyIlluminationPreset = (presetKey: PresetKey) => {
    const presets = getSelectablePresets();
    const presetEntry = presets.find(p => p.key === presetKey);
    if (!presetEntry) return;
    const illuminationSettings = presetToIlluminationSource(presetEntry.preset);
    selectedTokens.forEach(token => {
      updateTokenIllumination(token.id, illuminationSettings);
    });
    onUpdateCanvas?.();
    toast.success(`Applied ${presetEntry.preset.icon} ${presetEntry.preset.name} to ${selectedTokens.length} token(s)`);
  };

  const handleRollOne = (tokenId: string) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setInitiativeValues(prev => ({ ...prev, [tokenId]: roll.toString() }));
  };

  const handleRollAll = () => {
    const newValues: Record<string, string> = {};
    selectedTokens.forEach(token => {
      newValues[token.id] = String(Math.floor(Math.random() * 20) + 1);
    });
    setInitiativeValues(newValues);
  };
  
  const handleApplyInitiative = () => {
    let count = 0;
    selectedTokens.forEach(token => {
      const raw = initiativeValues[token.id];
      const value = raw !== undefined ? parseInt(raw) : NaN;
      if (!isNaN(value)) {
        addToInitiative(token.id, value);
        count++;
      }
    });
    if (count === 0) {
      toast.error('Please enter at least one initiative value');
      return;
    }
    setShowInitiativeModal(false);
    setInitiativeValues({});
    toast.success(`Added ${count} token(s) to initiative`);
  };

  const handleApplyColor = () => {
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) => t.id === token.id ? { ...t, color: colorValue } : t),
      }));
    });
    setShowColorModal(false);
    onUpdateCanvas?.();
    toast.success(`Color updated for ${selectedTokens.length} token(s)`);
  };

  // --- Deletion & Clearing ---
  const handleDeleteConfirm = () => {
    // Collect all tokens, regions, objects, and lights to delete
    // Currently implementation mainly maps to tokens due to store API limits out of box,
    // but we can at least remove tokens.
    selectedTokens.forEach(token => {
      removeToken(token.id);
    });
    
    // For other entities, we would call their respective store removals...
    
    setShowDeleteModal(false);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success(`Deleted ${selectedTokens.length} token(s)`); // Adjust msg if deleting other entities
  };

  const handleClear = () => {
    onClearSelection();
    clearGroupSelection();
  };

  return (
    <>
      <div 
        className={cn(
          "fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-6 h-14 pointer-events-auto transition-transform duration-300 slide-in-from-bottom-full animate-in fade-in"
        )}
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        {/* Left Side: Info */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground">
            {totalCount} Selected
          </span>
          <span className="text-xs text-muted-foreground bg-white/5 rounded-md px-2 py-1 border border-white/10 hidden sm:inline-block">
            {parts.join(', ')}
          </span>
        </div>

        {/* Center: Context Actions */}
        <div className="flex items-center justify-center flex-1 gap-2 flex-wrap">
          
          {/* Grouping UI */}
          {singleGroup && (
            <>
              <span className="text-xs font-semibold text-primary px-2 truncate max-w-[120px]" title={singleGroup.name}>
                {singleGroup.name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleToggleLock} title={singleGroup.locked ? 'Unlock group' : 'Lock group'}>
                {singleGroup.locked ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                {singleGroup.locked ? 'Unlock' : 'Lock'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleUngroup} title="Dissolve group (keep members)">
                <Ungroup className="h-4 w-4 mr-2" />
                Ungroup
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportPrefab} title="Export group as prefab">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <div className="h-4 w-px bg-white/10 mx-2" />
            </>
          )}

          {!singleGroup && entityCount >= 2 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowGroupDialog(true)}>
                <Group className="h-4 w-4 mr-2" />
                Group
              </Button>
              <div className="h-4 w-px bg-white/10 mx-2" />
            </>
          )}

          {/* Token UI */}
          {selectedTokens.length > 0 && (
            <>
              {canAssignRoles && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Shield className="h-4 w-4 mr-2" />
                      Role
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 bg-background/95 backdrop-blur border-white/10" side="top">
                    {roles.map((role) => (
                      <DropdownMenuItem key={role.id} onClick={() => handleAssignRole(role.id)}>
                        <div className="mr-2 h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                        <span className="flex-1">{role.name}</span>
                        {role.isSystem && <span className="text-xs text-muted-foreground ml-2">System</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {canAssignRoles && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Vis
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-background/95 backdrop-blur border-white/10" side="top">
                    <DropdownMenuItem onClick={() => handleToggleHidden(true)}>
                      <EyeOff className="h-4 w-4 mr-2" /> Hide All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleHidden(false)}>
                      <Eye className="h-4 w-4 mr-2" /> Show All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-background/95 backdrop-blur border-white/10" side="top">
                  <DropdownMenuItem onClick={() => setShowIlluminationModal(true)}>
                    <Lightbulb className="h-4 w-4 mr-2" /> Custom Settings...
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {getSelectablePresets().map(({ key, preset }) => (
                    <DropdownMenuItem key={key} onClick={() => handleApplyIlluminationPreset(key)}>
                      <span className="mr-2 text-base">{preset.icon}</span>
                      <span className="flex-1">{preset.name}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleToggleVision(true)}>
                    <Eye className="h-4 w-4 mr-2" /> Enable Vision
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleVision(false)}>
                    <EyeOff className="h-4 w-4 mr-2" /> Disable Vision
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="ghost" size="sm" onClick={() => setShowColorModal(true)}>
                <Palette className="h-4 w-4 mr-2" /> Color
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => setShowInitiativeModal(true)}>
                <Plus className="h-4 w-4 mr-2" /> Init
              </Button>
              
              <div className="h-4 w-px bg-white/10 mx-2" />
            </>
          )}

          {/* Delete Action */}
          <Button 
            variant="ghost" 
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Right Side: Clear */}
        <div className="flex items-center flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClear}
            className="rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* --- Modals --- */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="border-white/10 bg-background/95 backdrop-blur shadow-2xl">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Group {entityCount} selected entities ({parts.join(', ')}) together for unified selection.
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
                className="bg-black/20 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)} className="border-white/10">Cancel</Button>
            <Button onClick={handleCreateGroup}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="border-white/10 bg-background/95 backdrop-blur shadow-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {totalCount} selected items? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-white/10">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showInitiativeModal} onOpenChange={(open) => { setShowInitiativeModal(open); if (!open) setInitiativeValues({}); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto border-white/10 bg-background/95 backdrop-blur shadow-2xl">
          <DialogHeader>
            <DialogTitle>Add to Initiative</DialogTitle>
            <DialogDescription>Set individual initiative values for {selectedTokens.length} token(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleRollAll} className="border-white/10">
                <Dices className="h-3.5 w-3.5 mr-1.5" /> Roll All d20
              </Button>
            </div>
            <div className="space-y-2">
              {selectedTokens.map(token => (
                <div key={token.id} className="flex items-center gap-3 p-2 rounded-lg border border-white/10 bg-black/20">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-border overflow-hidden">
                    {token.imageUrl ? (
                      <img src={token.imageUrl} alt={token.label || token.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ backgroundColor: token.color || '#888' }} />
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium truncate">{token.label || token.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Input
                      type="number" placeholder="d20"
                      value={initiativeValues[token.id] ?? ''}
                      onChange={e => setInitiativeValues(prev => ({ ...prev, [token.id]: e.target.value }))}
                      className="w-16 h-7 text-center text-sm p-0 px-1 border-white/10 bg-black/40"
                    />
                    <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 hover:bg-white/10" onClick={() => handleRollOne(token.id)}>
                      <Dices className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowInitiativeModal(false); setInitiativeValues({}); }} className="border-white/10">Cancel</Button>
            <Button onClick={handleApplyInitiative}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showColorModal} onOpenChange={setShowColorModal}>
        <DialogContent className="border-white/10 bg-background/95 backdrop-blur shadow-2xl">
          <DialogHeader>
            <DialogTitle>Change Color</DialogTitle>
            <DialogDescription>Set color for {selectedTokens.length} token(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="token-color">Token Color</Label>
              <div className="flex gap-2">
                <Input id="token-color" type="color" value={colorValue} onChange={(e) => setColorValue(e.target.value)} className="h-10 p-1 border-white/10 bg-black/20" />
                <Input type="text" value={colorValue} onChange={(e) => setColorValue(e.target.value)} placeholder="#FF6B6B" className="border-white/10 bg-black/20" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColorModal(false)} className="border-white/10">Cancel</Button>
            <Button onClick={handleApplyColor}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <TokenIlluminationModal
        open={showIlluminationModal}
        onOpenChange={setShowIlluminationModal}
        tokenIds={selectedTokenIds}
        currentIllumination={selectedTokens[0]?.illuminationSources?.[0]}
        onApply={(settings) => {
          selectedTokens.forEach((token) => {
            updateTokenIllumination(token.id, settings);
          });
          onUpdateCanvas?.();
          toast.success(`Updated illumination for ${selectedTokens.length} token(s)`);
        }}
      />
    </>
  );
};
