import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';

export interface LightSource {
  id: string;
  position: { x: number; y: number };
  radius: number;
  intensity: number;
  color: string;
  enabled: boolean;
  label?: string;
  mapId?: string;
}

interface LightState {
  lights: LightSource[];
  globalAmbientLight: number;
  shadowIntensity: number;
  selectedLightIds: string[];
  
  addLight: (light: Omit<LightSource, 'id'> & { id?: string }) => string;
  updateLight: (id: string, updates: Partial<LightSource>) => void;
  removeLight: (id: string) => void;
  toggleLight: (id: string) => void;
  setLights: (lights: LightSource[]) => void;
  setGlobalAmbientLight: (level: number) => void;
  setShadowIntensity: (intensity: number) => void;
  clearAllLights: () => void;
  selectLight: (id: string, additive?: boolean) => void;
  deselectLight: (id: string) => void;
  clearLightSelection: () => void;
  selectMultipleLights: (ids: string[]) => void;
}

let nextLightId = 1;

const lightStoreCreator: StateCreator<LightState> = (set, get) => ({
  lights: [],
  globalAmbientLight: 0.2,
  shadowIntensity: 0.7,
  selectedLightIds: [],
  
  addLight: (light) => {
    const id = light.id || `light-${nextLightId++}`;
    const newLight: LightSource = { ...light, id };
    set((state) => ({ lights: [...state.lights, newLight] }));
    return id;
  },
  
  updateLight: (id, updates) => {
    set((state) => ({
      lights: state.lights.map((light) =>
        light.id === id ? { ...light, ...updates } : light
      ),
    }));
  },
  
  removeLight: (id) => {
    set((state) => ({
      lights: state.lights.filter((light) => light.id !== id),
    }));
  },
  
  toggleLight: (id) => {
    set((state) => ({
      lights: state.lights.map((light) =>
        light.id === id ? { ...light, enabled: !light.enabled } : light
      ),
    }));
  },
  
  setLights: (lights) => set({ lights }),
  
  setGlobalAmbientLight: (level) => {
    set({ globalAmbientLight: Math.max(0, Math.min(1, level)) });
  },
  
  setShadowIntensity: (intensity) => {
    set({ shadowIntensity: Math.max(0, Math.min(1, intensity)) });
  },
  
  clearAllLights: () => set({ lights: [], selectedLightIds: [] }),
  
  selectLight: (id, additive = false) => {
    set((state) => {
      if (additive) {
        if (state.selectedLightIds.includes(id)) return state;
        return { selectedLightIds: [...state.selectedLightIds, id] };
      }
      return { selectedLightIds: [id] };
    });
  },
  
  deselectLight: (id) => {
    set((state) => ({
      selectedLightIds: state.selectedLightIds.filter((lid) => lid !== id),
    }));
  },
  
  clearLightSelection: () => set({ selectedLightIds: [] }),
  
  selectMultipleLights: (ids) => set({ selectedLightIds: ids }),
});

const withSyncPatch = syncPatch<LightState>({ 
  channel: 'lights',
  debug: false,
})(lightStoreCreator);

const persistOptions: PersistOptions<LightState, Partial<LightState>> = {
  name: 'light-store',
  partialize: (state) => ({
    lights: state.lights,
    globalAmbientLight: state.globalAmbientLight,
    shadowIntensity: state.shadowIntensity,
    selectedLightIds: [],
  }),
};

export const useLightStore = create<LightState>()(
  persist(withSyncPatch as StateCreator<LightState, [], []>, persistOptions)
);
