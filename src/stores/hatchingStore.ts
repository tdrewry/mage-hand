/**
 * Store for edge hatching settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DysonHatchingOptions, DEFAULT_HATCHING_OPTIONS, HATCHING_PRESETS } from '@/lib/shaders/dysonHatchingFilter';

export interface HatchingStore {
  // Enable/disable hatching
  enabled: boolean;
  /**
   * Enables or disables hatching.
   * @param enabled True to enable hatching, false to disable.
   */
  setEnabled: (enabled: boolean) => void;

  /**
   * Sets the hatching options.
   * @param options Partial hatching options to merge with current options.
   */
  setOptions: (options: Partial<DysonHatchingOptions>) => void;

  /**
   * Applies a hatching preset by name.
   * @param presetName The name of the preset to apply.
   */
  applyPreset: (presetName: string) => void;

  /**
   * Gets the names of all available hatching presets.
   * @returns An array of preset names.
   */
  getPresetNames: () => string[];

  /**
   * Resets hatching options to their default values.
   */
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
      version: 4, // Bump version for skipDepth option
    }
  )
);
