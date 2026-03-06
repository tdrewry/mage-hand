import React, { useState } from 'react';
import { Users, Circle, Settings, Shield, UserCog, Map, Activity, Hand } from 'lucide-react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useRoleStore } from '@/stores/roleStore';
import { useSessionStore } from '@/stores/sessionStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useMapStore } from '@/stores/mapStore';
import { useMiscEphemeralStore } from '@/stores/miscEphemeralStore';
import { hasPermission } from '@/lib/rolePermissions';
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
import { ephemeralBus } from '@/lib/net';

interface ConnectedUsersPanelProps {
  trigger?: React.ReactNode;
}

export const ConnectedUsersPanel: React.FC<ConnectedUsersPanelProps> = ({ trigger }) => {
  const { connectedUsers, currentUserId } = useMultiplayerStore();
  const { roles, getRoleById } = useRoleStore();
  const presence = usePresenceStore((s) => s.presence);
  const handRaises = useMiscEphemeralStore((s) => s.handRaises);
  const maps = useMapStore((s) => s.maps);
  const currentPlayer = useSessionStore((state) => 
    state.players.find(p => p.id === state.currentPlayerId)
  );
  const [open, setOpen] = useState(false);

  // Use permission system instead of hardcoded DM check
  const canAssignPlayerRoles = currentPlayer ? hasPermission(currentPlayer, roles, 'canAssignRoles') : false;

  const handleRoleToggle = (userId: string, roleId: string, currentlyHas: boolean) => {
    if (!canAssignPlayerRoles) {
      toast.error('You do not have permission to manage user roles');
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

    // Broadcast role change to all connected peers
    ephemeralBus.emit('role.assign', { targetUserId: userId, roleIds: newRoleIds });

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
            {!canAssignPlayerRoles && ' (View only - role assignment permission required)'}
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
                      {/* Username + hand raise */}
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium truncate">
                          {user.username}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-2">(You)</span>
                          )}
                        </p>
                        {handRaises[user.userId] && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-500 animate-pulse">
                            <Hand className="h-3.5 w-3.5" />
                            Raised
                          </span>
                        )}
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

                      {/* Presence info (viewing map + activity) */}
                      {(() => {
                        const p = presence[user.userId];
                        if (!p) return null;
                        const mapName = p.viewingMapId
                          ? maps.find((m) => m.id === p.viewingMapId)?.name ?? "Unknown map"
                          : null;
                        return (
                          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-muted-foreground">
                            {mapName && (
                              <span className="flex items-center gap-1">
                                <Map className="h-3 w-3" />
                                {mapName}
                              </span>
                            )}
                            {p.activity && (
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {p.activity}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {canAssignPlayerRoles && !isCurrentUser && (
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
          {canAssignPlayerRoles && (
            <div className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              <span>Role management enabled</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
