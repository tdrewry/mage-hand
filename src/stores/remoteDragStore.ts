// src/stores/remoteDragStore.ts
// Lightweight store tracking remote drag metadata (start position + path) per token.
// The token itself moves via updateTokenPosition — this store only holds decoration data
// so remote clients can render the same ghost/path/distance visuals as the local dragger.

import { create } from 'zustand';

export interface RemoteDragState {
  startPos: { x: number; y: number };
  path: { x: number; y: number }[];
  mode: 'freehand' | 'directLine';
  userId: string;
  /** Epoch ms of last update — used for staleness auto-clear */
  lastUpdateMs: number;
}

interface RemoteDragStore {
  /** Active remote drags keyed by tokenId */
  drags: Record<string, RemoteDragState>;

  beginDrag: (tokenId: string, startPos: { x: number; y: number }, mode: 'freehand' | 'directLine', userId: string) => void;
  updateDrag: (tokenId: string, path: { x: number; y: number }[]) => void;
  endDrag: (tokenId: string) => void;
  /** Remove any drags older than maxAgeMs with no updates */
  expireStale: (maxAgeMs: number) => void;
  clearAll: () => void;
}

export const useRemoteDragStore = create<RemoteDragStore>((set) => ({
  drags: {},

  beginDrag: (tokenId, startPos, mode, userId) =>
    set((state) => ({
      drags: {
        ...state.drags,
        [tokenId]: { startPos, path: [startPos], mode, userId, lastUpdateMs: Date.now() },
      },
    })),

  updateDrag: (tokenId, path) =>
    set((state) => {
      const existing = state.drags[tokenId];
      if (!existing) return state;
      return {
        drags: {
          ...state.drags,
          [tokenId]: { ...existing, path: path && path.length > 0 ? path : existing.path, lastUpdateMs: Date.now() },
        },
      };
    }),

  endDrag: (tokenId) =>
    set((state) => {
      const { [tokenId]: _, ...rest } = state.drags;
      return { drags: rest };
    }),

  expireStale: (maxAgeMs) =>
    set((state) => {
      const now = Date.now();
      const entries = Object.entries(state.drags);
      const fresh = entries.filter(([, d]) => now - d.lastUpdateMs < maxAgeMs);
      if (fresh.length === entries.length) return state; // nothing expired
      return { drags: Object.fromEntries(fresh) };
    }),

  clearAll: () => set({ drags: {} }),
}));
