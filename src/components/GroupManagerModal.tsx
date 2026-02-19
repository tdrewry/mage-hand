/**
 * Group Manager Modal
 * 
 * Universal group management for tokens, regions, map objects, and lights.
 * Allows creating, managing, and transforming entity groups.
 */

import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { 
  Users, 
  Plus, 
  Trash2, 
  Lock, 
  Unlock,
  Eye,
  EyeOff,
  CircleDot,
  Square,
  Layers,
  Lightbulb,
} from 'lucide-react';

import { useGroupStore } from '../stores/groupStore';
import { useSessionStore } from '../stores/sessionStore';
import { useRegionStore } from '../stores/regionStore';
import { useMapObjectStore } from '../stores/mapObjectStore';
import { useLightStore } from '../stores/lightStore';
import { EntityGroup, GroupMember, EntityType, EntityGeometry } from '../lib/groupTransforms';

const ENTITY_TYPE_ICON: Record<EntityType, React.ReactNode> = {
  token: <CircleDot className="w-3 h-3" />,
  region: <Square className="w-3 h-3" />,
  mapObject: <Layers className="w-3 h-3" />,
  light: <Lightbulb className="w-3 h-3" />,
};

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  token: 'Token',
  region: 'Region',
  mapObject: 'Map Object',
  light: 'Light',
};

