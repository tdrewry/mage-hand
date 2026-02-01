import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';

export type EffectQuality = 'performance' | 'balanced' | 'cinematic';

export interface FogEffectSettings {
  postProcessingEnabled: boolean; // Enable PixiJS post-processing
  edgeBlur: number; // 0-20 pixels
  lightFalloff: number; // 0-1, percentage of light radius where inner bright zone ends
  volumetricEnabled: boolean;
  effectQuality: EffectQuality;
  dimZoneOpacity: number; // 0-1, how much fog remains in dim zone (default 0.4)
}

export interface FogSettings {
  enabled: boolean;
  revealAll: boolean; // DM mode - show entire map
  visionRange: number; // Default token vision range in grid units
  fogOpacity: number; // 0-1, how dark the fog is for unexplored areas
  exploredOpacity: number; // 0-1, how dark explored but not visible areas are
  showExploredAreas: boolean; // Whether to show previously explored areas as dimmed
  serializedExploredAreas: string; // Paper.js JSON serialized explored geometry
  fogVersion: number; // Schema version for migration
  
  // Real-time vision during drag feature flag
  realtimeVisionDuringDrag: boolean;
  realtimeVisionThrottleMs: number; // Throttle interval in ms (16-100)
  
  // Post-processing effect settings
  effectSettings: FogEffectSettings;
}

interface FogState extends FogSettings {
  // Actions
  /**
   * Enables or disables the fog of war system.
   * @param enabled True to enable, false to disable.
   */
  setEnabled: (enabled: boolean) => void;

  /**
   * Sets whether the entire map should be revealed (DM mode).
   * @param revealAll True to reveal all, false to use standard fog rules.
   */
  setRevealAll: (revealAll: boolean) => void;

  /**
   * Sets the default vision range for tokens.
   * @param range The vision range in grid units.
   */
  setVisionRange: (range: number) => void;

  /**
   * Sets the opacity of the fog in unexplored areas.
   * @param opacity Opacity value between 0 and 1.
   */
  setFogOpacity: (opacity: number) => void;

  /**
   * Sets the opacity of the fog in explored but currently not visible areas.
   * @param opacity Opacity value between 0 and 1.
   */
  setExploredOpacity: (opacity: number) => void;

  /**
   * Sets whether previously explored areas should be shown as dimmed.
   * @param show True to show explored areas, false to keep them hidden.
   */
  setShowExploredAreas: (show: boolean) => void;

  /**
   * Sets the serialized explored areas geometry data.
   * @param data The serialized geometry string.
   */
  setSerializedExploredAreas: (data: string) => void;

  /**
   * Clears all explored areas, resetting them to unexplored.
   */
  clearExploredAreas: () => void;

  /**
   * Resets the entire fog system to its default state.
   */
  resetFog: () => void;
  
  // Real-time vision during drag actions
  /**
   * Sets whether vision should be updated in real-time during token dragging.
   * @param enabled True to enable real-time updates, false to update only after drag.
   */
  setRealtimeVisionDuringDrag: (enabled: boolean) => void;

  /**
   * Sets the throttle interval for real-time vision updates.
   * @param ms The interval in milliseconds.
   */
  setRealtimeVisionThrottleMs: (ms: number) => void;
  
  // Post-processing effect actions
  /**
   * Enables or disables PixiJS post-processing for fog effects.
   * @param enabled True to enable, false to disable.
   */
  setPostProcessingEnabled: (enabled: boolean) => void;

  /**
   * Sets the blur radius for the fog edge.
   * @param blur The blur radius in pixels (0-20).
   */
  setEdgeBlur: (blur: number) => void;

  /**
   * Sets the light falloff percentage.
   * @param falloff The percentage of light radius where the bright zone ends (0-1).
   */
  setLightFalloff: (falloff: number) => void;

  /**
   * Enables or disables volumetric fog effects.
   * @param enabled True to enable, false to disable.
   */
  setVolumetricEnabled: (enabled: boolean) => void;

  /**
   * Sets the quality level for fog effects.
   * @param quality The quality setting ('performance', 'balanced', or 'cinematic').
   */
  setEffectQuality: (quality: EffectQuality) => void;

  /**
   * Sets the opacity of the dim zone in the fog effect.
   * @param opacity Opacity value between 0 and 1.
   */
  setDimZoneOpacity: (opacity: number) => void;

  /**
   * Updates multiple fog effect settings at once.
   * @param settings Partial fog effect settings to apply.
   */
  setEffectSettings: (settings: Partial<FogEffectSettings>) => void;
}

