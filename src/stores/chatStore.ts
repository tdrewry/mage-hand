import { create } from 'zustand';
import type { ActionHistoryEntry } from '@/types/actionTypes';
import type { DiceRollResult } from '@/lib/diceEngine';
import { emitChatMessage } from '@/lib/net/ephemeral/miscHandlers';

export type ChatEntryType = 'message' | 'action' | 'dice';

export interface ChatMessage {
  id: string;
  type: 'message';
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  /** If set, this message is a whisper only visible to sender + these user IDs */
  whisperTo?: string[];
}

export interface ChatActionEntry {
  id: string;
  type: 'action';
  action: ActionHistoryEntry;
  timestamp: number;
}

export interface ChatDiceEntry {
  id: string;
  type: 'dice';
  roll: DiceRollResult;
  timestamp: number;
}

export type ChatEntry = ChatMessage | ChatActionEntry | ChatDiceEntry;

interface ChatState {
  entries: ChatEntry[];
  /** Add a local message and broadcast to peers */
  addMessage: (senderId: string, senderName: string, text: string, whisperTo?: string[]) => void;
  /** Add a message received from a remote peer (no re-broadcast) */
  addRemoteMessage: (id: string, senderId: string, senderName: string, text: string, timestamp: number, whisperTo?: string[]) => void;
  addActionEntry: (action: ActionHistoryEntry) => void;
  addDiceEntry: (roll: DiceRollResult) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  entries: [],

  addMessage: (senderId, senderName, text, whisperTo) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = Date.now();

    set((s) => ({
      entries: [
        ...s.entries,
        { id, type: 'message' as const, senderId, senderName, text, timestamp, whisperTo },
      ].slice(-200),
    }));

    // Broadcast to peers
    try {
      emitChatMessage(id, senderName, text, whisperTo);
    } catch { /* net may not be available */ }
  },

  addRemoteMessage: (id, senderId, senderName, text, timestamp, whisperTo) =>
    set((s) => {
      // Deduplicate by id
      if (s.entries.some((e) => e.id === id)) return s;
      return {
        entries: [
          ...s.entries,
          { id, type: 'message' as const, senderId, senderName, text, timestamp, whisperTo },
        ].slice(-200),
      };
    }),

  addActionEntry: (action) =>
    set((s) => ({
      entries: [
        ...s.entries,
        {
          id: `chat-action-${action.id}`,
          type: 'action' as const,
          action,
          timestamp: action.timestamp,
        },
      ].slice(-200),
    })),

  addDiceEntry: (roll) =>
    set((s) => {
      const id = `chat-dice-${roll.id}`;
      if (s.entries.some((e) => e.id === id)) return s;
      return {
        entries: [
          ...s.entries,
          { id, type: 'dice' as const, roll, timestamp: roll.timestamp },
        ].slice(-200),
      };
    }),

  clearChat: () => set({ entries: [] }),
}));
