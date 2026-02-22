import React, { useState } from "react";
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
  Radio,
  MessageSquare,
  Move,
  RefreshCw,
  Plus,
  Send,
} from "lucide-react";

export const NetworkDemoCardContent: React.FC = () => {
  const { isConnected, connectionStatus } = useMultiplayerStore();
  const tokens = useSessionStore((s) => s.tokens);
  const [pingMsg, setPingMsg] = useState("hello");
  const [chatMsg, setChatMsg] = useState("");
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [moveX, setMoveX] = useState("300");
  const [moveY, setMoveY] = useState("300");

  const disabled = !isConnected;

  return (
    <div className="p-3 space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge
          variant={isConnected ? "default" : "outline"}
          className="text-xs"
        >
          {connectionStatus}
        </Badge>
        {disabled && (
          <span className="text-xs text-muted-foreground">
            Connect to a session first
          </span>
        )}
      </div>

      <Separator />

      {/* Ping */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Ping</p>
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
        <p className="text-xs font-medium text-muted-foreground">Chat</p>
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
          Token Move
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
            Sync All Tokens
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={createAndSyncDemoToken}
            disabled={disabled}
            className="flex-1"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create & Sync
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sync broadcasts token positions to all connected clients. Create & Sync adds a demo token and syncs.
        </p>
      </div>
    </div>
  );
};
