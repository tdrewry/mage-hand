import React, { useState, useRef, useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Network,
  Wifi,
  WifiOff,
  Users,
  Loader2,
  Trash2,
  Sword,
  ScrollText,
  Edit2,
  Globe,
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
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [pendingLoadData, setPendingLoadData] = useState<ProjectData | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progressive UX: 0 = Identity Setup, 1 = Action Hub
  const [setupStep, setSetupStep] = useState<0 | 1>(0);

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
      setSetupStep(1); // Auto-advance if identity exists
    } else if (roles.length > 0 && selectedRoleIds.length === 0) {
      // Auto-select DM for first user, Player for subsequent
      const isFirstUser = players.length === 0 || !players.some(p => p.name?.trim());
      const defaultRole = isFirstUser ? 'dm' : 'player';
      const role = roles.find(r => r.id === defaultRole);
      if (role) setSelectedRoleIds([role.id]);
    }
  }, [roles, hasValidIdentity, currentPlayer, players]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const setSingleRole = (roleId: string) => {
    setSelectedRoleIds([roleId]);
  };

  const isIdentityReady = username.trim().length > 0 && selectedRoleIds.length > 0;
  const isDMSelected = selectedRoleIds.includes('dm');

  const commitIdentity = () => {
    if (!isIdentityReady) {
      toast.error('Please enter a username and select a role.');
      return;
    }
    
    // Commit identity so other modular components (like SessionManager) can read it
    addPlayer({
      id: currentPlayerId,
      name: username.trim(),
      roleIds: selectedRoleIds,
      isConnected: true,
    });

    setSetupStep(1);
  };

  /** Commit the player identity and set rendering mode based on role */
  const commitIdentityAndLaunch = (launchFn: () => void) => {
    if (!isIdentityReady) {
      toast.error('Identity not configured.');
      setSetupStep(0);
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

  // --- Session Handlers ---
  const handleNewSession = () => {
    if (hasSession) setShowNewConfirm(true); else doNewSession();
  };

  const doNewSession = () => {
    commitIdentityAndLaunch(() => {
      try {
        clearAllStores();
        toast.success('New session started');
        onLaunch();
      } catch (err) {
        toast.error('Failed to start new session');
      }
    });
  };

  const handleSaveSession = async () => {
    if (!hasSession) return toast.error('No active session to save');
    setIsSaving(true);
    try {
      const data = createCurrentProjectData();
      await exportProjectToFile(data, `session-${Date.now()}.mhsession`);
      toast.success('Session saved to disk');
    } catch (err) {
      toast.error('Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSession = () => {
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
      toast.error('Failed to load session file');
    } finally {
      setIsLoading(false);
    }
  };

  const applyAndLaunch = async (data: ProjectData) => {
    try {
      clearAllStores();
      applyProjectData(data);
      if (!isDMSelected) useDungeonStore.getState().setRenderingMode('play');

      // Ensure identity is populated into the loaded session
      addPlayer({
        id: currentPlayerId,
        name: username.trim(),
        roleIds: selectedRoleIds,
        isConnected: true,
      });

      toast.success('Session loaded');
      onLaunch();
    } catch (err) {
      toast.error('Failed to apply session data');
    }
  };

  const confirmLoad = async () => {
    setShowLoadConfirm(false);
    if (!pendingLoadData) fileInputRef.current?.click();
    else {
      await applyAndLaunch(pendingLoadData);
      setPendingLoadData(null);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-background text-foreground relative overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Magical glow effect behind the main card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Title block */}
        <div className="text-center space-y-4 mb-10">
          <h1 className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm pb-3">
            Mage Hand
          </h1>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Virtual Tabletop
          </p>
        </div>

        {/* The Glass Panel */}
        <div className="bg-background/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5">

          {setupStep === 0 && (
            <div className="p-10 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Welcome to the Table</h2>
                <p className="text-muted-foreground">Identify yourself before entering the session.</p>
              </div>

              <div className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80 ml-1">What is your name?</label>
                  <Input
                    type="text"
                    placeholder="Enter your character or real name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={50}
                    className="bg-background/50 h-12 text-lg px-4 border-white/10 focus-visible:ring-primary"
                    onKeyDown={(e) => { if (e.key === 'Enter') commitIdentity(); }}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground/80 ml-1">Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setSingleRole(role.id)}
                        className={`
                          flex flex-col items-center justify-center p-4 rounded-xl border transition-all
                          ${selectedRoleIds.includes(role.id)
                            ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]'
                            : 'bg-background/30 border-white/5 hover:bg-background/50 hover:border-white/20'}
                        `}
                      >
                        {role.id === 'dm' ? <ScrollText className={`w-6 h-6 mb-2 ${selectedRoleIds.includes(role.id) ? 'text-primary' : 'text-muted-foreground'}`} /> : <Sword className={`w-6 h-6 mb-2 ${selectedRoleIds.includes(role.id) ? 'text-primary' : 'text-muted-foreground'}`} />}
                        <span className={`font-semibold ${selectedRoleIds.includes(role.id) ? 'text-primary' : 'text-foreground'}`}>
                          {role.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-lg font-bold shadow-lg"
                  onClick={commitIdentity}
                  disabled={!isIdentityReady}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {setupStep === 1 && (
            <div className="flex flex-col h-full">
              {/* Identity Header */}
              <div className="bg-background/50 border-b border-white/5 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    {isDMSelected ? <ScrollText className="w-5 h-5 text-primary" /> : <Sword className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{username}</h3>
                    <p className="text-xs text-muted-foreground">Playing as {isDMSelected ? 'Dungeon Master' : 'Player'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSetupStep(0)} className="text-muted-foreground hover:text-foreground">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Identity
                </Button>
              </div>

              {/* Action Hub */}
              <div className="p-8">

                {/* Connection Status Banner (if active) */}
                {isConnected && currentSession && (
                  <div className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Network className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-400 flex items-center gap-2">
                        Connected to Session <span className="font-mono bg-green-500/20 px-2 py-0.5 rounded text-xs">{currentSession.sessionCode}</span>
                      </h4>
                      <p className="text-sm text-green-400/80">
                        {connectedUsers.length} player{connectedUsers.length !== 1 ? 's' : ''} online
                      </p>
                    </div>
                    {!syncReady && (
                      <div className="flex items-center gap-2 text-green-400/80 bg-green-500/10 px-3 py-1.5 rounded-full text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" /> Syncing...
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Primary Action: Resume */}
                  {hasSession && (
                    <button
                      onClick={() => commitIdentityAndLaunch(onLaunch)}
                      disabled={isConnected && !syncReady}
                      className="group relative md:col-span-2 overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-all text-left p-6 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Continue Session</h3>
                          <p className="text-muted-foreground">Jump right back into your active local map.</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Actions based on Role */}
                  {isDMSelected ? (
                    <>
                      {/* DM ACTION 1: Host Multiplayer */}
                      <button
                        onClick={() => setSessionManagerOpen(true)}
                        className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-white/5 bg-background/40 hover:bg-white/5 hover:border-white/20 transition-all text-left"
                      >
                        <div className="h-10 w-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-foreground">Host Multiplayer</h4>
                          <p className="text-sm text-muted-foreground mt-1">Start a network server and invite players.</p>
                        </div>
                      </button>

                      {/* DM ACTION 2: Load Campaign */}
                      <button
                        onClick={handleLoadSession}
                        disabled={isLoading}
                        className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-white/5 bg-background/40 hover:bg-white/5 hover:border-white/20 transition-all text-left disabled:opacity-50"
                      >
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-foreground">Load Campaign</h4>
                          <p className="text-sm text-muted-foreground mt-1">Import a saved .mhsession file.</p>
                        </div>
                      </button>

                      {/* DM ACTION 3: New Campaign */}
                      <button
                        onClick={handleNewSession}
                        className="group md:col-span-2 flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-background/20 hover:bg-white/5 hover:border-white/20 transition-all text-left mt-2"
                      >
                        <div className="h-8 w-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center group-hover:text-foreground">
                          <FilePlus className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">Start Fresh Workspace</h4>
                          <p className="text-xs text-muted-foreground">Clear local memory and start a blank map.</p>
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* PLAYER ACTION: Join Multiplayer */}
                      <button
                        onClick={() => setSessionManagerOpen(true)}
                        className="group md:col-span-2 flex flex-col items-center text-center gap-3 p-8 rounded-2xl border border-white/5 bg-background/40 hover:bg-white/5 hover:border-white/20 transition-all"
                      >
                        <div className="h-16 w-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors group-hover:scale-110 duration-300">
                          <Users className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="font-bold text-2xl text-foreground">Join a Session</h4>
                          <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Connect to your DM's hosted multiplayer game using a session code.</p>
                        </div>
                      </button>
                    </>
                  )}
                </div>

              </div>

              {/* Secondary Utility Footer */}
              <div className="mt-auto bg-black/20 border-t border-white/5 p-4 flex flex-wrap gap-2 justify-center">
                <Button variant="ghost" size="sm" onClick={handleSaveSession} disabled={!hasSession || isSaving} className="text-xs text-muted-foreground hover:text-foreground">
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save to Disk
                </Button>
                <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
                {!isDMSelected && (
                  <Button variant="ghost" size="sm" onClick={handleLoadSession} disabled={isLoading} className="text-xs text-muted-foreground hover:text-foreground">
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Load Local
                  </Button>
                )}
                {/* <div className="w-px h-6 bg-white/10 hidden sm:block"></div> */}
                <Button variant="ghost" size="sm" onClick={() => setShowAbout(true)} className="text-xs text-muted-foreground hover:text-foreground">
                  <Info className="w-3.5 h-3.5 mr-1.5" /> About
                </Button>
                <div className="flex-1 min-w-[20px]"></div>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteAllConfirm(true)} className="text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete App Data
                </Button>
              </div>

            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-muted-foreground/40 font-mono">
          VERSION {APP_VERSION}
        </div>

      </div>

      {/* OVERLAYS AND MODALS */}
      <SessionManager open={sessionManagerOpen} onOpenChange={setSessionManagerOpen} />
      <input ref={fileInputRef} type="file" accept=".mhsession,.json" className="hidden" onChange={handleFileSelected} />

      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent className="glass-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a New Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session in memory. Starting a new session will clear all current data.
              Make sure to save your session first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doNewSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Start New Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLoadConfirm && !pendingLoadData} onOpenChange={(open) => { if (!open) setShowLoadConfirm(false); }}>
        <AlertDialogContent className="glass-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Load a Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session in memory. Loading a new session will replace all current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLoadConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoad}>Continue &amp; Select File</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <AlertDialogContent className="border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear all session data, tokens, maps, regions, effects, fog,
              and stored state from this browser instance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                try {
                  clearAllStores();
                  const keysToRemove = Object.keys(localStorage).filter(k =>
                    k.startsWith('vtt-') || k.startsWith('magehand-') || k.startsWith('dungeon-')
                  );
                  keysToRemove.forEach(k => localStorage.removeItem(k));
                  toast.success('All data has been deleted');
                } catch (err) {
                  toast.error('Failed to delete all data');
                }
                setShowDeleteAllConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">About Magehand</DialogTitle>
            <DialogDescription>Tabletop virtual game table</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-foreground/80">
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-3 rounded-lg border border-border">
              <span className="font-medium">Version</span>
              <span className="font-mono text-muted-foreground">{APP_VERSION}</span>
              <span className="font-medium">Format</span>
              <span className="font-mono text-muted-foreground">.mhsession</span>
              <span className="font-medium">Platform</span>
              <span className="text-muted-foreground">Web (React + PixiJS)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Magehand is a browser-based virtual tabletop application supporting fog of war, token management,
              initiative tracking, vision profiles, and multi-layer maps.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
