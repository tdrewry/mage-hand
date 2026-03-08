import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Share2, Users, Map, Trash2, Castle, Save, FolderOpen, Layers, Sparkles, Shield, Network, Monitor, UserCircle, HardDrive, Box, BookOpen, GitBranch, Dices, Radio, MessageSquare, Swords, Home } from 'lucide-react';
import { SessionManager } from '@/components/SessionManager';
import { ConnectedUsersPanel } from '@/components/ConnectedUsersPanel';
import { StorageManagerModal } from '@/components/StorageManagerModal';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { netManager } from '@/lib/net';
import { hasPermission } from '@/lib/rolePermissions';
import { useRoleStore } from '@/stores/roleStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { toast } from 'sonner';
import { useLaunchStore } from '@/stores/launchStore';

interface MenuCardContentProps {
  sessionId?: string;
}

export const MenuCardContent: React.FC<MenuCardContentProps> = ({ sessionId }) => {
  const { tokens, players, currentPlayerId } = useSessionStore();
  const { regions } = useRegionStore();
  const { renderingMode, setRenderingMode } = useDungeonStore();
  const { isConnected, currentSession, connectedUsers, currentUserId } = useMultiplayerStore();
  const { currentMode, lockedByDm, setMode } = useUiModeStore();
  const { roles } = useRoleStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [storageManagerOpen, setStorageManagerOpen] = useState(false);
  const [returnMenuDialogOpen, setReturnMenuDialogOpen] = useState(false);
  const setLaunched = useLaunchStore((s) => s.setLaunched);

  // Get current player's roles
  const currentPlayer = players.find(p => p.id === currentUserId || p.id === currentPlayerId);
  const currentPlayerRoles = currentPlayer?.roleIds || [];

  // Check if user has permission to control UI mode
  const canControlUiMode = hasPermission(
    currentPlayer || { id: '', name: '', roleIds: [], isConnected: false },
    roles,
    'canManageFog' // DM-level permission
  );
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const mapControlsCard = cards.find((c) => c.type === CardType.MAP_CONTROLS);
  const mapManagerCard = cards.find((c) => c.type === CardType.MAP_MANAGER);
  
  const visionProfileCard = cards.find((c) => c.type === CardType.VISION_PROFILE_MANAGER);
  const roleManagerCard = cards.find((c) => c.type === CardType.ROLE_MANAGER);
  const projectManagerCard = cards.find((c) => c.type === CardType.PROJECT_MANAGER);
  const mapObjectsCard = cards.find((c) => c.type === CardType.MAP_OBJECTS);
  const creatureLibraryCard = cards.find((c) => c.type === CardType.CREATURE_LIBRARY);
  const mapTreeCard = cards.find((c) => c.type === CardType.MAP_TREE);
  const diceBoxCard = cards.find((c) => c.type === CardType.DICE_BOX);
  const networkDemoCard = cards.find((c) => c.type === CardType.NETWORK_DEMO);
  const chatCard = cards.find((c) => c.type === CardType.CHAT);
  const actionCard = cards.find((c) => c.type === CardType.ACTION_CARD);
  const artApprovalCard = cards.find((c) => c.type === CardType.ART_APPROVAL);

  const handleToggleMapControlsCard = () => {
    if (mapControlsCard) {
      setVisibility(mapControlsCard.id, !mapControlsCard.isVisible);
    } else {
      registerCard({
        type: CardType.MAP_CONTROLS,
        title: 'Map Controls',
        defaultPosition: { x: window.innerWidth / 2 - 200, y: 100 },
        defaultSize: { width: 400, height: 450 },
        minSize: { width: 350, height: 400 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const handleToggleMapManager = () => {
    if (mapManagerCard) {
      setVisibility(mapManagerCard.id, !mapManagerCard.isVisible);
    } else {
      registerCard({
        type: CardType.MAP_MANAGER,
        title: 'Map Manager',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
        defaultSize: { width: 600, height: 600 },
        minSize: { width: 500, height: 500 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };


  const handleToggleVisionProfiles = () => {
    if (visionProfileCard) {
      setVisibility(visionProfileCard.id, !visionProfileCard.isVisible);
    } else {
      registerCard({
        type: CardType.VISION_PROFILE_MANAGER,
        title: 'Vision Profile Manager',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 450, height: 650 },
        minSize: { width: 400, height: 550 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  const handleToggleRoleManager = () => {
    if (roleManagerCard) {
      setVisibility(roleManagerCard.id, !roleManagerCard.isVisible);
    } else {
      registerCard({
        type: CardType.ROLE_MANAGER,
        title: 'Role Manager',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 600, height: 700 },
        minSize: { width: 500, height: 600 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  const handleToggleMapObjects = () => {
    if (mapObjectsCard) {
      setVisibility(mapObjectsCard.id, !mapObjectsCard.isVisible);
    } else {
      registerCard({
        type: CardType.MAP_OBJECTS,
        title: 'Map Objects',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 350, height: 550 },
        minSize: { width: 300, height: 400 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  const handleToggleCreatureLibrary = () => {
    if (creatureLibraryCard) {
      setVisibility(creatureLibraryCard.id, !creatureLibraryCard.isVisible);
    } else {
      registerCard({
        type: CardType.CREATURE_LIBRARY,
        title: 'Creature Library',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
        defaultSize: { width: 600, height: 700 },
        minSize: { width: 500, height: 550 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };
  
  const toggleRenderingMode = () => {
    const newMode = renderingMode === 'edit' ? 'play' : 'edit';
    setRenderingMode(newMode);
    toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'Edit'} mode`);
  };

  const handleModeChange = (newMode: 'dm' | 'play') => {
    // Update local mode
    setMode(newMode);
    
    // Broadcast to all players if we're DM and connected
    if (canControlUiMode && isConnected) {
      // TODO: implement rpcSetUiMode via netManager
      toast.success(`Set all players to ${newMode === 'play' ? 'Play' : 'DM'} mode`);
    } else {
      toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'DM'} mode`);
    }
  };
  
  const shareSession = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    toast.success('Session URL copied to clipboard!');
  };

  const clearStorage = () => {
    setDeleteDialogOpen(false);
    localStorage.clear();
    const { getState } = useSessionStore;
    const state = getState();
    state.tokens.length = 0;
    toast.success('Storage and tokens cleared! Reload page to start fresh.');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSave = () => {
    if (projectManagerCard) {
      setVisibility(projectManagerCard.id, true);
    } else {
      registerCard({
        type: CardType.PROJECT_MANAGER,
        title: 'Project Manager',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
        defaultSize: { width: 600, height: 700 },
        minSize: { width: 500, height: 600 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
    toast.success('Opening Project Manager');
  };

  const handleLoad = () => {
    if (projectManagerCard) {
      setVisibility(projectManagerCard.id, true);
    } else {
      registerCard({
        type: CardType.PROJECT_MANAGER,
        title: 'Project Manager',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
        defaultSize: { width: 600, height: 700 },
        minSize: { width: 500, height: 600 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
    toast.success('Opening Project Manager');
  };

  return (
    <div className="p-3 space-y-3">
      {/* Quick Access — Chat & Actions */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Quick Access</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={chatCard?.isVisible ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (chatCard) {
                setVisibility(chatCard.id, !chatCard.isVisible);
              } else {
                registerCard({
                  type: CardType.CHAT,
                  title: 'Chat',
                  defaultPosition: { x: window.innerWidth - 400, y: 80 },
                  defaultSize: { width: 360, height: 500 },
                  minSize: { width: 300, height: 350 },
                  isResizable: true,
                  isClosable: true,
                  defaultVisible: true,
                });
              }
            }}
            className="w-full"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>

          {canControlUiMode && (
            <Button
              variant={actionCard?.isVisible ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (actionCard) {
                  setVisibility(actionCard.id, !actionCard.isVisible);
                } else {
                  registerCard({
                    type: CardType.ACTION_CARD,
                    title: 'Action',
                    defaultPosition: { x: window.innerWidth / 2 - 200, y: 80 },
                    defaultSize: { width: 420, height: 600 },
                    minSize: { width: 380, height: 450 },
                    isResizable: true,
                    isClosable: true,
                    defaultVisible: true,
                  });
                }
              }}
              className="w-full"
            >
              <Swords className="h-4 w-4 mr-2" />
              Actions
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Session Info */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          Session: {sessionId?.slice(0, 8) || 'paper-demo'}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Tokens: {tokens.length}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Regions: {regions.length}
        </Badge>
      </div>

      <Separator />

      {/* UI Mode Toggle - DM can control all players */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">UI Mode</p>
          {lockedByDm && (
            <Badge variant="secondary" className="text-xs">
              Locked by DM
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={currentMode === 'dm' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('dm')}
            disabled={lockedByDm}
            className="w-full"
          >
            <UserCircle className="h-4 w-4 mr-2" />
            DM
          </Button>
          <Button
            variant={currentMode === 'play' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('play')}
            disabled={lockedByDm}
            className="w-full"
          >
            <Monitor className="h-4 w-4 mr-2" />
            Play
          </Button>
        </div>
        {canControlUiMode && isConnected && (
          <p className="text-xs text-muted-foreground">
            Changes broadcast to all players
          </p>
        )}
      </div>

      <Separator />

      {/* Rendering Mode Toggle */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Rendering Mode</p>
        <Button 
          variant={renderingMode === 'play' ? 'default' : 'outline'}
          size="sm"
          onClick={toggleRenderingMode}
          className="w-full"
        >
          <Castle className="h-4 w-4 mr-2" />
          {renderingMode === 'play' ? 'Play Mode' : 'Edit Mode'}
        </Button>
      </div>

      <Separator />

      {/* Multiplayer Controls */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Multiplayer</p>
        <Button 
          variant={isConnected ? "default" : "outline"}
          size="sm"
          onClick={() => setSessionManagerOpen(true)}
          className="w-full"
        >
          <Network className="h-4 w-4 mr-2" />
          {isConnected ? `Session: ${currentSession?.sessionCode}` : 'Connect to Session'}
        </Button>
        
        {isConnected && (
          <>
            <Badge variant="secondary" className="w-full justify-center text-xs">
              <Users className="h-3 w-3 mr-1" />
              {connectedUsers.length} player{connectedUsers.length !== 1 ? 's' : ''} online
            </Badge>
            
            {/* Sync Button - DMs broadcast, Players request */}
            <Button 
              variant="outline"
              size="sm"
              onClick={async () => {
                if (canControlUiMode) {
                  // DM: Re-push all durable state via Jazz bridge
                  try {
                    const { getBridgedSessionRoot, pushAllToJazz } = await import('@/lib/jazz/bridge');
                    const root = getBridgedSessionRoot();
                    if (root) {
                      pushAllToJazz(root);
                      toast.success('Game state synced to all players');
                    } else {
                      toast.error('No active Jazz session — cannot sync');
                    }
                  } catch (err) {
                    console.error('[MenuCard] Sync failed:', err);
                    toast.error('Sync failed — see console for details');
                  }
                } else {
                  // Player: Re-pull all state from Jazz
                  try {
                    const { getBridgedSessionRoot, pullAllFromJazz } = await import('@/lib/jazz/bridge');
                    const root = getBridgedSessionRoot();
                    if (root) {
                      pullAllFromJazz(root);
                      toast.success('Game state refreshed from host');
                    } else {
                      toast.error('No active Jazz session — cannot sync');
                    }
                  } catch (err) {
                    console.error('[MenuCard] Sync failed:', err);
                    toast.error('Sync failed — see console for details');
                  }
                }
              }}
              className="w-full"
            >
              <Share2 className="h-4 w-4 mr-2" />
              {canControlUiMode ? 'Sync to Players' : 'Request Sync'}
            </Button>
          </>
        )}

        <Button
          variant={networkDemoCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (networkDemoCard) {
              setVisibility(networkDemoCard.id, !networkDemoCard.isVisible);
            } else {
              registerCard({
                type: CardType.NETWORK_DEMO,
                title: 'Network Demo',
                defaultPosition: { x: 320, y: 80 },
                defaultSize: { width: 380, height: 550 },
                minSize: { width: 320, height: 400 },
                isResizable: true,
                isClosable: true,
                defaultVisible: true,
              });
            }
          }}
          className="w-full"
        >
          <Radio className="h-4 w-4 mr-2" />
          Network Demo
        </Button>

        {canControlUiMode && (
          <Button
            variant={artApprovalCard?.isVisible ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (artApprovalCard) {
                setVisibility(artApprovalCard.id, !artApprovalCard.isVisible);
              } else {
                registerCard({
                  type: CardType.ART_APPROVAL,
                  title: 'Art Approval',
                  defaultPosition: { x: 360, y: 120 },
                  defaultSize: { width: 340, height: 420 },
                  minSize: { width: 280, height: 300 },
                  isResizable: true,
                  isClosable: true,
                  defaultVisible: true,
                });
              }
            }}
            className="w-full"
          >
            <Radio className="h-4 w-4 mr-2" />
            Art Approval
          </Button>
        )}
      </div>

      <Separator />

      {/* Session Controls */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Session</p>
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={shareSession}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          
          <ConnectedUsersPanel
            trigger={
              <Button 
                variant="outline" 
                size="sm"
                disabled={!isConnected}
              >
                <Users className="h-4 w-4 mr-2" />
                Players ({isConnected ? connectedUsers.length : 0})
              </Button>
            }
          />
        </div>
      </div>

      <Separator />

      {/* Project Controls */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Project</p>
        <Button 
          variant={projectManagerCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleSave}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          Project Manager
        </Button>
        
        {canControlUiMode && (
          <Button 
            variant={mapControlsCard?.isVisible ? "default" : "outline"}
            size="sm"
            onClick={handleToggleMapControlsCard}
            className="w-full"
          >
            <Map className="h-4 w-4 mr-2" />
            Map Controls
          </Button>
        )}

        <Button 
          variant={mapManagerCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleMapManager}
          className="w-full"
        >
          <Layers className="h-4 w-4 mr-2" />
          Map Manager
        </Button>


        <Button 
          variant={visionProfileCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleVisionProfiles}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Vision Profiles
        </Button>

        <Button 
          variant={roleManagerCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleRoleManager}
          className="w-full"
        >
          <Shield className="h-4 w-4 mr-2" />
          Role Manager
        </Button>

        <Button 
          variant={mapObjectsCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleMapObjects}
          className="w-full"
        >
          <Box className="h-4 w-4 mr-2" />
          Map Objects
        </Button>

        <Button 
          variant="outline"
          size="sm"
          onClick={() => setStorageManagerOpen(true)}
          className="w-full"
        >
          <HardDrive className="h-4 w-4 mr-2" />
          Storage Manager
        </Button>

        <Button 
          variant={creatureLibraryCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleCreatureLibrary}
          className="w-full"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Creature Library
        </Button>

        <Button 
          variant={mapTreeCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (mapTreeCard) {
              setVisibility(mapTreeCard.id, !mapTreeCard.isVisible);
            } else {
              registerCard({
                type: CardType.MAP_TREE,
                title: 'Map Tree',
                defaultPosition: { x: 320, y: 80 },
                defaultSize: { width: 460, height: 500 },
                minSize: { width: 260, height: 300 },
                isResizable: true,
                isClosable: true,
                defaultVisible: true,
              });
            }
          }}
          className="w-full"
        >
          <GitBranch className="h-4 w-4 mr-2" />
          Map Tree
        </Button>

        <Button 
          variant={diceBoxCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (diceBoxCard) {
              setVisibility(diceBoxCard.id, !diceBoxCard.isVisible);
            } else {
              registerCard({
                type: CardType.DICE_BOX,
                title: 'Dice Box',
                defaultPosition: { x: 320, y: 80 },
                defaultSize: { width: 350, height: 500 },
                minSize: { width: 280, height: 350 },
                isResizable: true,
                isClosable: true,
                defaultVisible: true,
              });
            }
          }}
          className="w-full"
        >
          <Dices className="h-4 w-4 mr-2" />
          Dice Box
        </Button>
      </div>

      <Separator />

      {/* Return to Menu */}
      <div className="space-y-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLaunched(false)}
          className="w-full"
        >
          <Home className="h-4 w-4 mr-2" />
          Return to Menu
        </Button>
      </div>

      <Separator />

      {/* Danger Zone */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Danger Zone</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete All Data
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all tokens, 
              regions, maps, and settings from your local storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={clearStorage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Session Manager Modal */}
      <SessionManager 
        open={sessionManagerOpen} 
        onOpenChange={setSessionManagerOpen} 
      />

      {/* Storage Manager Modal */}
      <StorageManagerModal
        open={storageManagerOpen}
        onOpenChange={setStorageManagerOpen}
      />
    </div>
  );
};
