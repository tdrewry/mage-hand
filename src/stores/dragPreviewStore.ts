// src/stores/dragPreviewStore.ts
// Ephemeral store for remote token drag previews.
// Entries are keyed by tokenId and expire if no update arrives within EXPIRY_MS.

import { create } from "zustand";

export interface DragPreview {
  tokenId: string;
  userId: string;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  path: { x: number; y: number }[];
  mode: "freehand" | "directLine";
  lastUpdated: number; // Date.now()
}

interface DragPreviewState {
  /** Active remote drag previews keyed by tokenId. */
  previews: Record<string, DragPreview>;
  beginDrag: (tokenId: string, userId: string, startPos: { x: number; y: number }, mode?: "freehand" | "directLine") => void;
  updateDrag: (tokenId: string, pos: { x: number; y: number }, path?: { x: number; y: number }[]) => void;
  endDrag: (tokenId: string) => void;
  /** Remove all previews for a disconnected user. */
  clearUser: (userId: string) => void;
  /** Remove stale entries older than maxAge ms. */
  expireStale: (maxAge?: number) => void;
}

const DEFAULT_EXPIRY_MS = 400;

export const useDragPreviewStore = create<DragPreviewState>((set) => ({
  previews: {},

  beginDrag: (tokenId, userId, startPos, mode = "freehand") =>
    set((s) => ({
      previews: {
        ...s.previews,
        [tokenId]: {
          tokenId,
          userId,
          startPos,
          currentPos: startPos,
          path: [startPos],
          mode,
          lastUpdated: Date.now(),
        },
      },
    })),

  updateDrag: (tokenId, pos, path) =>
    set((s) => {
      const existing = s.previews[tokenId];
      if (!existing) {
        // Auto-create preview if begin was missed (network reorder / packet loss)
        return {
          previews: {
            ...s.previews,
            [tokenId]: {
              tokenId,
              userId: "unknown",
              startPos: path?.[0] ?? pos,
              currentPos: pos,
              path: path ?? [pos],
              mode: "freehand",
              lastUpdated: Date.now(),
            },
          },
        };
      }
      return {
        previews: {
          ...s.previews,
          [tokenId]: {
            ...existing,
            currentPos: pos,
            path: path ?? [...existing.path, pos],
            lastUpdated: Date.now(),
          },
        },
      };
    }),

  endDrag: (tokenId) =>
    set((s) => {
      const { [tokenId]: _, ...rest } = s.previews;
      return { previews: rest };
    }),

  clearUser: (userId) =>
    set((s) => {
      const filtered: Record<string, DragPreview> = {};
      for (const [k, v] of Object.entries(s.previews)) {
        if (v.userId !== userId) filtered[k] = v;
      }
      return { previews: filtered };
    }),

  expireStale: (maxAge = DEFAULT_EXPIRY_MS) =>
    set((s) => {
      const now = Date.now();
      const filtered: Record<string, DragPreview> = {};
      for (const [k, v] of Object.entries(s.previews)) {
        if (now - v.lastUpdated < maxAge) filtered[k] = v;
      }
      return { previews: filtered };
    }),
}));
