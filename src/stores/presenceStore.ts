// src/stores/presenceStore.ts
// Ephemeral presence data for connected users (viewing map, current activity).
// Fed by EphemeralBus handlers; entries auto-expire via TTLCache.

import { create } from "zustand";

export interface UserPresence {
  userId: string;
  /** Which map the user is currently viewing (null = none/landing) */
  viewingMapId: string | null;
  /** Free-text activity description (e.g. "editing tokens", "viewing map") */
  activity: string | null;
  lastSeen: number;
}

interface PresenceState {
  /** Map of userId → presence info */
  presence: Record<string, UserPresence>;

  setViewingMap: (userId: string, mapId: string | null) => void;
  setActivity: (userId: string, activity: string | null) => void;
  removePresence: (userId: string) => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  presence: {},

  setViewingMap: (userId, mapId) =>
    set((state) => ({
      presence: {
        ...state.presence,
        [userId]: {
          ...(state.presence[userId] ?? { userId, viewingMapId: null, activity: null, lastSeen: 0 }),
          viewingMapId: mapId,
          lastSeen: Date.now(),
        },
      },
    })),

  setActivity: (userId, activity) =>
    set((state) => ({
      presence: {
        ...state.presence,
        [userId]: {
          ...(state.presence[userId] ?? { userId, viewingMapId: null, activity: null, lastSeen: 0 }),
          activity,
          lastSeen: Date.now(),
        },
      },
    })),

  removePresence: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.presence;
      return { presence: rest };
    }),
}));
