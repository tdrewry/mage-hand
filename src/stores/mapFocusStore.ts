import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MapFocusState {
  /** Opacity multiplier for non-focused active maps (0 = fully transparent, 1 = fully opaque). Default 1 (off). */
  unfocusedOpacity: number;
  /** Gaussian blur in px for non-focused active maps (0–8). Default 0 (off). */
  unfocusedBlur: number;
  /** Whether focus-based selection locking is enabled. Auto-enabled when blur/opacity are non-default. */
  selectionLockEnabled: boolean;

  setUnfocusedOpacity: (value: number) => void;
  setUnfocusedBlur: (value: number) => void;
  setSelectionLockEnabled: (value: boolean) => void;
}

export const useMapFocusStore = create<MapFocusState>()(
  persist(
    (set) => ({
      unfocusedOpacity: 1,
      unfocusedBlur: 0,
      selectionLockEnabled: false,

      setUnfocusedOpacity: (value) => set({ unfocusedOpacity: Math.max(0, Math.min(1, value)) }),
      setUnfocusedBlur: (value) => set({ unfocusedBlur: Math.max(0, Math.min(8, value)) }),
      setSelectionLockEnabled: (value) => set({ selectionLockEnabled: value }),
    }),
    { name: 'map-focus-store' }
  )
);

/**
 * Returns true if map focus effects are active (opacity < 1 or blur > 0).
 */
export function isFocusEffectActive(state: MapFocusState): boolean {
  return state.unfocusedOpacity < 1 || state.unfocusedBlur > 0;
}
