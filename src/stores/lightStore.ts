import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';

export interface LightSource {
  id: string;
  position: { x: number; y: number };
  radius: number; // Maximum visibility distance in pixels
  intensity: number; // 0-1, affects shadow darkness
  color: string; // Hex color for the light
  enabled: boolean;
  label?: string;
}

interface LightState {
  lights: LightSource[];
  globalAmbientLight: number; // 0-1, baseline illumination
  shadowIntensity: number; // 0-1, how dark shadows are
  
  // Actions
  addLight: (light: Omit<LightSource, 'id'> & { id?: string }) => string;
  updateLight: (id: string, updates: Partial<LightSource>) => void;
  removeLight: (id: string) => void;
  toggleLight: (id: string) => void;
  setLights: (lights: LightSource[]) => void;
  setGlobalAmbientLight: (level: number) => void;
  setShadowIntensity: (intensity: number) => void;
  clearAllLights: () => void;
}

let nextLightId = 1;

// Define the store creator separately for better type inference
const lightStoreCreator: StateCreator<LightState> = (set, get) => ({
  lights: [],
  globalAmbientLight: 0.2, // 20% ambient light by default
  shadowIntensity: 0.7, // Shadows are 70% opaque by default
  
  addLight: (light) => {
    // Use provided ID if available (for synced lights), otherwise generate new
    const id = light.id || `light-${nextLightId++}`;
    const newLight: LightSource = {
      ...light,
      id,
    };
    
    set((state) => ({
      lights: [...state.lights, newLight],
    }));
    // Sync happens automatically via syncPatch middleware
    
    return id;
  },
  
  updateLight: (id, updates) => {
    set((state) => ({
      lights: state.lights.map((light) =>
        light.id === id ? { ...light, ...updates } : light
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  removeLight: (id) => {
    set((state) => ({
      lights: state.lights.filter((light) => light.id !== id),
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  toggleLight: (id) => {
    set((state) => ({
      lights: state.lights.map((light) =>
        light.id === id ? { ...light, enabled: !light.enabled } : light
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  setLights: (lights) => {
    set({ lights });
  },
  
  setGlobalAmbientLight: (level) => {
    set({ globalAmbientLight: Math.max(0, Math.min(1, level)) });
  },
  
  setShadowIntensity: (intensity) => {
    set({ shadowIntensity: Math.max(0, Math.min(1, intensity)) });
  },
  
  clearAllLights: () => {
    set({ lights: [] });
  },
});

// Wrap with syncPatch middleware
const withSyncPatch = syncPatch<LightState>({ 
  channel: 'lights',
  debug: false,
})(lightStoreCreator);

// Persist options
const persistOptions: PersistOptions<LightState, Partial<LightState>> = {
  name: 'light-store',
  partialize: (state) => ({
    lights: state.lights,
    globalAmbientLight: state.globalAmbientLight,
    shadowIntensity: state.shadowIntensity,
  }),
};

export const useLightStore = create<LightState>()(
  persist(withSyncPatch as StateCreator<LightState, [], []>, persistOptions)
);
