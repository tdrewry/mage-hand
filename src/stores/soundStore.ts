/**
 * Sound preferences store.
 * Controls master volume, per-category volumes, and per-event toggles.
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

  setEnabled: (v: boolean) => void;
  setMasterVolume: (v: number) => void;
  setCategoryVolume: (cat: SoundEventCategory, v: number) => void;
  setCategoryVolumes: (vols: Record<string, number>) => void;
  toggleEvent: (event: string, disabled: boolean) => void;
  setDisabledEvents: (map: Record<string, boolean>) => void;
  reset: () => void;
}

const DEFAULT_STATE = {
  enabled: true,
  masterVolume: 0.5,
  categoryVolumes: {} as Record<string, number>,
  disabledEvents: {} as Record<string, boolean>,
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

      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'magehand-sound-prefs',
    }
  )
);
