import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Users, 
  Copy, 
  Check, 
  Settings, 
  LogIn, 
  Plus,
  Wifi,
  WifiOff,
  Loader2
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
import { syncManager } from '@/lib/syncManager';
import { toast } from 'sonner';

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
    setServerUrl,
    setCurrentUsername,
  } = useMultiplayerStore();

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [username, setUsername] = useState(currentUsername || '');
  const [sessionCode, setSessionCode] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize SyncManager when server URL changes
  useEffect(() => {
    if (localServerUrl && localServerUrl !== serverUrl) {
      setServerUrl(localServerUrl);
    }
  }, [localServerUrl, serverUrl, setServerUrl]);

  // Generate random session code
  const generateSessionCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateSession = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    // Persist the current server URL to localStorage
    setServerUrl(localServerUrl);

    setIsConnecting(true);
    try {
      // Initialize sync manager
      await syncManager.initialize(localServerUrl);
      await syncManager.connect();

      // Create session
      await syncManager.createSession(username.trim(), password || undefined);
      
      setCurrentUsername(username.trim());
      toast.success('Session created successfully!');
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create session. Is the server running?');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleJoinSession = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (!sessionCode.trim()) {
      toast.error('Please enter a session code');
      return;
    }

    // Persist the current server URL to localStorage
    setServerUrl(localServerUrl);

    setIsConnecting(true);
    try {
      // Initialize sync manager
      await syncManager.initialize(localServerUrl);
      await syncManager.connect();

      // Join session
      await syncManager.joinSession(
        sessionCode.trim().toUpperCase(), 
        username.trim(), 
        password || undefined
      );
      
      setCurrentUsername(username.trim());
      toast.success(`Joined session ${sessionCode.toUpperCase()}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to join session:', error);
      toast.error('Failed to join session. Check the code and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveSession = () => {
    syncManager.leaveSession();
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
      case 'reconnecting':
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {connectionStatus === 'reconnecting' ? 'Reconnecting' : 'Connecting'}
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
                    placeholder="http://localhost:3000"
                    value={localServerUrl}
                    onChange={(e) => setLocalServerUrl(e.target.value)}
                    disabled={isConnecting}
                    className="bg-input border-border text-foreground font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Change this to connect to a remote server
                  </p>
                </CollapsibleContent>
              </Collapsible>

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
                  placeholder="Enter 6-character code"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={isConnecting}
                  className="bg-input border-border text-foreground font-mono text-lg tracking-wider uppercase"
                />
              </div>

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
                    placeholder="http://localhost:3000"
                    value={localServerUrl}
                    onChange={(e) => setLocalServerUrl(e.target.value)}
                    disabled={isConnecting}
                    className="bg-input border-border text-foreground font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Change this to connect to a remote server
                  </p>
                </CollapsibleContent>
              </Collapsible>

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
