import React, { useState } from 'react';
import { 
  Users, 
  Copy, 
  Check, 
  Settings, 
  LogIn, 
  Plus,
  Wifi,
  WifiOff,
  Loader2,
  Send,
  Zap,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { netManager } from '@/lib/net';
import { getOrCreateClientId } from '@/lib/net/NetworkConstants';
import { sendPing, sendChat } from '@/lib/net/demo';
import { toast } from 'sonner';
import {
  resolveSessionCode,
  generateSessionCode,
  isJazzCode,
  encodeJazzCode,
} from '@/lib/sessionCodeResolver';

export const SessionManager: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'create' | 'join';
}> = ({ open, onOpenChange, defaultTab }) => {
  const {
    isConnected,
    connectionStatus,
    currentSession,
    currentUsername,
    connectedUsers,
    roles,
    permissions,
    lastError,
    activeTransport,
    customJazzUrl,
    customRegistryId,
    setCurrentUsername,
    setCustomJazzUrl,
    setCustomRegistryId,
  } = useMultiplayerStore();

  const [localJazzUrl, setLocalJazzUrl] = useState(customJazzUrl || '');
  const [localRegistryId, setLocalRegistryId] = useState(customRegistryId || '');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const sessionPlayers = useSessionStore((s) => s.players);
  const currentPlayerId = useSessionStore((s) => s.currentPlayerId);
  const landingUsername = React.useMemo(() => {
    const p = sessionPlayers.find(p => p.id === currentPlayerId);
    return p?.name?.trim() || '';
  }, [sessionPlayers, currentPlayerId]);

  const [username, setUsername] = useState(currentUsername || landingUsername || '');

  // Always pre-fill from landing identity when dialog opens
  React.useEffect(() => {
    if (open) {
      const preferred = landingUsername || currentUsername || '';
      if (preferred && preferred !== username) {
        setUsername(preferred);
      }
    }
  }, [open, landingUsername, currentUsername]);

  const initialSessionCode = useSessionStore.getState().isFromUrl ? useSessionStore.getState().sessionId : '';
  const [sessionCode, setSessionCode] = useState(initialSessionCode);
  
  // Sync local state if sessionId changes externally (e.g. from URL init)
  React.useEffect(() => {
      const state = useMultiplayerStore.getState();
      if (state.isConnected && state.currentSession) {
        // If already connected to a session, use its code
        setSessionCode(state.currentSession.sessionCode || '');
      } else {
        // Otherwise, use the initial code from URL or clear it
        const s = useSessionStore.getState();
        const current = s.isFromUrl ? s.sessionId : '';
        if (current && current !== sessionCode) {
          setSessionCode(current);
        } else if (!current && sessionCode) {
          // Clear sessionCode if no longer from URL and not connected
          setSessionCode('');
        }
      }
  }, [initialSessionCode, isConnected, currentSession]); // Depend on connection status and current session

  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [chatText, setChatText] = useState('');
  const [vanityCode, setVanityCode] = useState('');

  const handleCreateSession = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setIsConnecting(true);
    try {
      if (localJazzUrl.trim()) {
        setCustomJazzUrl(localJazzUrl.trim());
      } else {
        setCustomJazzUrl(null);
      }

      setCurrentUsername(username.trim());
      useMultiplayerStore.getState().setActiveTransport('jazz');
      
      // Dynamic imports for heavy session logic
      const { createJazzSession } = await import('@/lib/jazz/session');
      const { JazzTransport } = await import('@/lib/net/transports/JazzTransport');
      const { WebRTCTransport } = await import('@/lib/net/transports/WebRTCTransport');
      const { registerCode } = await import('@/lib/jazz/registry');
      
      const sessionState = useSessionStore.getState();
      const currentPlayer = sessionState.players.find(p => p.id === sessionState.currentPlayerId);
      const playerRoles = currentPlayer?.roleIds || ['dm'];
      
      const info = createJazzSession(username.trim());
      
      // Use vanity code if provided, otherwise use the existing sessionCode (from URL/State) or generate a new one
      const finalCode = vanityCode.trim() || sessionCode.trim() || generateSessionCode();
      
      // Register code in global registry
      try {
        const { registerCode } = await import('@/lib/jazz/registry');
        await registerCode(finalCode, info.sessionCoId);
      } catch (regErr) {
        console.warn("[SessionManager] Registration failed:", regErr);
        toast.warning("Session created, but short-code registration failed. Please share the direct J- code instead.");
      }
      
      // Hydration stores
      useMultiplayerStore.getState().setRoles(playerRoles);
      useMultiplayerStore.getState().setCurrentSession({
        sessionCode: finalCode,
        sessionId: info.sessionCoId,
        createdAt: Date.now(),
        hasPassword: false,
      });
      
      const clientId = getOrCreateClientId();
      const transport = new JazzTransport(info.root, clientId, username.trim(), playerRoles);
      const ephemeralTransport = new WebRTCTransport(info.root, clientId, playerRoles, finalCode);
      
      await netManager.connectWithTransport({
        transport,
        ephemeralTransport,
        sessionCode: finalCode,
        username: username.trim(),
        roles: playerRoles,
      });
      
      // Update URL to the readable shortCode
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('session', finalCode);
      window.history.replaceState({}, '', newUrl.toString());

      toast.success(`Jazz session created — code: ${finalCode}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to init Jazz session setup:', err);
      toast.error(`Session setup failed: ${err.message}`);
      useMultiplayerStore.getState().setActiveTransport(null);
    } finally {
      setIsConnecting(false);
    }
  };

  /** Unified join — auto-detects transport from the code format. */
  const handleJoinSession = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }
    if (!sessionCode.trim()) {
      toast.error('Please enter a session code');
      return;
    }

    const intentCode = sessionCode.trim();
    
    setIsConnecting(true);
    const searchToast = toast.loading('Searching for session...');
    
    try {
      let resolved;
      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        resolved = await resolveSessionCode(intentCode);
        if (resolved.transport === 'jazz') break;
        
        attempt++;
        if (attempt < maxAttempts) {
          console.log(`[SessionManager] Registry entry not found for ${intentCode}, retrying ${attempt}/${maxAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      toast.dismiss(searchToast);

      if (resolved && resolved.transport === 'jazz') {
        if (localJazzUrl.trim()) {
          setCustomJazzUrl(localJazzUrl.trim());
        } else {
          setCustomJazzUrl(null);
        }
        setCurrentUsername(username.trim());
        useMultiplayerStore.getState().setActiveTransport('jazz');

        // Dynamic imports for heavy session logic
        const { joinJazzSession } = await import('@/lib/jazz/session');
        const { JazzTransport } = await import('@/lib/net/transports/JazzTransport');
        const { WebRTCTransport } = await import('@/lib/net/transports/WebRTCTransport');
        
        const sessionState = useSessionStore.getState();
        const currentPlayer = sessionState.players.find(p => p.id === sessionState.currentPlayerId);
        const playerRoles = currentPlayer?.roleIds || ['player'];
        
        const info = await joinJazzSession(resolved.connectionId);
        const shortCode = resolved.displayCode;
        
        // Hydration stores
        useMultiplayerStore.getState().setRoles(playerRoles);
        useMultiplayerStore.getState().setCurrentSession({
          sessionCode: shortCode,
          sessionId: info.sessionCoId,
          createdAt: Date.now(),
          hasPassword: false,
        });
        
        const clientId = getOrCreateClientId();
        const transport = new JazzTransport(info.root, clientId, username.trim(), playerRoles);
        const ephemeralTransport = new WebRTCTransport(info.root, clientId, playerRoles, shortCode);
        
        await netManager.connectWithTransport({
          transport,
          ephemeralTransport,
          sessionCode: shortCode,
          username: username.trim(),
          roles: playerRoles,
        });
        
        // Update URL and SessionStore to the readable shortCode
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('session', shortCode);
        window.history.replaceState({}, '', newUrl.toString());
        
        useSessionStore.setState({ sessionId: shortCode });

        toast.success(`Joined Jazz session ${shortCode}`);
        onOpenChange(false);
      } else {
        toast.error('Could not find session. Please check the code and try again.');
      }
    } catch (error) {
      console.error('Failed to prep Jazz join:', error);
      toast.error('Failed to prepare Jazz join');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveSession = () => {
    const currentActiveTransport = useMultiplayerStore.getState().activeTransport;
    if (currentActiveTransport === 'jazz') {
      try {
        import('@/lib/jazz/session').then(({ leaveJazzSession }) => {
          leaveJazzSession();
        }).catch(() => {});
      } catch (e) {}
    }

    // Tear down connection
    netManager.disconnect();

    // Fully reset multiplayer state to local-only defaults
    useMultiplayerStore.getState().reset();

    setSessionCode('');
    toast.info('Left session');
  };

  const handleCopySessionCode = () => {
    if (currentSession?.sessionCode) {
      navigator.clipboard.writeText(currentSession.sessionCode);
      setCopiedCode(true);
      toast.success('Session code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSendPing = () => {
    sendPing(`from ${currentUsername}`);
    toast.info('Ping sent');
  };

  const handleSendChat = () => {
    if (!chatText.trim()) return;
    sendChat(chatText.trim());
    setChatText('');
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Wifi className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <WifiOff className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-background/80 backdrop-blur-xl ring-1 ring-black/5">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-foreground">Multiplayer Sessions</DialogTitle>
            {getConnectionStatusBadge()}
          </div>
          <DialogDescription className="text-muted-foreground">
            {currentSession 
              ? 'Manage your active session or disconnect'
              : 'Create a new session or join an existing one'
            }
          </DialogDescription>
        </DialogHeader>

        {lastError && (
          <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            {lastError}
          </div>
        )}

        {currentSession ? (
          // Active Session View
          <div className="space-y-4 pt-4">
            <div className="p-5 bg-background/40 rounded-xl border border-white/5 shadow-inner space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <Label className="text-xs text-muted-foreground">Session Code</Label>
                  <div className="flex items-center gap-2">
                    <code 
                      className={`font-bold tracking-wider text-primary break-all ${
                        (currentSession.sessionCode?.length ?? 0) > 12 
                          ? 'text-[11px] leading-tight max-w-[200px] text-wrap' 
                          : 'text-2xl'
                      }`}
                      title={currentSession.sessionCode}
                    >
                      {currentSession.sessionCode}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopySessionCode}
                      className="h-8 w-8 shrink-0"
                    >
                      {copiedCode ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {currentSession?.sessionId && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest pl-1">Direct Share Link (Fallback)</Label>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 opacity-70">Always Works</Badge>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-background/30 rounded-lg border border-white/5">
                    <code className="text-[10px] text-primary/70 font-mono truncate flex-1">
                      {encodeJazzCode(currentSession.sessionId)}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(encodeJazzCode(currentSession!.sessionId));
                        toast.success('Direct link copied!');
                      }}
                      className="h-6 w-6 shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your Username</span>
                  <span className="font-medium text-foreground">{currentUsername}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Transport</span>
                  <Badge variant="secondary" className="text-xs">
                    <Database className="h-3 w-3 mr-1" /> Jazz (CRDT)
                  </Badge>
                </div>
                {roles.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Roles</span>
                    <div className="flex gap-1">
                      {roles.map(r => (
                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Connected Users</span>
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {connectedUsers.length}
                  </Badge>
                </div>
              </div>
            </div>

            {connectedUsers.length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">Connected Users</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {connectedUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between p-3 rounded-xl bg-background/30 border border-white/5 backdrop-blur-sm text-sm"
                    >
                      <span className="font-medium text-foreground">{user.username}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.roleIds.length > 0 ? user.roleIds.join(', ') : 'No role'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Collapsible open={showDebug} onOpenChange={setShowDebug} className="pt-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5">
                  <Zap className="h-4 w-4 mr-2" />
                  Debug Tools
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                <Button variant="outline" size="sm" onClick={handleSendPing} className="w-full">
                  Send Ping
                </Button>
                <div className="flex gap-2">
                  <Input
                    placeholder="Chat message..."
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    className="bg-input border-border text-foreground text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleSendChat}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="pt-4 border-t border-white/5">
              <Button
                variant="outline"
                onClick={handleLeaveSession}
                className="w-full h-10 border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all"
              >
                Leave Session
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab || (sessionCode ? "join" : "create")} className="w-full pt-2">
            <TabsList className="grid w-full grid-cols-2 bg-background/50 border border-white/5 p-1 rounded-lg">
              <TabsTrigger value="create" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-md">Create Session</TabsTrigger>
              <TabsTrigger value="join" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-md">Join Session</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="create-username" className="pl-1 text-muted-foreground">Username</Label>
                <Input
                  id="create-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isConnecting}
                  className="bg-background/50 border-white/10 focus-visible:ring-primary h-10"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="pl-1 text-muted-foreground">Transport</Label>
                <div className="p-3 rounded-lg bg-background/30 border border-white/5 flex items-center gap-3">
                  <Database className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Jazz (CRDT)</p>
                    <p className="text-xs text-muted-foreground">Peer-to-peer sync via Jazz (no server needed)</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vanity-code" className="pl-1 text-muted-foreground">Vanity Code (Optional)</Label>
                <Input
                  id="vanity-code"
                  placeholder="e.g. My-Cool-Game"
                  value={vanityCode}
                  onChange={(e) => setVanityCode(e.target.value)}
                  disabled={isConnecting}
                  className="bg-background/50 border-white/10 focus-visible:ring-primary h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Create a human-readable link for your session.
                </p>
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="pt-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3 p-4 bg-background/30 rounded-xl border border-white/5">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-jazz-url" className="text-xs text-muted-foreground">Custom Jazz Mesh URL</Label>
                    <Input
                      id="create-jazz-url"
                      placeholder="wss://your-project.mesh.jazz.workers.dev"
                      value={localJazzUrl}
                      onChange={(e) => {
                        setLocalJazzUrl(e.target.value);
                        setCustomJazzUrl(e.target.value || null);
                      }}
                      disabled={isConnecting}
                      className="bg-background/50 border-white/10 font-mono text-sm h-9"
                    />
                  </div>

                  <Separator className="my-2 opacity-30" />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="registry-id" className="text-xs text-muted-foreground">Registry CoValue ID</Label>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-[10px] text-primary"
                        onClick={async () => {
                          setIsProvisioning(true);
                          const { provisionRegistry } = await import('@/lib/jazz/registry');
                          try {
                            const newId = provisionRegistry();
                            setLocalRegistryId(newId);
                            setCustomRegistryId(newId);
                            toast.success("New registry provisioned!");
                          } catch (e: any) {
                            toast.error(`Provisioning failed: ${e.message}`);
                          } finally {
                            setIsProvisioning(false);
                          }
                        }}
                        disabled={isProvisioning}
                      >
                        {isProvisioning ? 'Provisioning...' : 'Provision New'}
                      </Button>
                    </div>
                    <Input
                      id="registry-id"
                      placeholder="co_zRegistry..."
                      value={localRegistryId}
                      onChange={(e) => {
                        setLocalRegistryId(e.target.value);
                        setCustomRegistryId(e.target.value || null);
                      }}
                      disabled={isConnecting || isProvisioning}
                      className="bg-background/50 border-white/10 font-mono text-[10px] h-8"
                    />
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed italic">
                      Share this ID with peers to enable 6-character short codes on your mesh.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="pt-4 border-t border-white/5">
                <Button
                  onClick={handleCreateSession}
                  disabled={isConnecting || !username.trim()}
                  className="w-full h-10 font-bold shadow-lg shadow-primary/20"
                >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Session
                  </>
                )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="join" className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="join-username" className="pl-1 text-muted-foreground">Username</Label>
                <Input
                  id="join-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isConnecting}
                  className="bg-background/50 border-white/10 focus-visible:ring-primary h-10"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="join-code" className="pl-1 text-muted-foreground">Session Code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g. A3BK7Z or J-a8F2c9Xk"
                  value={sessionCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSessionCode(val);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  maxLength={64}
                  onFocus={(e) => e.target.select()}
                  disabled={isConnecting}
                  className={`bg-background/50 border-white/10 focus-visible:ring-primary font-mono text-center h-14 ${
                    sessionCode.length > 12 ? 'text-sm tracking-normal' : 'text-xl tracking-widest uppercase'
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the code shared by your host.
                </p>
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3 p-4 bg-background/30 rounded-xl border border-white/5">
                  <div className="space-y-1.5">
                    <Label htmlFor="join-jazz-url" className="text-xs text-muted-foreground">Custom Jazz Mesh URL</Label>
                    <Input
                      id="join-jazz-url"
                      placeholder="wss://your-project.mesh.jazz.workers.dev"
                      value={localJazzUrl}
                      onChange={(e) => setLocalJazzUrl(e.target.value)}
                      disabled={isConnecting}
                      className="bg-background/50 border-white/10 font-mono text-sm h-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Leave blank to use the default synchronization mesh.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <div className="pt-4 border-t border-white/5">
                <Button
                  onClick={handleJoinSession}
                  disabled={isConnecting || !username.trim() || !sessionCode.trim()}
                  className="w-full h-12 text-lg font-bold shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Join Session
                  </>
                )}
                </Button>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSessionCode('DEV_LOCAL');
                    setUsername(username || `Tester_${Math.floor(Math.random() * 1000)}`);
                    // Yield briefly to let state update before joining
                    setTimeout(() => handleJoinSession(), 50);
                  }}
                  disabled={isConnecting}
                  className="w-full h-10 text-sm border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all font-mono"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Join Sandbox (DEV_LOCAL)
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
