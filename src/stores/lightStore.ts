import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';

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
  addLight: (light: Omit<LightSource, 'id'>) => string;
  updateLight: (id: string, updates: Partial<LightSource>) => void;
  removeLight: (id: string) => void;
  toggleLight: (id: string) => void;
  setGlobalAmbientLight: (level: number) => void;
  setShadowIntensity: (intensity: number) => void;
  clearAllLights: () => void;
}

let nextLightId = 1;

export const useLightStore = create<LightState>()(
  persist(
    (set, get) => ({
      lights: [],
      globalAmbientLight: 0.2, // 20% ambient light by default
      shadowIntensity: 0.7, // Shadows are 70% opaque by default
      
      addLight: (light) => {
        const id = `light-${nextLightId++}`;
        const newLight: LightSource = {
          ...light,
          id,
        };
        
        set((state) => ({
          lights: [...state.lights, newLight],
        }));
        
        // Sync to multiplayer
        syncManager.syncLightAdd(newLight);
        
        return id;
      },
      
      updateLight: (id, updates) => {
        set((state) => ({
          lights: state.lights.map((light) =>
            light.id === id ? { ...light, ...updates } : light
          ),
        }));
        
        // Sync to multiplayer
        syncManager.syncLightUpdate(id, updates);
      },
      
      removeLight: (id) => {
        set((state) => ({
          lights: state.lights.filter((light) => light.id !== id),
        }));
        
        // Sync to multiplayer
        syncManager.syncLightRemove(id);
      },
      
      toggleLight: (id) => {
        set((state) => ({
          lights: state.lights.map((light) =>
            light.id === id ? { ...light, enabled: !light.enabled } : light
          ),
        }));
        
        // Sync to multiplayer
        syncManager.syncLightToggle(id);
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
    }),
    {
      name: 'light-store',
      partialize: (state) => ({
        lights: state.lights,
        globalAmbientLight: state.globalAmbientLight,
        shadowIntensity: state.shadowIntensity,
      }),
    }
  )
);
