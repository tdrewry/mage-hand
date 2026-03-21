// src/stores/useBroadcastPauseStore.ts
// Tracks the "Pause Broadcasts" DM toggle state.
// When paused: the DM's ephemeral emit is gated (no canvas ops leak to clients),
// Jazz subscriptions on clients are suspended, and a status banner is shown.

import { create } from 'zustand';

interface BroadcastPauseState {
  /** True while broadcasts are paused by a DM. */
  isPaused: boolean;
  /** ID of the DM who initiated the pause. */
  pausedByDM: string | null;
  /** Timestamp when pause began (for UI display). */
  pausedAt: number | null;

  setPaused: (dmId: string) => void;
  setUnpaused: () => void;

  /**
   * DM side: activate the pause.
   * Gates the EphemeralBus, emits canvas.broadcast.pause to clients,
   * and starts a 5s heartbeat interval.
   */
  activatePause: (dmId: string) => void;

  /**
   * DM side: deactivate the pause.
   * Clears heartbeat, emits canvas.broadcast.resume, re-enables EphemeralBus.
   */
  deactivatePause: () => void;
}

/** Heartbeat interval handle */
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL_MS = 5_000;

export const useBroadcastPauseStore = create<BroadcastPauseState>((set, get) => ({
  isPaused: false,
  pausedByDM: null,
  pausedAt: null,

  setPaused: (dmId) => set({ isPaused: true, pausedByDM: dmId, pausedAt: Date.now() }),
  setUnpaused: () => set({ isPaused: false, pausedByDM: null, pausedAt: null }),

  activatePause: (dmId) => {
    set({ isPaused: true, pausedByDM: dmId, pausedAt: Date.now() });

    // Gate the EphemeralBus — no canvas-mutable ops will reach the network
    import('@/lib/net').then(({ ephemeralBus }) => {
      ephemeralBus.setBroadcastPaused(true);
      // Broadcast the pause state to all connected clients
      ephemeralBus.emit('canvas.broadcast.pause', { dmId });
    });

    // Start heartbeat
    if (_heartbeatInterval !== null) clearInterval(_heartbeatInterval);
    _heartbeatInterval = setInterval(() => {
      const { isPaused, pausedByDM } = get();
      if (!isPaused || !pausedByDM) {
        if (_heartbeatInterval !== null) clearInterval(_heartbeatInterval);
        _heartbeatInterval = null;
        return;
      }
      import('@/lib/net').then(({ ephemeralBus }) => {
        ephemeralBus.emit('canvas.broadcast.heartbeat', { dmId: pausedByDM, ts: Date.now() });
      });
    }, HEARTBEAT_INTERVAL_MS);
  },

  deactivatePause: () => {
    // Stop heartbeat
    if (_heartbeatInterval !== null) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }

    const { pausedByDM } = get();
    set({ isPaused: false, pausedByDM: null, pausedAt: null });

    // Un-gate the EphemeralBus and broadcast resume to clients
    import('@/lib/net').then(({ ephemeralBus }) => {
      ephemeralBus.setBroadcastPaused(false);
      ephemeralBus.emit('canvas.broadcast.resume', { dmId: pausedByDM ?? 'unknown' });
    });

  },
}));

