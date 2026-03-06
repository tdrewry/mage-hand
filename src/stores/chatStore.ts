import { create } from 'zustand';
import type { ActionHistoryEntry } from '@/types/actionTypes';

export type ChatEntryType = 'message' | 'action';

export interface ChatMessage {
  id: string;
  type: 'message';
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ChatActionEntry {
  id: string;
  type: 'action';
  action: ActionHistoryEntry;
  timestamp: number;
}

export type ChatEntry = ChatMessage | ChatActionEntry;

interface ChatState {
  entries: ChatEntry[];
  /** Add a local message and broadcast to peers */
  addMessage: (senderId: string, senderName: string, text: string) => void;
  /** Add a message received from a remote peer (no re-broadcast) */
  addRemoteMessage: (id: string, senderId: string, senderName: string, text: string, timestamp: number) => void;
  addActionEntry: (action: ActionHistoryEntry) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  entries: [],

  addMessage: (senderId, senderName, text) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = Date.now();

    set((s) => ({
      entries: [
        ...s.entries,
        { id, type: 'message' as const, senderId, senderName, text, timestamp },
      ].slice(-200),
    }));

    // Broadcast to peers
    try {
      const { emitChatMessage } = require('@/lib/net/ephemeral/miscHandlers');
      emitChatMessage(id, senderName, text);
    } catch { /* net may not be available */ }
  },

  addRemoteMessage: (id, senderId, senderName, text, timestamp) =>
    set((s) => {
      // Deduplicate by id
      if (s.entries.some((e) => e.id === id)) return s;
      return {
        entries: [
          ...s.entries,
          { id, type: 'message' as const, senderId, senderName, text, timestamp },
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

  clearChat: () => set({ entries: [] }),
}));
