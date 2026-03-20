// src/stores/useCanvasEditStatusStore.ts
// Tracks the canvas edit lifecycle state for display in CanvasEditStatusBar.
// Driven by canvas.edit.begin / canvas.edit.end ephemeral events and
// the bridge's resumeCanvasSubscriptions hydration callback.

import { create } from 'zustand';

export type CanvasEditStatus = 'idle' | 'pending' | 'loading' | 'partial';

interface CanvasEditStatusState {
  status: CanvasEditStatus;
  /** ID of the editor who triggered the current edit (for display) */
  ownerId: string | null;

  /** Subscription paused — waiting for host to commit the transform */
  setPending: (ownerId: string) => void;
  /** Subscription resuming — hydrating from Jazz CRDT final state */
  setLoading: () => void;
  /** Hydration complete — all regions/objects at correct positions */
  setIdle: () => void;
  /** WebRTC fallback: canvas.edit.end never arrived, auto-resumed */
  setPartial: () => void;
}

export const useCanvasEditStatusStore = create<CanvasEditStatusState>((set) => ({
  status: 'idle',
  ownerId: null,

  setPending: (ownerId) => set({ status: 'pending', ownerId }),
  setLoading: () => set({ status: 'loading' }),
  setIdle: () => set({ status: 'idle', ownerId: null }),
  setPartial: () => set({ status: 'partial' }),
}));
