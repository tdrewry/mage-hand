import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Swords, Target, MessageSquare, Eye, Users, X } from 'lucide-react';
import { useChatStore, type ChatMessage, type ChatActionEntry } from '@/stores/chatStore';
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
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);
  const isSelf = entry.senderId === currentUserId;
  const isWhisper = entry.whisperTo && entry.whisperTo.length > 0;

  // Build recipient label for whispers
  const whisperLabel = useMemo(() => {
    if (!isWhisper || !entry.whisperTo) return '';
    const names = entry.whisperTo.map((uid) => {
      if (uid === currentUserId) return 'you';
      const user = connectedUsers.find((u) => u.userId === uid);
      return user?.username || 'unknown';
    });
    return names.join(', ');
  }, [isWhisper, entry.whisperTo, connectedUsers, currentUserId]);

  return (
    <div className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1 px-1">
        <span className="text-[10px] text-muted-foreground">{entry.senderName}</span>
        {isWhisper && (
          <span className="text-[9px] italic text-purple-400 flex items-center gap-0.5">
            <Eye className="h-2.5 w-2.5" />
            to {whisperLabel}
          </span>
        )}
      </div>
      <div
        className={`rounded-lg px-3 py-1.5 text-sm max-w-[85%] break-words ${
          isWhisper
            ? 'bg-purple-900/30 text-purple-200 border border-purple-700/50'
            : isSelf
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

function WhisperPicker({
  whisperTargets,
  setWhisperTargets,
}: {
  whisperTargets: string[];
  setWhisperTargets: (targets: string[]) => void;
}) {
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const otherUsers = connectedUsers.filter((u) => u.userId !== currentUserId);

  const isWhisperMode = whisperTargets.length > 0;

  const toggleUser = (userId: string) => {
    setWhisperTargets(
      whisperTargets.includes(userId)
        ? whisperTargets.filter((id) => id !== userId)
        : [...whisperTargets, userId]
    );
  };

  if (otherUsers.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isWhisperMode ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 shrink-0 ${isWhisperMode ? 'bg-purple-700 hover:bg-purple-600 text-purple-100' : ''}`}
          title="Whisper to specific players"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" side="top">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Whisper to...</p>
            {isWhisperMode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px] text-muted-foreground"
                onClick={() => setWhisperTargets([])}
              >
                <X className="h-3 w-3 mr-0.5" /> Clear
              </Button>
            )}
          </div>
          <Separator />
          {otherUsers.map((user) => (
            <label
              key={user.userId}
              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={whisperTargets.includes(user.userId)}
                onCheckedChange={() => toggleUser(user.userId)}
              />
              <span className="text-xs text-foreground">{user.username}</span>
            </label>
          ))}
          {otherUsers.length > 1 && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-[10px]"
                onClick={() => {
                  const allIds = otherUsers.map((u) => u.userId);
                  const allSelected = allIds.every((id) => whisperTargets.includes(id));
                  setWhisperTargets(allSelected ? [] : allIds);
                }}
              >
                <Users className="h-3 w-3 mr-1" />
                {otherUsers.every((u) => whisperTargets.includes(u.userId)) ? 'Deselect All' : 'Select All'}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ChatCardContent: React.FC = () => {
  const entries = useChatStore((s) => s.entries);
  const addMessage = useChatStore((s) => s.addMessage);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const currentUsername = useMultiplayerStore((s) => s.currentUsername);
  const [draft, setDraft] = useState('');
  const [whisperTargets, setWhisperTargets] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter entries: only show messages intended for this user
  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.type !== 'message') return true; // action entries always visible
      if (!entry.whisperTo || entry.whisperTo.length === 0) return true; // public
      // Whisper: show if sender or recipient
      return entry.senderId === currentUserId || (currentUserId && entry.whisperTo.includes(currentUserId));
    });
  }, [entries, currentUserId]);

  // Auto-scroll on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleEntries.length]);

  const isWhisperMode = whisperTargets.length > 0;

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    addMessage(
      currentUserId || 'local',
      currentUsername || 'You',
      text,
      isWhisperMode ? whisperTargets : undefined
    );
    setDraft('');
  }, [draft, addMessage, currentUserId, currentUsername, isWhisperMode, whisperTargets]);

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
          {visibleEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">No messages yet</p>
              <p className="text-[10px] opacity-60">Chat messages and action results appear here</p>
            </div>
          )}
          {visibleEntries.map((entry) =>
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

      {/* Whisper indicator */}
      {isWhisperMode && (
        <div className="px-3 py-1 flex items-center gap-1.5 bg-purple-900/20 border-t border-purple-700/30">
          <Eye className="h-3 w-3 text-purple-400" />
          <span className="text-[10px] text-purple-300">
            Whispering to {whisperTargets.length} player{whisperTargets.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 px-1 ml-auto text-purple-400 hover:text-purple-200"
            onClick={() => setWhisperTargets([])}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-2 flex gap-1.5">
        <WhisperPicker whisperTargets={whisperTargets} setWhisperTargets={setWhisperTargets} />
        <Input
          placeholder={isWhisperMode ? 'Whisper...' : 'Type a message...'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`h-8 text-sm ${isWhisperMode ? 'border-purple-700/50 placeholder:text-purple-400/60' : ''}`}
        />
        <Button
          size="sm"
          className={`h-8 px-3 shrink-0 ${isWhisperMode ? 'bg-purple-700 hover:bg-purple-600' : ''}`}
          onClick={handleSend}
          disabled={!draft.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
