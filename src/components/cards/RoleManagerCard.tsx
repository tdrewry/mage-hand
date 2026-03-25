import { useState } from 'react';
import { useRoleStore, Role } from '@/stores/roleStore';
import { useSessionStore } from '@/stores/sessionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Shield, Users, Swords, Copy } from 'lucide-react';

interface EditingRole extends Omit<Role, 'id' | 'isSystem'> {
  id?: string;
  isSystem?: boolean;
}

const RoleManagerCard = () => {
  const { roles, addRole, updateRole, removeRole, setHostility } = useRoleStore();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hostilityDialogOpen, setHostilityDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<EditingRole | null>(null);
  const [selectedRoleForHostility, setSelectedRoleForHostility] = useState<Role | null>(null);

  const currentPlayerId = useSessionStore(s => s.currentPlayerId);
  const players = useSessionStore(s => s.players);
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isSelfLockoutRisk = (roleId?: string) => {
    // Determine if this exact role currently grants the player manage Roles permission.
    if (!roleId || !currentPlayer) return false;
    return currentPlayer.roleIds.includes(roleId);
  };

  const startCreateRole = () => {
    setEditingRole({
      name: '',
      color: '#3b82f6',
      hostileToRoleIds: [],
      permissions: {
        canControlOwnTokens: true,
        canControlOtherTokens: false,
        canSeeAllFog: false,
        canSeeFriendlyVision: true,
        canSeeHostileVision: false,
        canSeeOwnTokens: true,
        canSeeOtherTokens: true,
        canSeeHiddenTokens: false,
        canCreateTokens: false,
        canDeleteOwnTokens: true,
        canDeleteOtherTokens: false,
        canManageRoles: false,
        canAssignRoles: false,
        canAssignTokenRoles: false,
        canManageHostility: false,
        canEditMap: false,
        canManageFog: false,
        canManageInitiative: false,
        canManageRules: false,
      },
    });
    setEditDialogOpen(true);
  };

  const startEditRole = (role: Role) => {
    setEditingRole({ ...role });
    setEditDialogOpen(true);
  };

  const saveRole = () => {
    if (!editingRole) return;

    if (!editingRole.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    if (editingRole.id) {
      updateRole(editingRole.id, editingRole);
      toast.success('Role updated successfully');
    } else {
      const newRole: Role = {
        ...editingRole,
        id: `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isSystem: false,
      };
      addRole(newRole);
      toast.success('Role created successfully');
    }

    setEditDialogOpen(false);
    setEditingRole(null);
  };

  const deleteRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.isSystem) {
      toast.error('Cannot delete system roles');
      return;
    }
    removeRole(roleId);
    toast.success('Role deleted successfully');
  };

  const duplicateRole = (role: Role) => {
    const newRole: Role = {
      ...role,
      id: `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${role.name} (Copy)`,
      isSystem: false,
    };
    addRole(newRole);
    toast.success('Role duplicated successfully');
  };

  const openHostilityManager = (role: Role) => {
    setSelectedRoleForHostility(role);
    setHostilityDialogOpen(true);
  };

  const toggleHostility = (targetRoleId: string, bidirectional: boolean = false) => {
    if (!selectedRoleForHostility) return;
    
    const isCurrentlyHostile = selectedRoleForHostility.hostileToRoleIds.includes(targetRoleId);
    setHostility(selectedRoleForHostility.id, targetRoleId, !isCurrentlyHostile, bidirectional);
    
    // Update local state
    setSelectedRoleForHostility(prev => {
      if (!prev) return null;
      return roles.find(r => r.id === prev.id) || null;
    });
  };

  const applyTemplate = (templateName: string) => {
    const templates = {
      '2team-pvp': () => {
        const teamRed: Role = {
          id: `role_${Date.now()}_red`,
          name: 'Team Red',
          color: '#ef4444',
          isSystem: false,
          hostileToRoleIds: [],
          permissions: {
            canControlOwnTokens: true,
            canControlOtherTokens: false,
            canSeeAllFog: false,
            canSeeFriendlyVision: true,
            canSeeHostileVision: false,
            canSeeOwnTokens: true,
            canSeeOtherTokens: true,
            canSeeHiddenTokens: false,
            canCreateTokens: true,
            canDeleteOwnTokens: true,
            canDeleteOtherTokens: false,
            canManageRoles: false,
            canAssignRoles: false,
            canAssignTokenRoles: false,
            canManageHostility: false,
            canEditMap: false,
            canManageFog: false,
            canManageInitiative: false,
            canManageRules: false,
          },
        };

        const teamBlue: Role = {
          id: `role_${Date.now()}_blue`,
          name: 'Team Blue',
          color: '#3b82f6',
          isSystem: false,
          hostileToRoleIds: [],
          permissions: { ...teamRed.permissions },
        };

        addRole(teamRed);
        addRole(teamBlue);
        setHostility(teamRed.id, teamBlue.id, true, true);
        toast.success('2-Team PvP setup created!');
      },
      '3team-pvp': () => {
        const colors = ['#ef4444', '#3b82f6', '#22c55e'];
        const names = ['Team Red', 'Team Blue', 'Team Green'];
        const roleIds: string[] = [];

        names.forEach((name, i) => {
          const role: Role = {
            id: `role_${Date.now()}_${i}`,
            name,
            color: colors[i],
            isSystem: false,
            hostileToRoleIds: [],
            permissions: {
              canControlOwnTokens: true,
              canControlOtherTokens: false,
              canSeeAllFog: false,
              canSeeFriendlyVision: true,
              canSeeHostileVision: false,
              canSeeOwnTokens: true,
              canSeeOtherTokens: true,
              canSeeHiddenTokens: false,
              canCreateTokens: true,
              canDeleteOwnTokens: true,
              canDeleteOtherTokens: false,
              canManageRoles: false,
              canAssignRoles: false,
              canAssignTokenRoles: false,
              canManageHostility: false,
              canEditMap: false,
              canManageFog: false,
              canManageInitiative: false,
              canManageRules: false,
            },
          };
          addRole(role);
          roleIds.push(role.id);
        });

        // Make all teams hostile to each other
        setHostility(roleIds[0], roleIds[1], true, true);
        setHostility(roleIds[0], roleIds[2], true, true);
        setHostility(roleIds[1], roleIds[2], true, true);
        toast.success('3-Team PvP setup created!');
      },
      'co-dm': () => {
        const coDM: Role = {
          id: `role_${Date.now()}_codm`,
          name: 'Co-DM',
          color: '#f59e0b',
          isSystem: false,
          hostileToRoleIds: [],
          permissions: {
            canControlOwnTokens: true,
            canControlOtherTokens: true,
            canSeeAllFog: true,
            canSeeFriendlyVision: true,
            canSeeHostileVision: true,
            canSeeOwnTokens: true,
            canSeeOtherTokens: true,
            canSeeHiddenTokens: true,
            canCreateTokens: true,
            canDeleteOwnTokens: true,
            canDeleteOtherTokens: true,
            canManageRoles: false,
            canAssignRoles: false,
            canAssignTokenRoles: true,
            canManageHostility: false,
            canEditMap: true,
            canManageFog: true,
            canManageInitiative: true,
            canManageRules: false,
          },
        };
        addRole(coDM);
        toast.success('Co-DM role created!');
      },
    };

    templates[templateName as keyof typeof templates]();
    setTemplateDialogOpen(false);
  };

  const permissionLabels: Record<keyof Role['permissions'], string> = {
    canControlOwnTokens: 'Control Own Tokens',
    canControlOtherTokens: 'Control Other Tokens',
    canSeeAllFog: 'See All (No Fog)',
    canSeeFriendlyVision: 'See Friendly Vision',
    canSeeHostileVision: 'See Hostile Vision',
    canSeeOwnTokens: 'See Own Tokens',
    canSeeOtherTokens: 'See Other Tokens',
    canSeeHiddenTokens: 'See Hidden Tokens',
    canCreateTokens: 'Create Tokens',
    canDeleteOwnTokens: 'Delete Own Tokens',
    canDeleteOtherTokens: 'Delete Other Tokens',
    canManageRoles: 'Manage Roles',
    canAssignRoles: 'Assign Player Roles',
    canAssignTokenRoles: 'Assign Token Roles',
    canManageHostility: 'Manage Hostility',
    canEditMap: 'Edit Map',
    canManageFog: 'Manage Fog',
    canManageInitiative: 'Manage Initiative',
    canManageRules: 'Manage Engine Rules',
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={startCreateRole} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Role
        </Button>
        <Button onClick={() => setTemplateDialogOpen(true)} variant="outline" size="sm">
          <Copy className="w-4 h-4 mr-2" />
          Quick Setup
        </Button>
      </div>

      {/* Roles List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {roles.map((role) => (
            <Card key={role.id} className="border-l-4" style={{ borderLeftColor: role.color }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: role.color }}
                    />
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    {role.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        System
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openHostilityManager(role)}
                    >
                      <Swords className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => duplicateRole(role)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEditRole(role)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteRole(role.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(role.permissions).filter(([_, value]) => value).map(([key]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {permissionLabels[key as keyof Role['permissions']]}
                    </Badge>
                  ))}
                </div>
                {role.hostileToRoleIds.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                    <Swords className="w-3 h-3 text-destructive" />
                    Hostile to: {role.hostileToRoleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Edit/Create Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole?.id ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              Configure role permissions and settings
            </DialogDescription>
          </DialogHeader>
          
          {editingRole && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    value={editingRole.name}
                    onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                    placeholder="Enter role name"
                    disabled={editingRole.isSystem}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-color">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="role-color"
                      type="color"
                      value={editingRole.color}
                      onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                      className="w-20"
                    />
                    <Input
                      value={editingRole.color}
                      onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Permissions</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(permissionLabels).map(([key, label]) => {
                    const isManageRoles = key === 'canManageRoles';
                    const isRisk = editingRole.id ? isSelfLockoutRisk(editingRole.id) : false;
                    const isDisabled = isManageRoles && isRisk && editingRole.permissions.canManageRoles;
                    
                    return (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={editingRole.permissions[key as keyof Role['permissions']]}
                          disabled={isDisabled}
                          onCheckedChange={(checked) => 
                            setEditingRole({
                              ...editingRole,
                              permissions: {
                                ...editingRole.permissions,
                                [key]: checked === true,
                              },
                            })
                          }
                        />
                        <Label htmlFor={key} className={`text-sm font-normal ${isDisabled ? 'text-muted-foreground' : 'cursor-pointer'}`}>
                          {label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRole}>
              {editingRole?.id ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hostility Management Dialog */}
      <Dialog open={hostilityDialogOpen} onOpenChange={setHostilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Hostility: {selectedRoleForHostility?.name}</DialogTitle>
            <DialogDescription>
              Set which roles are hostile to this role
            </DialogDescription>
          </DialogHeader>

          {selectedRoleForHostility && (
            <div className="space-y-3">
              {roles.filter(r => r.id !== selectedRoleForHostility.id).map((role) => {
                const isHostile = selectedRoleForHostility.hostileToRoleIds.includes(role.id);
                const isBidirectional = isHostile && role.hostileToRoleIds.includes(selectedRoleForHostility.id);
                
                return (
                  <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-medium">{role.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={isHostile && !isBidirectional ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleHostility(role.id, false)}
                      >
                        One-way
                      </Button>
                      <Button
                        variant={isBidirectional ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleHostility(role.id, true)}
                      >
                        Mutual
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setHostilityDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Setup Templates</DialogTitle>
            <DialogDescription>
              Choose a pre-configured scenario to get started quickly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => applyTemplate('2team-pvp')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  2-Team PvP
                </CardTitle>
                <CardDescription>
                  Creates Team Red and Team Blue with mutual hostility. Perfect for team-based combat.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => applyTemplate('3team-pvp')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  3-Team PvP
                </CardTitle>
                <CardDescription>
                  Creates three teams (Red, Blue, Green) all hostile to each other. Great for free-for-all battles.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => applyTemplate('co-dm')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Co-DM Setup
                </CardTitle>
                <CardDescription>
                  Creates a Co-DM role with elevated permissions for collaborative storytelling.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleManagerCard;
