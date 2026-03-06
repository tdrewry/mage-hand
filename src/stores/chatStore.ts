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
  addMessage: (senderId: string, senderName: string, text: string) => void;
  addActionEntry: (action: ActionHistoryEntry) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  entries: [],

  addMessage: (senderId, senderName, text) =>
    set((s) => ({
      entries: [
        ...s.entries,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'message' as const,
          senderId,
          senderName,
          text,
          timestamp: Date.now(),
        },
      ].slice(-200),
    })),

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
