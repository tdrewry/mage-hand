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
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useMultiplayerStore, type TransportType } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { netManager } from '@/lib/net';
import { sendPing, sendChat } from '@/lib/net/demo';
import { createJazzSession, joinJazzSession } from '@/lib/jazz/session';
import { toast } from 'sonner';
import {
  resolveSessionCode,
  generateSessionCode,
  encodeJazzCode,
  isJazzCode,
} from '@/lib/sessionCodeResolver';

export { type TransportType } from '@/stores/multiplayerStore';

interface SessionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'create' | 'join';
}

export const SessionManager: React.FC<SessionManagerProps> = ({ open, onOpenChange, defaultTab }) => {
  const {
    isConnected,
    connectionStatus,
    serverUrl,
    currentSession,
    currentUsername,
    connectedUsers,
    roles,
    permissions,
    lastError,
    activeTransport,
    customJazzUrl,
    setServerUrl,
    setCurrentUsername,
    setActiveTransport,
    setCustomJazzUrl,
  } = useMultiplayerStore();

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [localJazzUrl, setLocalJazzUrl] = useState(customJazzUrl || '');
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
  const [sessionCode, setSessionCode] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [chatText, setChatText] = useState('');
  const [transport, setTransport] = useState<TransportType>('jazz');

  const handleConnect = async (code: string) => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }
    if (!code.trim()) {
      toast.error('Please enter a session code');
      return;
    }

    setServerUrl(localServerUrl);
    setIsConnecting(true);
    try {
      // Get local player's role IDs from sessionStore
      const sessionState = useSessionStore.getState();
      const currentPlayer = sessionState.players.find(p => p.id === sessionState.currentPlayerId);
      const localRoles = currentPlayer?.roleIds;

      await netManager.connect({
        serverUrl: localServerUrl,
        sessionCode: code.trim().toUpperCase(),
        username: username.trim(),
        inviteToken: inviteToken || undefined,
        password: password || undefined,
        roles: localRoles,
      });
      setCurrentUsername(username.trim());
      setActiveTransport('opbridge');
      toast.success(`Connected to session ${code.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect. Is the server running?');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCreateSession = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (transport === 'jazz') {
      setIsConnecting(true);
      try {
        if (localJazzUrl.trim()) {
          setCustomJazzUrl(localJazzUrl.trim());
        } else {
          setCustomJazzUrl(null);
        }

        setCurrentUsername(username.trim());
        
        useMultiplayerStore.getState().setPendingJazzAction({
          type: 'create',
          username: username.trim(),
        });
        
        setActiveTransport('jazz');
        // Reset local connecting lock; let the global UI know we handed off to JazzProvider
        setTimeout(() => setIsConnecting(false), 500);
      } catch (error) {
        console.error('Failed to init Jazz session setup:', error);
        toast.error('Failed to init Jazz session');
        useMultiplayerStore.getState().setActiveTransport(null);
        setIsConnecting(false);
      }
      return;
    }

    // Default: OpBridge / WebSocket
    const code = generateSessionCode();
    setSessionCode(code);
    handleConnect(code);
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

    setIsConnecting(true);
    try {
      const resolved = resolveSessionCode(sessionCode);

      if (resolved.transport === 'jazz') {
        if (localJazzUrl.trim()) {
          setCustomJazzUrl(localJazzUrl.trim());
        } else {
          setCustomJazzUrl(null);
        }
        setCurrentUsername(username.trim());

        useMultiplayerStore.getState().setPendingJazzAction({
          type: 'join',
          username: username.trim(),
          sessionCoId: resolved.connectionId,
        });
        
        setActiveTransport('jazz');
        setTimeout(() => setIsConnecting(false), 500);
      } else {
        // OpBridge join
        await handleConnect(resolved.connectionId);
      }
    } catch (error) {
      console.error('Failed to prep Jazz join:', error);
      toast.error('Failed to prepare Jazz join');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveSession = () => {
    // If Jazz was active, tear down the bridge synchronously BEFORE closing WS
    // so Jazz cleanup happens while the connection is still live
    if (activeTransport === 'jazz') {
      try {
        // Use synchronous import — leaveJazzSession is already loaded at this point
        const { leaveJazzSession } = require('@/lib/jazz/session');
        leaveJazzSession();
      } catch {
        // Fallback: async import (shouldn't normally reach here)
        import('@/lib/jazz/session').then(({ leaveJazzSession }) => {
          leaveJazzSession();
        }).catch(() => {});
      }
    }

    // Tear down WebSocket — sends close frame so server broadcasts presence:leave
    netManager.disconnect();

    // Fully reset multiplayer state to local-only defaults
    useMultiplayerStore.getState().reset();

    setSessionCode('');
    setPassword('');
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

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your Username</span>
                  <span className="font-medium text-foreground">{currentUsername}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Transport</span>
                  <Badge variant="secondary" className="text-xs">
                    {activeTransport === 'jazz' ? (
                      <><Database className="h-3 w-3 mr-1" /> Jazz (CRDT)</>
                    ) : (
                      <><Radio className="h-3 w-3 mr-1" /> OpBridge (WS)</>
                    )}
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
                {permissions.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">Permissions</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {permissions.map(p => (
                        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
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

            {/* Connected Users List */}
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

            {/* Debug Section */}
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
          // Session Creation/Join View
          <Tabs defaultValue={defaultTab || "create"} className="w-full pt-2">
            <TabsList className="grid w-full grid-cols-2 bg-background/50 border border-white/5 p-1 rounded-lg">
              <TabsTrigger value="create" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-md">Create Session</TabsTrigger>
              <TabsTrigger value="join" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-md">Join Session</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="create-username" className="pl-1 text-muted-foreground">Username</Label>
                <Input
                  id="create-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                  disabled={isConnecting}
                  className="bg-background/50 border-white/10 focus-visible:ring-primary h-10"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="pl-1 text-muted-foreground">Transport</Label>
                <Select
                  value={transport}
                  onValueChange={(v) => setTransport(v as TransportType)}
                  disabled={isConnecting}
                >
                  <SelectTrigger className="bg-background/50 border-white/10 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opbridge">
                      <span className="flex items-center gap-2">
                        <Radio className="h-3.5 w-3.5 text-primary" />
                        OpBridge (WebSocket)
                      </span>
                    </SelectItem>
                    <SelectItem value="jazz">
                      <span className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-primary" />
                        Jazz (CRDT)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {transport === 'opbridge'
                    ? 'Real-time sync via WebSocket server (requires running server)'
                    : 'Peer-to-peer CRDT sync via Jazz (no server needed for durable state)'}
                </p>
              </div>

              {transport === 'opbridge' && (
              <div className="space-y-2">
                <Label htmlFor="create-password">Password (Optional)</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Protect your session"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                  disabled={isConnecting}
                  className="bg-input border-border text-foreground"
                />
              </div>
              )}

              {/* Advanced Settings — handles both OpBridge and Jazz dynamically */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="pt-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3 p-4 bg-background/30 rounded-xl border border-white/5">
                  {transport === 'opbridge' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="create-server-url" className="text-xs text-muted-foreground">Server URL</Label>
                        <Input
                          id="create-server-url"
                          placeholder="ws://localhost:3001"
                          value={localServerUrl}
                          onChange={(e) => setLocalServerUrl(e.target.value)}
                          disabled={isConnecting}
                          className="bg-background/50 border-white/10 font-mono text-sm h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="create-invite-token" className="text-xs text-muted-foreground">Invite Token (Optional)</Label>
                        <Input
                          id="create-invite-token"
                          placeholder="Enter invite token"
                          value={inviteToken}
                          onChange={(e) => setInviteToken(e.target.value)}
                          disabled={isConnecting}
                          className="bg-background/50 border-white/10 text-sm h-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground/70">
                        Change server URL to connect to a remote server
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="create-jazz-url" className="text-xs text-muted-foreground">Custom Jazz Mesh URL</Label>
                        <Input
                          id="create-jazz-url"
                          placeholder="wss://your-project.mesh.jazz.workers.dev"
                          value={localJazzUrl}
                          onChange={(e) => setLocalJazzUrl(e.target.value)}
                          disabled={isConnecting}
                          className="bg-background/50 border-white/10 font-mono text-sm h-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground/70">
                        Leave blank to use the default or environment variable synchronization mesh.
                      </p>
                    </>
                  )}
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
                    // Don't force uppercase for Jazz codes (they're case-sensitive)
                    setSessionCode(isJazzCode(val) ? val : val.toUpperCase());
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  maxLength={64}
                  disabled={isConnecting}
                  className={`bg-background/50 border-white/10 focus-visible:ring-primary font-mono text-center h-14 ${
                    sessionCode.length > 12 ? 'text-sm tracking-normal' : 'text-xl tracking-widest uppercase'
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the code shared by your host — the connection type is detected automatically.
                </p>
              </div>

              {/* Only show password for non-Jazz codes */}
              {!isJazzCode(sessionCode) && (
                <div className="space-y-2">
                  <Label htmlFor="join-password">Password (If Required)</Label>
                  <Input
                    id="join-password"
                    type="password"
                    placeholder="Enter session password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                    disabled={isConnecting}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              )}

              {/* Advanced Settings — both Jazz and OpBridge */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3 p-4 bg-background/30 rounded-xl border border-white/5">
                  {!isJazzCode(sessionCode) && sessionCode !== '' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="join-server-url" className="text-xs text-muted-foreground">Server URL</Label>
                        <Input
                          id="join-server-url"
                          placeholder="ws://localhost:3001"
                          value={localServerUrl}
                          onChange={(e) => setLocalServerUrl(e.target.value)}
                          disabled={isConnecting}
                          className="bg-background/50 border-white/10 font-mono text-sm h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="join-invite-token" className="text-xs text-muted-foreground">Invite Token (Optional)</Label>
                        <Input
                          id="join-invite-token"
                          placeholder="Enter invite token"
                          value={inviteToken}
                          onChange={(e) => setInviteToken(e.target.value)}
                          disabled={isConnecting}
                          className="bg-background/50 border-white/10 text-sm h-9"
                        />
                      </div>
                    </>
                  ) : (
                    <>
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
                        Leave blank to use the default or environment variable synchronization mesh.
                      </p>
                    </>
                  )}
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
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
