import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { useSessionStore } from "@/stores/sessionStore";
import {
  sendPing,
  sendChat,
  sendTokenMove,
  sendSyncTokens,
  createAndSyncDemoToken,
} from "@/lib/net/demo";
import {
  createJazzSession,
  joinJazzSession,
  leaveJazzSession,
  getCurrentJazzSession,
} from "@/lib/jazz/session";
import {
  Radio,
  MessageSquare,
  Move,
  RefreshCw,
  Plus,
  Music,
  LogIn,
  LogOut,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const NetworkDemoCardContent: React.FC = () => {
  const { isConnected, connectionStatus, webRtcConnections } = useMultiplayerStore();
  const tokens = useSessionStore((s) => s.tokens);
  const [pingMsg, setPingMsg] = useState("hello");
  const [chatMsg, setChatMsg] = useState("");
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [moveX, setMoveX] = useState("300");
  const [moveY, setMoveY] = useState("300");

  // Jazz transport state
  const [jazzSessionName, setJazzSessionName] = useState("My Session");
  const [jazzJoinId, setJazzJoinId] = useState("");
  const [jazzSession, setJazzSession] = useState(getCurrentJazzSession());
  const [jazzLoading, setJazzLoading] = useState(false);

  const disabled = !isConnected;

  const handleCreateJazzSession = useCallback(() => {
    try {
      const session = createJazzSession(jazzSessionName || "Untitled");
      setJazzSession(session);
      toast.success(`Jazz session created: ${session.sessionCoId.slice(0, 12)}…`);
    } catch (err: any) {
      toast.error(`Failed to create Jazz session: ${err.message}`);
      console.error(err);
    }
  }, [jazzSessionName]);

  const handleJoinJazzSession = useCallback(async () => {
    if (!jazzJoinId.trim()) {
      toast.error("Enter a session ID to join");
      return;
    }
    setJazzLoading(true);
    try {
      const session = await joinJazzSession(jazzJoinId.trim());
      setJazzSession(session);
      toast.success(`Joined Jazz session (${session.name})`);
    } catch (err: any) {
      toast.error(`Failed to join: ${err.message}`);
      console.error(err);
    } finally {
      setJazzLoading(false);
    }
  }, [jazzJoinId]);

  const handleLeaveJazzSession = useCallback(() => {
    leaveJazzSession();
    setJazzSession(null);
    toast.info("Left Jazz session");
  }, []);

  const handleCopySessionId = useCallback(() => {
    if (jazzSession?.sessionCoId) {
      navigator.clipboard.writeText(jazzSession.sessionCoId);
      toast.success("Session ID copied to clipboard");
    }
  }, [jazzSession]);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Badge
          variant={isConnected ? "default" : "outline"}
          className="text-xs"
        >
          OpBridge: {connectionStatus}
        </Badge>
        {disabled && (
          <span className="text-xs text-muted-foreground">
            Connect to a session first
          </span>
        )}
      </div>

      {webRtcConnections.length > 0 && (
        <div className="pt-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">WebRTC Peers</p>
          <div className="space-y-1">
            {webRtcConnections.map((conn) => (
              <div key={conn.peerId} className="flex items-center justify-between text-xs bg-background/50 border border-white/5 rounded px-2 py-1">
                <span className="truncate max-w-[120px]" title={conn.peerId}>{conn.peerId}</span>
                <Badge variant="outline" className={`text-[10px] h-4 ${conn.status === 'connected' ? 'bg-success/20 text-success border-success/30' : ''}`}>
                  {conn.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* ── Jazz Transport Section ── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Music className="h-3.5 w-3.5 text-primary" />
          Jazz Transport (CRDT)
        </p>

        {jazzSession ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs bg-primary">
                Connected
              </Badge>
              <span className="text-[10px] text-muted-foreground truncate flex-1">
                {jazzSession.sessionCoId}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={handleCopySessionId}
                title="Copy session ID"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Session: {jazzSession.name}</span>
              <span>({jazzSession.isCreator ? "creator" : "joined"})</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLeaveJazzSession}
              className="w-full text-xs"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Leave Jazz Session
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Create */}
            <div className="flex gap-2">
              <Input
                value={jazzSessionName}
                onChange={(e) => setJazzSessionName(e.target.value)}
                placeholder="Session name"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateJazzSession}
                className="shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create
              </Button>
            </div>
            {/* Join */}
            <div className="flex gap-2">
              <Input
                value={jazzJoinId}
                onChange={(e) => setJazzJoinId(e.target.value)}
                placeholder="Session CoValue ID"
                className="h-8 text-xs font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleJoinJazzSession}
                disabled={jazzLoading}
                className="shrink-0"
              >
                <LogIn className="h-3.5 w-3.5 mr-1" />
                {jazzLoading ? "…" : "Join"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Requires <code className="text-[10px]">npm run dev:jazz</code> sync server running on port 4200.
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Ping */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Ping (OpBridge)</p>
        <div className="flex gap-2">
          <Input
            value={pingMsg}
            onChange={(e) => setPingMsg(e.target.value)}
            placeholder="Ping message"
            className="h-8 text-xs"
            disabled={disabled}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendPing(pingMsg)}
            disabled={disabled}
          >
            <Radio className="h-3.5 w-3.5 mr-1" />
            Ping
          </Button>
        </div>
      </div>

      <Separator />

      {/* Chat */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Chat (OpBridge)</p>
        <div className="flex gap-2">
          <Input
            value={chatMsg}
            onChange={(e) => setChatMsg(e.target.value)}
            placeholder="Chat message"
            className="h-8 text-xs"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatMsg.trim()) {
                sendChat(chatMsg.trim());
                setChatMsg("");
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (chatMsg.trim()) {
                sendChat(chatMsg.trim());
                setChatMsg("");
              }
            }}
            disabled={disabled || !chatMsg.trim()}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Send
          </Button>
        </div>
      </div>

      <Separator />

      {/* Token Move */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Token Move (OpBridge)
        </p>
        <select
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={selectedTokenId}
          onChange={(e) => setSelectedTokenId(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select a token…</option>
          {tokens.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label || t.name} ({t.id.slice(-6)})
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Input
            value={moveX}
            onChange={(e) => setMoveX(e.target.value)}
            placeholder="X"
            className="h-8 text-xs w-20"
            type="number"
            disabled={disabled}
          />
          <Input
            value={moveY}
            onChange={(e) => setMoveY(e.target.value)}
            placeholder="Y"
            className="h-8 text-xs w-20"
            type="number"
            disabled={disabled}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedTokenId) {
                sendTokenMove(
                  selectedTokenId,
                  parseFloat(moveX),
                  parseFloat(moveY)
                );
              }
            }}
            disabled={disabled || !selectedTokenId}
          >
            <Move className="h-3.5 w-3.5 mr-1" />
            Move
          </Button>
        </div>
      </div>

      <Separator />

      {/* Token Sync */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Token Sync ({tokens.length} tokens)
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={sendSyncTokens}
            disabled={disabled}
            className="flex-1"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Sync (OpBridge)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={createAndSyncDemoToken}
            disabled={disabled && !jazzSession}
            className="flex-1"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Token
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          If Jazz session is active, new tokens auto-sync via CRDT bridge.
        </p>
      </div>
    </div>
  );
};
