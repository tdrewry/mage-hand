import React, { useState } from 'react';
import { Users, Circle, Settings, Shield, UserCog } from 'lucide-react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useRoleStore } from '@/stores/roleStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { syncManager } from '@/lib/syncManager';

interface ConnectedUsersPanelProps {
  trigger?: React.ReactNode;
}

export const ConnectedUsersPanel: React.FC<ConnectedUsersPanelProps> = ({ trigger }) => {
  const { connectedUsers, currentUserId } = useMultiplayerStore();
  const { roles, getRoleById } = useRoleStore();
  const currentPlayer = useSessionStore((state) => 
    state.players.find(p => p.id === state.currentPlayerId)
  );
  const [open, setOpen] = useState(false);

  // Check if current user is DM
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;

  const handleRoleToggle = (userId: string, roleId: string, currentlyHas: boolean) => {
    if (!isDM) {
      toast.error('Only the DM can manage user roles');
      return;
    }

    const user = connectedUsers.find(u => u.userId === userId);
    if (!user) return;

    let newRoleIds: string[];
    if (currentlyHas) {
      // Remove role
      newRoleIds = user.roleIds.filter(id => id !== roleId);
      if (newRoleIds.length === 0) {
        toast.error('User must have at least one role');
        return;
      }
    } else {
      // Add role
      newRoleIds = [...user.roleIds, roleId];
    }

    // Update locally
    useMultiplayerStore.getState().updateUserRoles(userId, newRoleIds);

    // Sync to server (TODO: implement in syncManager)
    if (syncManager.isConnected()) {
      console.log('[ConnectedUsers] Role change sync not yet implemented', userId, newRoleIds);
    }

    const role = getRoleById(roleId);
    toast.success(
      currentlyHas 
        ? `Removed ${role?.name} from ${user.username}`
        : `Assigned ${role?.name} to ${user.username}`
    );
  };

  const getConnectionStatusColor = (isConnected: boolean) => {
    return isConnected ? 'text-green-500' : 'text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            Connected Players ({connectedUsers.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connected Players
          </DialogTitle>
          <DialogDescription>
            Manage players and their roles in this session
            {!isDM && ' (View only - DM controls required)'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {connectedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No players connected yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Share your session code to invite players
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedUsers.map((user) => {
                const isCurrentUser = user.userId === currentUserId;
                const userRoles = user.roleIds
                  .map(roleId => getRoleById(roleId))
                  .filter(Boolean);

                return (
                  <div
                    key={user.userId}
                    className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    {/* Connection status indicator */}
                    <Circle
                      className={`h-2.5 w-2.5 mt-1.5 fill-current ${getConnectionStatusColor(true)}`}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Username */}
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium truncate">
                          {user.username}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-2">(You)</span>
                          )}
                        </p>
                      </div>

                      {/* Current roles */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {userRoles.length > 0 ? (
                          userRoles.map((role) => (
                            <Badge
                              key={role!.id}
                              variant="secondary"
                              className="text-xs"
                              style={{ 
                                backgroundColor: `${role!.color}20`,
                                borderColor: role!.color,
                                color: role!.color
                              }}
                            >
                              {role!.name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            No roles assigned
                          </Badge>
                        )}
                      </div>

                      {/* Role management (DM only) */}
                      {isDM && !isCurrentUser && (
                        <div className="space-y-2">
                          <Separator className="my-2" />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <UserCog className="h-3.5 w-3.5" />
                            <span>Manage Roles:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {roles.map((role) => {
                              const hasRole = user.roleIds.includes(role.id);
                              return (
                                <Button
                                  key={role.id}
                                  size="sm"
                                  variant={hasRole ? 'default' : 'outline'}
                                  className="h-7 text-xs"
                                  onClick={() => handleRoleToggle(user.userId, role.id, hasRole)}
                                  style={
                                    hasRole
                                      ? {
                                          backgroundColor: role.color,
                                          borderColor: role.color,
                                        }
                                      : {}
                                  }
                                >
                                  {hasRole ? '✓ ' : ''}
                                  {role.name}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* User icon */}
                    <div className="flex-shrink-0">
                      {userRoles.some(r => r?.id === 'dm') ? (
                        <Shield className="h-5 w-5 text-destructive" />
                      ) : (
                        <Users className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{connectedUsers.length} player{connectedUsers.length !== 1 ? 's' : ''} connected</span>
          {isDM && (
            <div className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              <span>DM controls enabled</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
