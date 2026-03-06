import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Send, Swords, Target, Check, X, Skull, MessageSquare } from 'lucide-react';
import { useChatStore, type ChatEntry, type ChatMessage, type ChatActionEntry } from '@/stores/chatStore';
import { useMiscEphemeralStore } from '@/stores/miscEphemeralStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { emitChatTyping } from '@/lib/net/ephemeral/miscHandlers';
import type { AttackResolution } from '@/types/actionTypes';

const RESOLUTION_LABELS: Record<AttackResolution, { label: string; className: string }> = {
  critical_miss: { label: 'Crit Miss', className: 'text-destructive' },
  miss: { label: 'Miss', className: 'text-muted-foreground' },
  half: { label: 'Half', className: 'text-blue-400' },
  hit: { label: 'Hit', className: 'text-green-400' },
  critical_threat: { label: 'Crit Threat', className: 'text-yellow-400' },
  critical_hit: { label: 'Crit Hit', className: 'text-orange-400' },
};

function ChatMessageBubble({ entry }: { entry: ChatMessage }) {
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const isSelf = entry.senderId === currentUserId;

  return (
    <div className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-muted-foreground px-1">{entry.senderName}</span>
      <div
        className={`rounded-lg px-3 py-1.5 text-sm max-w-[85%] break-words ${
          isSelf
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {entry.text}
      </div>
      <span className="text-[9px] text-muted-foreground/60 px-1">
        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function ChatActionBubble({ entry }: { entry: ChatActionEntry }) {
  const { action } = entry;
  const hitCount = action.targets.filter(
    (t) => t.resolution === 'hit' || t.resolution === 'critical_hit' || t.resolution === 'critical_threat'
  ).length;
  const totalTargets = action.targets.length;

  return (
    <div className="mx-2 my-1">
      <div className="rounded-lg border border-border bg-card/50 p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <Swords className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground">
            {action.sourceTokenName}
          </span>
          <span className="text-[10px] text-muted-foreground">used</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {action.attack.name}
          </Badge>
        </div>

        <div className="space-y-0.5">
          {action.targets.map((t, i) => {
            const res = RESOLUTION_LABELS[t.resolution] || RESOLUTION_LABELS.miss;
            return (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <Target className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{t.tokenName}</span>
                <span className={`font-medium ${res.className}`}>{res.label}</span>
                {t.damage.adjustedTotal > 0 && (
                  <span className="text-destructive font-mono text-[10px]">
                    -{t.damage.adjustedTotal} {t.damage.damageType}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground/60">
            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {hitCount}/{totalTargets} hit
          </span>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  const chatTyping = useMiscEphemeralStore((s) => s.chatTyping);
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);

  const typingNames = Object.keys(chatTyping)
    .filter((uid) => uid !== currentUserId)
    .map((uid) => {
      const user = connectedUsers.find((u) => u.userId === uid);
      return user?.username || 'Someone';
    });

  if (typingNames.length === 0) return null;

  const label =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length === 2
        ? `${typingNames[0]} and ${typingNames[1]} are typing...`
        : `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;

  return (
    <div className="px-3 py-1 text-[10px] text-muted-foreground italic animate-pulse">
      {label}
    </div>
  );
}

export const ChatCardContent: React.FC = () => {
  const entries = useChatStore((s) => s.entries);
  const addMessage = useChatStore((s) => s.addMessage);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const currentUsername = useMultiplayerStore((s) => s.currentUsername);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    addMessage(currentUserId || 'local', currentUsername || 'You', text);
    setDraft('');
  }, [draft, addMessage, currentUserId, currentUsername]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else {
        try { emitChatTyping(); } catch { /* net may be off */ }
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Chat log */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="p-2 space-y-2">
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">No messages yet</p>
              <p className="text-[10px] opacity-60">Chat messages and action results appear here</p>
            </div>
          )}
          {entries.map((entry) =>
            entry.type === 'message' ? (
              <ChatMessageBubble key={entry.id} entry={entry} />
            ) : (
              <ChatActionBubble key={entry.id} entry={entry} />
            )
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Typing indicator */}
      <TypingIndicator />

      {/* Input */}
      <div className="p-2 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button size="sm" className="h-8 px-3 shrink-0" onClick={handleSend} disabled={!draft.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
