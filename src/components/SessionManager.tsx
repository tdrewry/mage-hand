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
}

export const SessionManager: React.FC<SessionManagerProps> = ({ open, onOpenChange }) => {
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
    setServerUrl,
    setCurrentUsername,
    setActiveTransport,
  } = useMultiplayerStore();

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const sessionPlayers = useSessionStore((s) => s.players);
  const currentPlayerId = useSessionStore((s) => s.currentPlayerId);
  const landingUsername = React.useMemo(() => {
    const p = sessionPlayers.find(p => p.id === currentPlayerId);
    return p?.name?.trim() || '';
  }, [sessionPlayers, currentPlayerId]);

  const [username, setUsername] = useState(currentUsername || landingUsername || '');

  // Sync username when dialog opens and a landing identity exists
  React.useEffect(() => {
    if (open && !username && (landingUsername || currentUsername)) {
      setUsername(landingUsername || currentUsername || '');
    }
  }, [open]);
  const [sessionCode, setSessionCode] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [chatText, setChatText] = useState('');
  const [transport, setTransport] = useState<TransportType>('opbridge');

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
        setCurrentUsername(username.trim());
        const info = createJazzSession(username.trim());
        const shortCode = encodeJazzCode(info.sessionCoId);
        setActiveTransport('jazz');

        // Store the short code as the session code so players can copy it
        useMultiplayerStore.getState().setCurrentSession({
          sessionCode: shortCode,
          sessionId: info.sessionCoId,
          createdAt: Date.now(),
          hasPassword: false,
        });

        toast.success(`Jazz session created — code: ${shortCode}`);
      } catch (error) {
        console.error('Failed to create Jazz session:', error);
        toast.error('Failed to create Jazz session');
      } finally {
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
        setCurrentUsername(username.trim());
        const info = await joinJazzSession(resolved.connectionId);
        setActiveTransport('jazz');

        useMultiplayerStore.getState().setCurrentSession({
          sessionCode: resolved.displayCode,
          sessionId: info.sessionCoId,
          createdAt: Date.now(),
          hasPassword: false,
        });

        toast.success(`Joined Jazz session: ${resolved.displayCode}`);
      } else {
        // OpBridge join
        await handleConnect(resolved.connectionId);
      }
    } catch (error) {
      console.error('Failed to join session:', error);
      toast.error('Invalid or expired session code');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveSession = () => {
    netManager.disconnect();
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
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
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
          <div className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-lg border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Session Code</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-bold tracking-wider text-primary">
                      {currentSession.sessionCode}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopySessionCode}
                      className="h-8 w-8"
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Connected Users</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {connectedUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
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
            <Collapsible open={showDebug} onOpenChange={setShowDebug}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full">
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

            <Button
              variant="outline"
              onClick={handleLeaveSession}
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Leave Session
            </Button>
          </div>
        ) : (
          // Session Creation/Join View
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="create">Create Session</TabsTrigger>
              <TabsTrigger value="join">Join Session</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="create-username">Username</Label>
                <Input
                  id="create-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                  disabled={isConnecting}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label>Transport</Label>
                <Select
                  value={transport}
                  onValueChange={(v) => setTransport(v as TransportType)}
                  disabled={isConnecting}
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
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

              {transport === 'opbridge' && (
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <Label htmlFor="create-server-url">Server URL</Label>
                  <Input
                    id="create-server-url"
                    placeholder="ws://localhost:3001"
                    value={localServerUrl}
                    onChange={(e) => setLocalServerUrl(e.target.value)}
                    disabled={isConnecting}
                    className="bg-input border-border text-foreground font-mono text-sm"
                  />
                  <Label htmlFor="create-invite-token">Invite Token (Optional)</Label>
                  <Input
                    id="create-invite-token"
                    placeholder="Enter invite token"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    disabled={isConnecting}
                    className="bg-input border-border text-foreground text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Change server URL to connect to a remote server
                  </p>
                </CollapsibleContent>
              </Collapsible>
              )}

              <Button
                onClick={handleCreateSession}
                disabled={isConnecting || !username.trim()}
                className="w-full"
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
            </TabsContent>

            <TabsContent value="join" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="join-username">Username</Label>
                <Input
                  id="join-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isConnecting}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="join-code">Session Code</Label>
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
                  className="bg-input border-border text-foreground font-mono text-lg tracking-wider"
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

              {/* Only show advanced settings for non-Jazz codes */}
              {!isJazzCode(sessionCode) && (
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Advanced Settings
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    <Label htmlFor="join-server-url">Server URL</Label>
                    <Input
                      id="join-server-url"
                      placeholder="ws://localhost:3001"
                      value={localServerUrl}
                      onChange={(e) => setLocalServerUrl(e.target.value)}
                      disabled={isConnecting}
                      className="bg-input border-border text-foreground font-mono text-sm"
                    />
                    <Label htmlFor="join-invite-token">Invite Token (Optional)</Label>
                    <Input
                      id="join-invite-token"
                      placeholder="Enter invite token"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      disabled={isConnecting}
                      className="bg-input border-border text-foreground text-sm"
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Button
                onClick={handleJoinSession}
                disabled={isConnecting || !username.trim() || !sessionCode.trim()}
                className="w-full"
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
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