interface GroupManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  open,
  onOpenChange
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);

  const { 
    groups, 
    selectedGroupIds,
    addGroup, 
    removeGroup, 
    updateGroup,
    selectGroup,
    deselectGroup,
    clearGroupSelection,
    isEntityInAnyGroup,
  } = useGroupStore();

  const { tokens } = useSessionStore();
  const { regions } = useRegionStore();
  const { mapObjects } = useMapObjectStore();
  const { lights } = useLightStore();

  // Entities not yet in any group
  const availableEntities = useMemo(() => {
    const available: { member: GroupMember; label: string }[] = [];
    
    tokens.forEach(t => {
      if (!isEntityInAnyGroup(t.id)) {
        available.push({ member: { id: t.id, type: 'token' }, label: t.label || t.name });
      }
    });
    regions.forEach(r => {
      if (!isEntityInAnyGroup(r.id)) {
        available.push({ member: { id: r.id, type: 'region' }, label: `Region ${r.id.slice(-4)}` });
      }
    });
    mapObjects.forEach(o => {
      if (!isEntityInAnyGroup(o.id)) {
        available.push({ member: { id: o.id, type: 'mapObject' }, label: o.label || o.category });
      }
    });
    lights.forEach(l => {
      if (!isEntityInAnyGroup(l.id)) {
        available.push({ member: { id: l.id, type: 'light' }, label: l.label || `Light ${l.id.slice(-4)}` });
      }
    });
    
    return available;
  }, [tokens, regions, mapObjects, lights, isEntityInAnyGroup, groups]);

  const getGeometryForMember = (m: GroupMember): EntityGeometry => {
    if (m.type === 'token') {
      const t = tokens.find(x => x.id === m.id);
      return t ? { id: t.id, x: t.x, y: t.y, width: t.gridWidth * 50, height: t.gridHeight * 50 } : { id: m.id, x: 0, y: 0, width: 50, height: 50 };
    }
    if (m.type === 'region') {
      const r = regions.find(x => x.id === m.id);
      return r ? { id: r.id, x: r.x, y: r.y, width: r.width, height: r.height } : { id: m.id, x: 0, y: 0, width: 100, height: 100 };
    }
    if (m.type === 'mapObject') {
      const o = mapObjects.find(x => x.id === m.id);
      return o ? { id: o.id, x: o.position.x, y: o.position.y, width: o.width, height: o.height } : { id: m.id, x: 0, y: 0, width: 50, height: 50 };
    }
    if (m.type === 'light') {
      const l = lights.find(x => x.id === m.id);
      return l ? { id: l.id, x: l.position.x - l.radius, y: l.position.y - l.radius, width: l.radius * 2, height: l.radius * 2 } : { id: m.id, x: 0, y: 0, width: 50, height: 50 };
    }
    return { id: m.id, x: 0, y: 0, width: 50, height: 50 };
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedMembers.length < 2) {
      toast.error('Groups must contain at least 2 entities');
      return;
    }

    try {
      const geometries = selectedMembers.map(getGeometryForMember);
      const group = addGroup(newGroupName, selectedMembers, geometries);
      toast.success(`Group "${group.name}" created with ${selectedMembers.length} members`);
      setNewGroupName('');
      setSelectedMembers([]);
    } catch (error) {
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    removeGroup(groupId);
    toast.success(`Group "${group.name}" deleted`);
  };

  const handleToggleGroupLock = (group: EntityGroup) => {
    updateGroup(group.id, { locked: !group.locked });
    toast.success(`Group "${group.name}" ${group.locked ? 'unlocked' : 'locked'}`);
  };

  const handleToggleGroupVisibility = (group: EntityGroup) => {
    updateGroup(group.id, { visible: !group.visible });
    toast.success(`Group "${group.name}" ${group.visible ? 'hidden' : 'shown'}`);
  };

  const toggleMemberSelection = (member: GroupMember) => {
    setSelectedMembers(prev => {
      const exists = prev.some(m => m.id === member.id);
      return exists ? prev.filter(m => m.id !== member.id) : [...prev, member];
    });
  };

  const getMemberLabel = (member: GroupMember): string => {
    if (member.type === 'token') {
      const t = tokens.find(x => x.id === member.id);
      return t?.label || t?.name || member.id.slice(-6);
    }
    if (member.type === 'region') return `Region ${member.id.slice(-4)}`;
    if (member.type === 'mapObject') {
      const o = mapObjects.find(x => x.id === member.id);
      return o?.label || o?.category || member.id.slice(-6);
    }
    if (member.type === 'light') {
      const l = lights.find(x => x.id === member.id);
      return l?.label || `Light ${member.id.slice(-4)}`;
    }
    return member.id.slice(-6);
  };

  const getMemberCountsByType = (group: EntityGroup) => {
    const counts: Partial<Record<EntityType, number>> = {};
    group.members.forEach(m => { counts[m.type] = (counts[m.type] || 0) + 1; });
    return counts;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Group Manager
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create New Group */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create New Group
              </CardTitle>
              <CardDescription>
                Group tokens, regions, map objects, and lights together
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Room Encounter, Trap Assembly..."
                />
              </div>

              <div className="space-y-2">
                <Label>Select Entities ({selectedMembers.length} selected)</Label>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {availableEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      All entities are already grouped
                    </p>
                  ) : (
                    availableEntities.map(({ member, label }) => (
                      <div
                        key={member.id}
                        className="flex items-center space-x-2 py-1 cursor-pointer hover:bg-accent/50 rounded px-1"
                        onClick={() => toggleMemberSelection(member)}
                      >
                        <Checkbox
                          checked={selectedMembers.some(m => m.id === member.id)}
                          onCheckedChange={() => toggleMemberSelection(member)}
                        />
                        <span className="text-muted-foreground">{ENTITY_TYPE_ICON[member.type]}</span>
                        <span className="text-sm flex-1">{label}</span>
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_TYPE_LABEL[member.type]}
                        </Badge>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>

              <Button 
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || selectedMembers.length < 2}
                className="w-full"
              >
                Create Group
              </Button>
            </CardContent>
          </Card>

          {/* Existing Groups */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Groups ({groups.length})</CardTitle>
              <CardDescription>
                Manage your entity groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {groups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No groups created yet</p>
                    <p className="text-sm">Create your first group to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groups.map(group => {
                      const isSelected = selectedGroupIds.includes(group.id);
                      const counts = getMemberCountsByType(group);

                      return (
                        <Card 
                          key={group.id}
                          className={`p-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-accent' : ''
                          }`}
                          onClick={() => isSelected ? deselectGroup(group.id) : selectGroup(group.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{group.name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {group.members.length} members
                                </Badge>
                                {group.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                                {!group.visible && <EyeOff className="w-3 h-3 text-muted-foreground" />}
                              </div>

                              <div className="flex flex-wrap gap-1 mb-1">
                                {Object.entries(counts).map(([type, count]) => (
                                  <Badge key={type} variant="outline" className="text-xs gap-1">
                                    {ENTITY_TYPE_ICON[type as EntityType]}
                                    {count} {ENTITY_TYPE_LABEL[type as EntityType]}{count! > 1 ? 's' : ''}
                                  </Badge>
                                ))}
                              </div>

                              <div className="text-xs text-muted-foreground">
                                {group.members.slice(0, 4).map(m => getMemberLabel(m)).join(', ')}
                                {group.members.length > 4 && ` +${group.members.length - 4} more`}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 ml-2">
                              <Button variant="ghost" size="sm"
                                onClick={(e) => { e.stopPropagation(); handleToggleGroupVisibility(group); }}
                                title={group.visible ? 'Hide group' : 'Show group'}>
                                {group.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </Button>
                              <Button variant="ghost" size="sm"
                                onClick={(e) => { e.stopPropagation(); handleToggleGroupLock(group); }}
                                title={group.locked ? 'Unlock group' : 'Lock group'}>
                                {group.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </Button>
                              <Button variant="ghost" size="sm"
                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                className="text-destructive hover:text-destructive"
                                title="Delete group">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {selectedGroupIds.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex gap-2 items-center">
                    <p className="text-sm font-medium">
                      {selectedGroupIds.length} group(s) selected
                    </p>
                    <Button variant="outline" size="sm" onClick={clearGroupSelection}>
                      Clear Selection
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
