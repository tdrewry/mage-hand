/**
 * Group Manager Modal
 * 
 * Demonstrates the enhanced group transformation system
 * Allows users to create, manage, and transform token groups
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { 
  Users, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Move, 
  Lock, 
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';

import { useGroupStore } from '../stores/groupStore';
import { useSessionStore } from '../stores/sessionStore';
import { TokenGroup } from '../lib/groupTransforms';

interface GroupManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  open,
  onOpenChange
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);

  const { 
    groups, 
    selectedGroupIds,
    addGroup, 
    removeGroup, 
    updateGroup,
    selectGroup,
    deselectGroup,
    clearGroupSelection
  } = useGroupStore();

  const { tokens, selectedTokenIds: sessionSelectedTokenIds } = useSessionStore();

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    const tokensToGroup = selectedTokenIds.length > 0 
      ? selectedTokenIds 
      : sessionSelectedTokenIds;

    if (tokensToGroup.length === 0) {
      toast.error('Please select tokens to group');
      return;
    }

    if (tokensToGroup.length === 1) {
      toast.error('Groups must contain at least 2 tokens');
      return;
    }

    try {
      const group = addGroup(newGroupName, tokensToGroup);
      toast.success(`Group \"${group.name}\" created with ${tokensToGroup.length} tokens`);
      setNewGroupName('');
      setSelectedTokenIds([]);
    } catch (error) {
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (!confirm(`Delete group \"${group.name}\"? Tokens will remain but lose their group association.`)) {
      return;
    }

    removeGroup(groupId);
    toast.success(`Group \"${group.name}\" deleted`);
  };

  const handleToggleGroupLock = (group: TokenGroup) => {
    updateGroup(group.id, { locked: !group.locked });
    toast.success(`Group \"${group.name}\" ${group.locked ? 'unlocked' : 'locked'}`);
  };

  const handleToggleGroupVisibility = (group: TokenGroup) => {
    updateGroup(group.id, { visible: !group.visible });
    toast.success(`Group \"${group.name}\" ${group.visible ? 'hidden' : 'shown'}`);
  };

  const handleTokenSelectionChange = (tokenId: string, selected: boolean) => {
    if (selected) {
      setSelectedTokenIds(prev => [...prev, tokenId]);
    } else {
      setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
    }
  };

  const getTokensNotInGroups = () => {
    const groupedTokenIds = new Set(groups.flatMap(g => g.tokenIds));
    return tokens.filter(token => !groupedTokenIds.has(token.id));
  };

  const getTokensByIds = (tokenIds: string[]) => {
    return tokens.filter(token => tokenIds.includes(token.id));
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
                Group selected tokens for easier management and transformation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="My Token Group"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Tokens to Group</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {getTokensNotInGroups().map(token => (
                    <div key={token.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id={`token-${token.id}`}
                        checked={selectedTokenIds.includes(token.id)}
                        onChange={(e) => handleTokenSelectionChange(token.id, e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor={`token-${token.id}`} className="text-sm flex-1 cursor-pointer">
                        {token.label || token.name}
                      </label>
                    </div>
                  ))}
                  {getTokensNotInGroups().length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">
                      All tokens are already grouped
                    </p>
                  )}
                </ScrollArea>
              </div>

              <Button 
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || selectedTokenIds.length < 2}
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
                Manage your token groups and their properties
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
                      const groupTokens = getTokensByIds(group.tokenIds);
                      const isSelected = selectedGroupIds.includes(group.id);

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
                                  {group.tokenIds.length} tokens
                                </Badge>
                                {group.locked && (
                                  <Lock className="w-3 h-3 text-muted-foreground" />
                                )}
                                {!group.visible && (
                                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>

                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>Tokens: {groupTokens.map(t => t.label || t.name).join(', ')}</p>
                                <div className="flex items-center gap-4">
                                  <span>Position: ({Math.round(group.bounds.x)}, {Math.round(group.bounds.y)})</span>
                                  <span>Size: {Math.round(group.bounds.width)}×{Math.round(group.bounds.height)}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleGroupVisibility(group);
                                }}
                                title={group.visible ? 'Hide group' : 'Show group'}
                              >
                                {group.visible ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <EyeOff className="w-3 h-3" />
                                )}
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleGroupLock(group);
                                }}
                                title={group.locked ? 'Unlock group' : 'Lock group'}
                              >
                                {group.locked ? (
                                  <Lock className="w-3 h-3" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteGroup(group.id);
                                }}
                                className="text-destructive hover:text-destructive"
                                title="Delete group"
                              >
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
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {selectedGroupIds.length} group(s) selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearGroupSelection}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={true}
                        title="Transform operations would be available in the main canvas"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Transform
                      </Button>
                    </div>
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
