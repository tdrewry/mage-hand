import React, { useState, useRef, useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Play,
  FilePlus,
  FolderOpen,
  Save,
  Info,
  ChevronRight,
  UserCircle,
  Network,
  Wifi,
  WifiOff,
  Users,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { SessionManager } from '@/components/SessionManager';
import {
  exportProjectToFile,
  importProjectFromFile,
  ProjectData,
} from '@/lib/projectSerializer';
import {
  createCurrentProjectData,
  clearAllStores,
  applyProjectData,
} from '@/lib/sessionIO';

interface LandingScreenProps {
  onLaunch: () => void;
  hasSession: boolean;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onLaunch, hasSession }) => {
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [pendingLoadData, setPendingLoadData] = useState<ProjectData | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role/username selection state
  const [username, setUsername] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const roles = useRoleStore((s) => s.roles);
  const initializeDefaultRoles = useRoleStore((s) => s.initializeDefaultRoles);
  const players = useSessionStore((s) => s.players);
  const currentPlayerId = useSessionStore((s) => s.currentPlayerId);
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const initializeSession = useSessionStore((s) => s.initializeSession);

  // Ensure roles and session are initialized
  useEffect(() => {
    initializeDefaultRoles();
    initializeSession();
  }, []);

  // Check if current player already has valid identity
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const hasValidIdentity = currentPlayer && currentPlayer.name && currentPlayer.name.trim().length > 0;

  // Pre-fill from existing player if returning
  useEffect(() => {
    if (hasValidIdentity && currentPlayer) {
      setUsername(currentPlayer.name);
      setSelectedRoleIds(currentPlayer.roleIds || []);
    } else if (roles.length > 0 && selectedRoleIds.length === 0) {
      // Auto-select DM for first user, Player for subsequent
      const isFirstUser = players.length === 0 || !players.some(p => p.name?.trim());
      const defaultRole = isFirstUser ? 'dm' : 'player';
      const role = roles.find(r => r.id === defaultRole);
      if (role) setSelectedRoleIds([role.id]);
    }
  }, [roles, hasValidIdentity]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const isIdentityReady = username.trim().length > 0 && selectedRoleIds.length > 0;
  const isDMSelected = selectedRoleIds.includes('dm');

  /** Commit the player identity and set rendering mode based on role */
  const commitIdentityAndLaunch = (launchFn: () => void) => {
    if (!isIdentityReady) {
      toast.error('Please enter a username and select a role before continuing.');
      return;
    }

    // Commit player identity
    addPlayer({
      id: currentPlayerId,
      name: username.trim(),
      roleIds: selectedRoleIds,
      isConnected: true,
    });

    // Set rendering mode based on role: DMs get edit, Players get play
    const dungeonStore = useDungeonStore.getState();
    if (!isDMSelected) {
      dungeonStore.setRenderingMode('play');
    }
    // DMs keep whatever mode was previously set (or default 'edit')

    launchFn();
  };

  // Multiplayer state
  const { isConnected, connectionStatus, currentSession, connectedUsers, syncReady } = useMultiplayerStore();
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);

  // --- New Session ---
  const handleNewSession = () => {
    if (hasSession) {
      setShowNewConfirm(true);
    } else {
      doNewSession();
    }
  };

  const doNewSession = () => {
    commitIdentityAndLaunch(() => {
      try {
        clearAllStores();
        toast.success('New session started');
        onLaunch();
      } catch (err) {
        console.error(err);
        toast.error('Failed to start new session');
      }
    });
  };

  // --- Save Session ---
  const handleSaveSession = async () => {
    if (!hasSession) {
      toast.error('No active session to save');
      return;
    }
    setIsSaving(true);
    try {
      const data = createCurrentProjectData();
      await exportProjectToFile(data, `session-${Date.now()}.mhsession`);
      toast.success('Session saved to disk');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Load Session ---
  const handleLoadSession = () => {
    if (!isIdentityReady) {
      toast.error('Please enter a username and select a role before continuing.');
      return;
    }
    // Commit identity now so it's ready when applyAndLaunch fires
    addPlayer({
      id: currentPlayerId,
      name: username.trim(),
      roleIds: selectedRoleIds,
      isConnected: true,
    });

    // Always open file picker directly from landing page — no confirmation needed
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsLoading(true);
    try {
      const data = await importProjectFromFile(file);
      await applyAndLaunch(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load session file');
    } finally {
      setIsLoading(false);
    }
  };

  const applyAndLaunch = async (data: ProjectData) => {
    try {
      clearAllStores();
      applyProjectData(data);

      // Set rendering mode based on selected role (Players always get play)
      if (!isDMSelected) {
        useDungeonStore.getState().setRenderingMode('play');
      }

      toast.success('Session loaded');
      onLaunch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply session data');
    }
  };

  const confirmLoad = async () => {
    setShowLoadConfirm(false);
    // Open file picker after confirmation
    if (!pendingLoadData) {
      fileInputRef.current?.click();
    } else {
      await applyAndLaunch(pendingLoadData);
      setPendingLoadData(null);
    }
  };

  const menuItems = [
    {
      id: 'continue',
      label: 'Continue',
      description: isConnected && !syncReady
        ? 'Syncing session data…'
        : hasSession ? 'Resume your current session' : 'No active session in memory',
      icon: Play,
      disabled: !hasSession || !isIdentityReady || (isConnected && !syncReady),
      active: hasSession && isIdentityReady && (!isConnected || syncReady),
      onClick: () => commitIdentityAndLaunch(onLaunch),
    },
    {
      id: 'new',
      label: 'New Session',
      description: 'Start a fresh tabletop session',
      icon: FilePlus,
      disabled: !isIdentityReady,
      active: false,
      onClick: handleNewSession,
    },
    {
      id: 'load',
      label: 'Load Session',
      description: 'Load a session from a .mhsession file',
      icon: FolderOpen,
      disabled: isLoading || !isIdentityReady,
      active: false,
      onClick: handleLoadSession,
    },
    {
      id: 'save',
      label: 'Save Session',
      description: hasSession ? 'Save current session to disk' : 'No active session to save',
      icon: Save,
      disabled: !hasSession || isSaving || !isIdentityReady,
      active: false,
      onClick: handleSaveSession,
    },
    {
      id: 'about',
      label: 'About',
      description: 'Application information',
      icon: Info,
      disabled: false,
      active: false,
      onClick: () => setShowAbout(true),
    },
  ];

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 space-y-6">
        {/* Title block */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Magehand</h1>
          <p className="text-sm text-muted-foreground">The application is paused.</p>
          <p className="text-xs text-muted-foreground/50 font-mono">v{APP_VERSION}</p>
        </div>

        {/* Side-by-side: Identity + Multiplayer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Identity Selection */}
          <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/10">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserCircle className="w-4 h-4 text-muted-foreground" />
              <span>Player Identity</span>
              {hasValidIdentity && (
                <span className="ml-auto text-xs text-primary font-normal">✓ {currentPlayer?.name}</span>
              )}
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
                className="bg-background text-sm h-8"
              />
            </div>

            <div className="space-y-1.5">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleRole(role.id)}
                >
                  <Checkbox
                    id={`landing-role-${role.id}`}
                    checked={selectedRoleIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <label
                    htmlFor={`landing-role-${role.id}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-border"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="font-medium">{role.name}</span>
                  </label>
                </div>
              ))}
            </div>

            {!isIdentityReady && (
              <p className="text-xs text-muted-foreground/70">
                Select a name and role to enable session actions
              </p>
            )}
          </div>

          {/* Multiplayer */}
          <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/10">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Network className="w-4 h-4 text-muted-foreground" />
              <span>Multiplayer</span>
              {isConnected && (
                <Badge variant="default" className="ml-auto text-xs py-0 px-1.5">
                  <Wifi className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
              {!isConnected && connectionStatus === 'disconnected' && (
                <Badge variant="secondary" className="ml-auto text-xs py-0 px-1.5">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>

            {isConnected && currentSession && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Session: <span className="font-mono text-foreground">{currentSession.sessionCode}</span></div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {connectedUsers.length} player{connectedUsers.length !== 1 ? 's' : ''} online
                </div>
              </div>
            )}

            <Button
              variant={isConnected ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSessionManagerOpen(true)}
              className="w-full"
            >
              <Network className="h-4 w-4 mr-2" />
              {isConnected ? 'Session Details' : 'Host / Join'}
            </Button>

            {!isConnected && (
              <p className="text-xs text-muted-foreground/70">
                Host a new session or join an existing one
              </p>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="space-y-1 max-w-sm mx-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                disabled={item.disabled}
                className={[
                  'w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-150 text-left group',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-accent cursor-pointer',
                  item.active && !item.disabled
                    ? 'border border-green-500/40 bg-green-500/10 hover:bg-green-500/20'
                    : 'border border-transparent',
                ].join(' ')}
              >
                <div className={[
                  'flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center',
                  item.active && !item.disabled
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted text-muted-foreground group-hover:text-foreground',
                ].join(' ')}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={[
                    'text-sm font-medium',
                    item.active && !item.disabled ? 'text-green-400' : 'text-foreground',
                  ].join(' ')}>
                    {item.label}
                    {item.id === 'save' && isSaving && ' …'}
                    {item.id === 'load' && isLoading && ' …'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
                {!item.disabled && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Session Manager Dialog */}
      <SessionManager
        open={sessionManagerOpen}
        onOpenChange={setSessionManagerOpen}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mhsession,.json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* New Session confirmation */}
      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a New Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session in memory. Starting a new session will clear all current data.
              Make sure to save your session first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doNewSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Start New Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Load Session confirmation (when session exists) */}
      <AlertDialog open={showLoadConfirm && !pendingLoadData} onOpenChange={(open) => {
        if (!open) setShowLoadConfirm(false);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load a Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session in memory. Loading a new session will replace all current data.
              Save your session first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLoadConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoad}>
              Continue &amp; Select File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* About modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
          <DialogTitle className="text-xl font-bold">About Magehand</DialogTitle>
            <DialogDescription>Tabletop virtual game table</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-foreground font-medium">Version</span>
              <span className="font-mono">{APP_VERSION}</span>
              <span className="text-foreground font-medium">Format</span>
              <span className="font-mono">.mhsession</span>
              <span className="text-foreground font-medium">Platform</span>
              <span>Web (React + PixiJS)</span>
            </div>
            <p className="text-xs text-muted-foreground/70 border-t border-border pt-3">
              Magehand is a browser-based virtual tabletop application supporting fog of war, token management,
              initiative tracking, vision profiles, and multi-layer maps.
            </p>
            <p className="text-xs text-muted-foreground/50">
              Session files are stored locally in your browser. Use Save Session to export a portable file.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
