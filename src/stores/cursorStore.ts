// src/stores/cursorStore.ts
// Reactive store for remote user cursors, fed by ephemeral TTLCache.

import { create } from "zustand";

export interface RemoteCursor {
  userId: string;
  /** World-space position */
  x: number;
  y: number;
  color: string;
  tool?: string;
  /** Timestamp of last update (for staleness checks) */
  lastSeen: number;
}

interface CursorState {
  /** Map of userId → cursor state. Entries are added/updated on receive, removed on TTL expiry. */
  cursors: Record<string, RemoteCursor>;
  /** Whether the DM has enabled cursor sharing globally */
  cursorSharingEnabled: boolean;

  setCursor: (userId: string, cursor: Omit<RemoteCursor, "lastSeen">) => void;
  removeCursor: (userId: string) => void;
  setCursorSharingEnabled: (enabled: boolean) => void;
}

/** Palette of distinct colors for remote cursors, assigned round-robin by index. */
const CURSOR_COLORS = [
  "#f87171", // red-400
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
  "#f472b6", // pink-400
];

let colorIndex = 0;
const userColorMap = new Map<string, string>();

function getColorForUser(userId: string): string {
  let color = userColorMap.get(userId);
  if (!color) {
    color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
    colorIndex++;
    userColorMap.set(userId, color);
  }
  return color;
}

export const useCursorStore = create<CursorState>()((set) => ({
  cursors: {},
  cursorSharingEnabled: true,

  setCursor: (userId, cursor) =>
    set((state) => {
      // Skip update if position hasn't meaningfully changed (within 0.5 world units)
      // Prevents unnecessary React renders and canvas redraws on remote clients
      const existing = state.cursors[userId];
      if (existing) {
        const dx = Math.abs(existing.x - cursor.x);
        const dy = Math.abs(existing.y - cursor.y);
        if (dx < 0.5 && dy < 0.5 && existing.tool === cursor.tool) return state;
      }
      return {
        cursors: {
          ...state.cursors,
          [userId]: {
            ...cursor,
            color: cursor.color || getColorForUser(userId),
            lastSeen: Date.now(),
          },
        },
      };
    }),

  removeCursor: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.cursors;
      return { cursors: rest };
    }),

  setCursorSharingEnabled: (enabled) =>
    set((state) => {
      // When disabling, also clear all remote cursors so nothing lingers
      if (!enabled) {
        return { cursorSharingEnabled: false, cursors: {} };
      }
      return { cursorSharingEnabled: true };
    }),
}));
