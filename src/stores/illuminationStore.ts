/**
 * Unified Illumination Store
 * Manages all light sources (standalone lights) using the unified IlluminationSource model
 * Token-attached illumination is stored in sessionStore on each token
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';
import { 
  type IlluminationSource, 
  type IlluminationTemplate,
  DEFAULT_ILLUMINATION,
  createIlluminationFromTemplate 
} from '@/types/illumination';

interface IlluminationState {
  // Standalone light sources (not attached to tokens)
  lights: IlluminationSource[];
  
  // Global settings
  globalAmbientLight: number;   // 0-1, baseline illumination
  defaultBrightZone: number;    // 0-1, default bright zone for new sources
  defaultSoftEdgeRadius: number; // pixels
  
  // Actions
  addLight: (light: Partial<IlluminationSource> & { position: { x: number; y: number } }) => string;
  updateLight: (id: string, updates: Partial<IlluminationSource>) => void;
  removeLight: (id: string) => void;
  toggleLight: (id: string) => void;
  setLights: (lights: IlluminationSource[]) => void;
  setGlobalAmbientLight: (level: number) => void;
  setDefaultBrightZone: (zone: number) => void;
  setDefaultSoftEdgeRadius: (radius: number) => void;
  clearAllLights: () => void;
  
  // Template-based creation
  addLightFromTemplate: (template: IlluminationTemplate, position: { x: number; y: number }) => string;
}

let nextLightId = 1;

export const useIlluminationStore = create<IlluminationState>()(
  persist(
    (set, get) => ({
      lights: [],
      globalAmbientLight: 0.0,
      defaultBrightZone: 0.5,
      defaultSoftEdgeRadius: 8,
      
      addLight: (lightData) => {
        const id = `light-${nextLightId++}-${Date.now()}`;
        const defaults = DEFAULT_ILLUMINATION;
        
        const newLight: IlluminationSource = {
          id,
          name: lightData.name ?? defaults.name,
          enabled: lightData.enabled ?? defaults.enabled,
          position: lightData.position,
          range: lightData.range ?? defaults.range,
          brightZone: lightData.brightZone ?? get().defaultBrightZone,
          brightIntensity: lightData.brightIntensity ?? defaults.brightIntensity,
          dimIntensity: lightData.dimIntensity ?? defaults.dimIntensity,
          color: lightData.color ?? defaults.color,
          colorEnabled: lightData.colorEnabled ?? defaults.colorEnabled,
          softEdge: lightData.softEdge ?? defaults.softEdge,
          softEdgeRadius: lightData.softEdgeRadius ?? get().defaultSoftEdgeRadius,
        };
        
        set((state) => ({
          lights: [...state.lights, newLight],
        }));
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncLightAdd(newLight as any);
        }
        
        return id;
      },
      
      updateLight: (id, updates) => {
        set((state) => ({
          lights: state.lights.map((light) =>
            light.id === id ? { ...light, ...updates } : light
          ),
        }));
        
        if (syncManager.isConnected()) {
          syncManager.syncLightUpdate(id, updates as any);
        }
      },
      
      removeLight: (id) => {
        const lightExists = get().lights.some(light => light.id === id);
        
        set((state) => ({
          lights: state.lights.filter((light) => light.id !== id),
        }));
        
        if (lightExists && syncManager.isConnected()) {
          syncManager.syncLightRemove(id);
        }
      },
      
      toggleLight: (id) => {
        const light = get().lights.find(l => l.id === id);
        if (!light) return;
        
        set((state) => ({
          lights: state.lights.map((l) =>
            l.id === id ? { ...l, enabled: !l.enabled } : l
          ),
        }));
        
        if (syncManager.isConnected()) {
          syncManager.syncLightToggle(id);
        }
      },
      
      setLights: (lights) => {
        set({ lights });
      },
      
      setGlobalAmbientLight: (level) => {
        set({ globalAmbientLight: Math.max(0, Math.min(1, level)) });
      },
      
      setDefaultBrightZone: (zone) => {
        set({ defaultBrightZone: Math.max(0, Math.min(1, zone)) });
      },
      
      setDefaultSoftEdgeRadius: (radius) => {
        set({ defaultSoftEdgeRadius: Math.max(0, Math.min(20, radius)) });
      },
      
      clearAllLights: () => {
        set({ lights: [] });
      },
      
      addLightFromTemplate: (template, position) => {
        const newLight = createIlluminationFromTemplate(template, position);
        
        set((state) => ({
          lights: [...state.lights, newLight],
        }));
        
        if (syncManager.isConnected()) {
          syncManager.syncLightAdd(newLight as any);
        }
        
        return newLight.id;
      },
    }),
    {
      name: 'illumination-store',
      partialize: (state) => ({
        lights: state.lights,
        globalAmbientLight: state.globalAmbientLight,
        defaultBrightZone: state.defaultBrightZone,
        defaultSoftEdgeRadius: state.defaultSoftEdgeRadius,
      }),
    }
  )
);

/**
 * Migration helper: Convert old LightSource to new IlluminationSource
 */
export function migrateLegacyLight(oldLight: {
  id: string;
  position: { x: number; y: number };
  radius: number;
  intensity: number;
  color: string;
  enabled: boolean;
  label?: string;
}, gridSize: number = 50): IlluminationSource {
  return {
    id: oldLight.id,
    name: oldLight.label || 'Light',
    enabled: oldLight.enabled,
    position: oldLight.position,
    range: oldLight.radius / gridSize, // Convert pixels to grid units
    brightZone: 0.5,
    brightIntensity: oldLight.intensity,
    dimIntensity: oldLight.intensity * 0.4,
    color: oldLight.color,
    colorEnabled: false,
    softEdge: true,
    softEdgeRadius: 8,
  };
}
