/**
 * Store for edge hatching settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DysonHatchingOptions, DEFAULT_HATCHING_OPTIONS, HATCHING_PRESETS } from '@/lib/shaders/dysonHatchingFilter';

export interface HatchingStore {
  // Enable/disable hatching
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;

  // Hatching options
  options: Required<DysonHatchingOptions>;
  setOptions: (options: Partial<DysonHatchingOptions>) => void;

  // Apply a preset
  applyPreset: (presetName: string) => void;

  // Get preset names
  getPresetNames: () => string[];

  // Reset to defaults
  resetToDefaults: () => void;
}

export const useHatchingStore = create<HatchingStore>()(
  persist(
    (set, get) => ({
      enabled: false,
      options: { ...DEFAULT_HATCHING_OPTIONS },

      setEnabled: (enabled) => set({ enabled }),

      setOptions: (newOptions) =>
        set((state) => ({
          options: { ...state.options, ...newOptions },
        })),

      applyPreset: (presetName) => {
        const preset = HATCHING_PRESETS[presetName];
        if (preset) {
          set((state) => ({
            options: { ...state.options, ...preset },
          }));
        }
      },

      getPresetNames: () => Object.keys(HATCHING_PRESETS),

      resetToDefaults: () =>
        set({
          options: { ...DEFAULT_HATCHING_OPTIONS },
        }),
    }),
    {
      name: 'hatching-store',
      version: 3, // Bump version for outerFade and offset options
    }
  )
);