// Define the store creator separately for better type inference
const fogStoreCreator: StateCreator<FogState> = (set) => ({
  // Initial state
  enabled: false,
  revealAll: false,
  visionRange: 6, // 6 grid units default
  fogOpacity: 0.95,
  exploredOpacity: 0.4,
  showExploredAreas: true,
  serializedExploredAreas: '',
  fogVersion: 1,
  
  // Real-time vision during drag (feature flag - disabled by default)
  realtimeVisionDuringDrag: false,
  realtimeVisionThrottleMs: 32, // ~30fps default
  
  // Post-processing effect settings
  effectSettings: {
    postProcessingEnabled: true, // Enabled by default with fog
    edgeBlur: 8,
    lightFalloff: 0.5, // 50% of light radius is fully bright, rest is dimmer
    volumetricEnabled: false,
    effectQuality: 'balanced' as EffectQuality,
    dimZoneOpacity: 0.4, // 40% fog in dim zone
  },
  
  // Actions - sync happens automatically via syncPatch middleware
  setEnabled: (enabled) => {
    set({ enabled });
  },
  
  setRevealAll: (revealAll) => {
    set({ revealAll });
  },
  
  setVisionRange: (range) => {
    const clampedRange = Math.max(1, Math.min(50, range));
    set({ visionRange: clampedRange });
  },
  
  setFogOpacity: (opacity) => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    set({ fogOpacity: clampedOpacity });
  },
  
  setExploredOpacity: (opacity) => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    set({ exploredOpacity: clampedOpacity });
  },
  
  setShowExploredAreas: (show) => {
    set({ showExploredAreas: show });
  },
  
  setSerializedExploredAreas: (data) => {
    set({ serializedExploredAreas: data });
  },
  
  clearExploredAreas: () => {
    set({ serializedExploredAreas: '' });
  },
  
  resetFog: () => {
    set({
      enabled: false,
      revealAll: false,
      visionRange: 6,
      fogOpacity: 0.95,
      exploredOpacity: 0.4,
      showExploredAreas: true,
      serializedExploredAreas: '',
      fogVersion: 1,
      realtimeVisionDuringDrag: false,
      realtimeVisionThrottleMs: 32,
      effectSettings: {
        postProcessingEnabled: true,
        edgeBlur: 8,
        lightFalloff: 0.5,
        volumetricEnabled: false,
        effectQuality: 'balanced' as EffectQuality,
        dimZoneOpacity: 0.4,
      },
    });
  },
  
  // Real-time vision during drag actions (local-only, not synced)
  setRealtimeVisionDuringDrag: (enabled) => {
    set({ realtimeVisionDuringDrag: enabled });
  },
  setRealtimeVisionThrottleMs: (ms) => {
    const clampedMs = Math.max(16, Math.min(100, ms));
    set({ realtimeVisionThrottleMs: clampedMs });
  },
  
  // Post-processing effect actions (local-only, not synced)
  setPostProcessingEnabled: (enabled) => {
    set((state) => ({
      effectSettings: { ...state.effectSettings, postProcessingEnabled: enabled },
    }));
  },
  setEdgeBlur: (blur) => {
    const clampedBlur = Math.max(0, Math.min(20, blur));
    set((state) => ({
      effectSettings: { ...state.effectSettings, edgeBlur: clampedBlur },
    }));
  },
  setLightFalloff: (falloff) => {
    const clampedFalloff = Math.max(0, Math.min(1, falloff));
    set((state) => ({
      effectSettings: { ...state.effectSettings, lightFalloff: clampedFalloff },
    }));
  },
  setVolumetricEnabled: (enabled) => {
    set((state) => ({
      effectSettings: { ...state.effectSettings, volumetricEnabled: enabled },
    }));
  },
  setEffectQuality: (quality) => {
    set((state) => ({
      effectSettings: { ...state.effectSettings, effectQuality: quality },
    }));
  },
  setDimZoneOpacity: (opacity) => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    set((state) => ({
      effectSettings: { ...state.effectSettings, dimZoneOpacity: clampedOpacity },
    }));
  },
  setEffectSettings: (settings) => {
    set((state) => ({
      effectSettings: { ...state.effectSettings, ...settings },
    }));
  },
});

// Wrap with syncPatch middleware - exclude local-only settings
const withSyncPatch = syncPatch<FogState>({ 
  channel: 'fog',
  excludePaths: ['realtimeVisionDuringDrag', 'realtimeVisionThrottleMs', 'effectSettings'], // Local-only settings
  debug: false,
})(fogStoreCreator);

// Persist options
const persistOptions: PersistOptions<FogState, Partial<FogState>> = {
  name: 'fog-of-war-store',
  partialize: (state) => ({
    enabled: state.enabled,
    revealAll: state.revealAll,
    visionRange: state.visionRange,
    fogOpacity: state.fogOpacity,
    exploredOpacity: state.exploredOpacity,
    showExploredAreas: state.showExploredAreas,
    serializedExploredAreas: state.serializedExploredAreas,
    fogVersion: state.fogVersion,
    realtimeVisionDuringDrag: state.realtimeVisionDuringDrag,
    realtimeVisionThrottleMs: state.realtimeVisionThrottleMs,
    effectSettings: state.effectSettings,
  }),
};

export const useFogStore = create<FogState>()(
  persist(withSyncPatch as StateCreator<FogState, [], []>, persistOptions)
);
