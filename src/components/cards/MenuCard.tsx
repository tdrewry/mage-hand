import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Share2, Users, Map, Trash2, Castle, Save, FolderOpen, Eye, Layers, Grid3x3, Sparkles, Shield, Network } from 'lucide-react';
import { SessionManager } from '@/components/SessionManager';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
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

interface MenuCardContentProps {
  sessionId?: string;
}

export const MenuCardContent: React.FC<MenuCardContentProps> = ({ sessionId }) => {
  const { tokens } = useSessionStore();
  const { regions } = useRegionStore();
  const { renderingMode, setRenderingMode } = useDungeonStore();
  const { isConnected, currentSession, connectedUsers } = useMultiplayerStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const mapControlsCard = cards.find((c) => c.type === CardType.MAP_CONTROLS);
  const mapManagerCard = cards.find((c) => c.type === CardType.MAP_MANAGER);
  const backgroundGridCard = cards.find((c) => c.type === CardType.BACKGROUND_GRID);
  const playerViewCard = cards.find((c) => c.type === CardType.MAP);
  const visionProfileCard = cards.find((c) => c.type === CardType.VISION_PROFILE_MANAGER);
  const roleManagerCard = cards.find((c) => c.type === CardType.ROLE_MANAGER);
  const projectManagerCard = cards.find((c) => c.type === CardType.PROJECT_MANAGER);

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

  const handleTogglePlayerView = () => {
    if (playerViewCard) {
      setVisibility(playerViewCard.id, !playerViewCard.isVisible);
    } else {
      registerCard({
        type: CardType.MAP,
        title: 'Player View',
        defaultPosition: { x: 320, y: 20 },
        defaultSize: { width: 800, height: 600 },
        minSize: { width: 400, height: 300 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
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

  const handleToggleBackgroundGrid = () => {
    if (backgroundGridCard) {
      setVisibility(backgroundGridCard.id, !backgroundGridCard.isVisible);
    } else {
      registerCard({
        type: CardType.BACKGROUND_GRID,
        title: 'Background & Grid',
        defaultPosition: { x: 320, y: 80 },
        defaultSize: { width: 400, height: 450 },
        minSize: { width: 350, height: 400 },
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
  
  const toggleRenderingMode = () => {
    const newMode = renderingMode === 'edit' ? 'play' : 'edit';
    setRenderingMode(newMode);
    toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'Edit'} mode`);
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

      {/* Mode Toggle */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Mode</p>
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
          <Badge variant="secondary" className="w-full justify-center text-xs">
            <Users className="h-3 w-3 mr-1" />
            {connectedUsers.length} player{connectedUsers.length !== 1 ? 's' : ''} online
          </Badge>
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
          
          <Button 
            variant="outline" 
            size="sm"
          >
            <Users className="h-4 w-4 mr-2" />
            Players (1)
          </Button>
        </div>
      </div>

      <Separator />

      {/* Project Controls */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Project</p>
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSave}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLoad}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>
        </div>
        
        <Button 
          variant={mapControlsCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleMapControlsCard}
          className="w-full"
        >
          <Map className="h-4 w-4 mr-2" />
          Map Controls
        </Button>

        <Button 
          variant={playerViewCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleTogglePlayerView}
          className="w-full"
        >
          <Eye className="h-4 w-4 mr-2" />
          Player View
        </Button>

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
          variant={backgroundGridCard?.isVisible ? "default" : "outline"}
          size="sm"
          onClick={handleToggleBackgroundGrid}
          className="w-full"
        >
          <Grid3x3 className="h-4 w-4 mr-2" />
          Background & Grid
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
    </div>
  );
};
