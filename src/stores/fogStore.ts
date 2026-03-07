import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import { DEFAULT_MAP_FOG_SETTINGS } from './defaultFogEffectSettings';
import { useMapStore } from './mapStore';

export type EffectQuality = 'performance' | 'balanced' | 'cinematic';

export interface FogEffectSettings {
  postProcessingEnabled: boolean; // Enable PixiJS post-processing
  edgeBlur: number; // 0-20 pixels
  lightFalloff: number; // 0-1, percentage of light radius where inner bright zone ends
  volumetricEnabled: boolean;
  effectQuality: EffectQuality;
  dimZoneOpacity: number; // 0-1, how much fog remains in dim zone (default 0.4)
}

export interface MapFogSettings {
  enabled: boolean;
  revealAll: boolean; // DM mode - show entire map
  visionRange: number; // Default token vision range in grid units
  fogOpacity: number; // 0-1, how dark the fog is for unexplored areas
  exploredOpacity: number; // 0-1, how dark explored but not visible areas are
  showExploredAreas: boolean; // Whether to show previously explored areas as dimmed
  dmFogOpacity: number; // 0-1, how dark unexplored areas appear to the DM (default 0.3)
  effectSettings: FogEffectSettings;
}

/** @deprecated Use MapFogSettings via fogSettingsPerMap instead */
export interface FogSettings {
  enabled?: boolean;
  revealAll?: boolean;
  visionRange?: number;
  fogOpacity?: number;
  exploredOpacity?: number;
  showExploredAreas?: boolean;
  serializedExploredAreas?: string;
  serializedExploredAreasPerMap?: Record<string, string>;
  fogVersion?: number;
  realtimeVisionDuringDrag?: boolean;
  realtimeVisionThrottleMs?: number;
  effectSettings?: FogEffectSettings;
  fogSettingsPerMap?: Record<string, MapFogSettings>;
}

interface FogState {
  // Per-map fog settings
  fogSettingsPerMap: Record<string, MapFogSettings>;

  // Global fields (not per-map)
  serializedExploredAreas: string; // @deprecated Legacy single-map explored geometry
  serializedExploredAreasPerMap: Record<string, string>; // Per-map explored geometry keyed by mapId
  fogVersion: number;
  realtimeVisionDuringDrag: boolean;
  realtimeVisionThrottleMs: number;

  // Per-map actions
  getMapFogSettings: (mapId: string) => MapFogSettings;
  setMapFogSettings: (mapId: string, updates: Partial<MapFogSettings>) => void;
  initMapFogSettings: (mapId: string) => void;
  removeMapFogSettings: (mapId: string) => void;
  setStructureFogSettings: (structureId: string, updates: Partial<MapFogSettings>) => void;

  // Explored area actions
  setSerializedExploredAreas: (data: string) => void;
  setSerializedExploredAreasForMap: (mapId: string, data: string) => void;
  getSerializedExploredAreasForMap: (mapId: string) => string;
  clearExploredAreas: () => void;

  // Global actions
  resetFog: () => void;
  setRealtimeVisionDuringDrag: (enabled: boolean) => void;
  setRealtimeVisionThrottleMs: (ms: number) => void;
}

