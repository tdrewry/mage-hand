/**
 * Sound preferences store.
 * Controls master volume, per-category volumes, per-event toggles,
 * event audio queues, and ambient loop state.
 * Persisted to localStorage for cross-session consistency.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SoundEventCategory } from '@/lib/soundEngine';

interface SoundState {
  /** Global sound on/off */
  enabled: boolean;
  /** Master volume 0–1 */
  masterVolume: number;
  /** Per-category volume overrides 0–1 */
  categoryVolumes: Record<string, number>;
  /** Per-event disable flags (true = muted) */
  disabledEvents: Record<string, boolean>;

  /** Per-event audio queues — maps event name → array of audio library IDs.
   *  When triggered, a random entry from the queue is played instead of the synth. */
  eventQueues: Record<string, string[]>;

  /** Currently-active ambient loop ID (builtin:xxx or library UUID), null if none. */
  activeAmbientLoopId: string | null;
  /** Ambient volume multiplier 0–1 (stacks with master + category). */
  ambientVolume: number;
  /** Library IDs that are designated as ambient loops (shown in the ambient section). */
  customAmbientLoopIds: string[];

  // ── Actions ──
  setEnabled: (v: boolean) => void;
  setMasterVolume: (v: number) => void;
  setCategoryVolume: (cat: SoundEventCategory, v: number) => void;
  setCategoryVolumes: (vols: Record<string, number>) => void;
  toggleEvent: (event: string, disabled: boolean) => void;
  setDisabledEvents: (map: Record<string, boolean>) => void;

  addToEventQueue: (event: string, libraryId: string) => void;
  removeFromEventQueue: (event: string, libraryId: string) => void;
  setEventQueues: (queues: Record<string, string[]>) => void;

  setActiveAmbientLoopId: (id: string | null) => void;
  setAmbientVolume: (v: number) => void;
  addCustomAmbientLoop: (libraryId: string) => void;
  removeCustomAmbientLoop: (libraryId: string) => void;

  reset: () => void;
}

const DEFAULT_STATE = {
  enabled: true,
  masterVolume: 0.5,
  categoryVolumes: {} as Record<string, number>,
  disabledEvents: {} as Record<string, boolean>,
  eventQueues: {} as Record<string, string[]>,
  activeAmbientLoopId: null as string | null,
  ambientVolume: 0.5,
  customAmbientLoopIds: [] as string[],
};

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setEnabled: (v) => set({ enabled: v }),
      setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(1, v)) }),

      setCategoryVolume: (cat, v) =>
        set((s) => ({
          categoryVolumes: { ...s.categoryVolumes, [cat]: Math.max(0, Math.min(1, v)) },
        })),

      setCategoryVolumes: (vols) => set({ categoryVolumes: vols }),

      toggleEvent: (event, disabled) =>
        set((s) => ({
          disabledEvents: { ...s.disabledEvents, [event]: disabled },
        })),

      setDisabledEvents: (map) => set({ disabledEvents: map }),

      // ── Event Queues ──
      addToEventQueue: (event, libraryId) =>
        set((s) => {
          const existing = s.eventQueues[event] ?? [];
          if (existing.includes(libraryId)) return s;
          return { eventQueues: { ...s.eventQueues, [event]: [...existing, libraryId] } };
        }),

      removeFromEventQueue: (event, libraryId) =>
        set((s) => {
          const existing = s.eventQueues[event] ?? [];
          return { eventQueues: { ...s.eventQueues, [event]: existing.filter(id => id !== libraryId) } };
        }),

      setEventQueues: (queues) => set({ eventQueues: queues }),

      // ── Ambient ──
      setActiveAmbientLoopId: (id) => set({ activeAmbientLoopId: id }),
      setAmbientVolume: (v) => set({ ambientVolume: Math.max(0, Math.min(1, v)) }),

      addCustomAmbientLoop: (libraryId) =>
        set((s) => {
          if (s.customAmbientLoopIds.includes(libraryId)) return s;
          return { customAmbientLoopIds: [...s.customAmbientLoopIds, libraryId] };
        }),

      removeCustomAmbientLoop: (libraryId) =>
        set((s) => ({
          customAmbientLoopIds: s.customAmbientLoopIds.filter(id => id !== libraryId),
        })),

      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'magehand-sound-prefs',
    }
  )
);