// Define the store creator separately for better type inference
const fogStoreCreator: StateCreator<FogState> = (set) => ({
  // Per-map fog settings - default map starts with defaults
  fogSettingsPerMap: {
    'default-map': { ...DEFAULT_MAP_FOG_SETTINGS },
  },

  // Global fields
  serializedExploredAreas: '',
  serializedExploredAreasPerMap: {},
  fogVersion: 1,
  realtimeVisionDuringDrag: false,
  realtimeVisionThrottleMs: 32,

  // Per-map actions
  getMapFogSettings: (mapId) => {
    const state = useFogStore.getState();
    return state.fogSettingsPerMap[mapId] || { ...DEFAULT_MAP_FOG_SETTINGS };
  },

  setMapFogSettings: (mapId, updates) => {
    set((state) => {
      const current = state.fogSettingsPerMap[mapId] || { ...DEFAULT_MAP_FOG_SETTINGS };
      // Handle nested effectSettings merge
      const newSettings = updates.effectSettings
        ? { ...current, ...updates, effectSettings: { ...current.effectSettings, ...updates.effectSettings } }
        : { ...current, ...updates };
      return {
        fogSettingsPerMap: {
          ...state.fogSettingsPerMap,
          [mapId]: newSettings,
        },
      };
    });
  },

  initMapFogSettings: (mapId) => {
    set((state) => {
      if (state.fogSettingsPerMap[mapId]) return state; // Already exists
      return {
        fogSettingsPerMap: {
          ...state.fogSettingsPerMap,
          [mapId]: { ...DEFAULT_MAP_FOG_SETTINGS },
        },
      };
    });
  },

  removeMapFogSettings: (mapId) => {
    set((state) => {
      const { [mapId]: _, ...rest } = state.fogSettingsPerMap;
      const { [mapId]: __, ...exploredRest } = state.serializedExploredAreasPerMap;
      return {
        fogSettingsPerMap: rest,
        serializedExploredAreasPerMap: exploredRest,
      };
    });
  },

  setStructureFogSettings: (structureId, updates) => {
    // Read mapStore to find maps in this structure
    try {
      const maps = useMapStore.getState().maps;
      const memberMapIds = maps
        .filter((m: any) => m.structureId === structureId)
        .map((m: any) => m.id);

      set((state) => {
        const newPerMap = { ...state.fogSettingsPerMap };
        for (const mapId of memberMapIds) {
          const current = newPerMap[mapId] || { ...DEFAULT_MAP_FOG_SETTINGS };
          newPerMap[mapId] = updates.effectSettings
            ? { ...current, ...updates, effectSettings: { ...current.effectSettings, ...updates.effectSettings } }
            : { ...current, ...updates };
        }
        return { fogSettingsPerMap: newPerMap };
      });
    } catch {
      console.warn('setStructureFogSettings: could not access mapStore');
    }
  },

  // Explored area actions
  setSerializedExploredAreas: (data) => {
    set({ serializedExploredAreas: data });
  },

  setSerializedExploredAreasForMap: (mapId, data) => {
    set((state) => ({
      serializedExploredAreasPerMap: {
        ...(state.serializedExploredAreasPerMap || {}),
        [mapId]: data,
      },
    }));
  },

  getSerializedExploredAreasForMap: (mapId) => {
    const state = useFogStore.getState();
    return state.serializedExploredAreasPerMap?.[mapId] || '';
  },

  clearExploredAreas: () => {
    set({ serializedExploredAreas: '', serializedExploredAreasPerMap: {} });
  },

  resetFog: () => {
    set({
      fogSettingsPerMap: {
        'default-map': { ...DEFAULT_MAP_FOG_SETTINGS },
      },
      serializedExploredAreas: '',
      serializedExploredAreasPerMap: {},
      fogVersion: 1,
      realtimeVisionDuringDrag: false,
      realtimeVisionThrottleMs: 32,
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
});

// Wrap with syncPatch middleware - exclude local-only settings
const withSyncPatch = syncPatch<FogState>({
  channel: 'fog',
  excludePaths: ['realtimeVisionDuringDrag', 'realtimeVisionThrottleMs'],
  debug: false,
})(fogStoreCreator);

// Persist options
const persistOptions: PersistOptions<FogState, Partial<FogState>> = {
  name: 'fog-of-war-store',
  partialize: (state) => ({
    fogSettingsPerMap: state.fogSettingsPerMap,
    serializedExploredAreas: state.serializedExploredAreas,
    serializedExploredAreasPerMap: state.serializedExploredAreasPerMap,
    fogVersion: state.fogVersion,
    realtimeVisionDuringDrag: state.realtimeVisionDuringDrag,
    realtimeVisionThrottleMs: state.realtimeVisionThrottleMs,
  }),
  // Migrate legacy flat fields to per-map
  onRehydrateStorage: () => (state) => {
    if (!state) return;

    // Migrate legacy single explored area to per-map
    const legacy = state.serializedExploredAreas;
    const perMap = state.serializedExploredAreasPerMap;
    if (legacy && (!perMap || Object.keys(perMap).length === 0)) {
      state.serializedExploredAreasPerMap = { 'default-map': legacy };
      state.serializedExploredAreas = '';
    }

    // Migrate legacy flat fog fields → fogSettingsPerMap['default-map']
    const raw = state as any;
    if (
      (!state.fogSettingsPerMap || Object.keys(state.fogSettingsPerMap).length === 0) &&
      (raw.enabled !== undefined || raw.fogOpacity !== undefined)
    ) {
      state.fogSettingsPerMap = {
        'default-map': {
          enabled: raw.enabled ?? false,
          revealAll: raw.revealAll ?? false,
          visionRange: raw.visionRange ?? 6,
          fogOpacity: raw.fogOpacity ?? 0.95,
          exploredOpacity: raw.exploredOpacity ?? 0.4,
          showExploredAreas: raw.showExploredAreas ?? true,
          effectSettings: raw.effectSettings ?? { ...DEFAULT_MAP_FOG_SETTINGS.effectSettings },
        },
      };
    }
  },
};

export const useFogStore = create<FogState>()(
  persist(withSyncPatch as StateCreator<FogState, [], []>, persistOptions)
);
