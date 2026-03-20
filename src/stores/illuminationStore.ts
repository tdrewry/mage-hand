/**
 * Unified Illumination Store
 * Manages all light sources (standalone lights) using the unified IlluminationSource model
 * Token-attached illumination is stored in sessionStore on each token
 * 
 * Sync is handled automatically via JSON Patch middleware
 */

import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
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

// Define the store creator separately for better type inference
const illuminationStoreCreator: StateCreator<IlluminationState> = (set, get) => ({
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
      label: lightData.label,
      enabled: lightData.enabled ?? defaults.enabled,
      position: lightData.position,
      range: lightData.range ?? defaults.range,
      brightZone: lightData.brightZone ?? get().defaultBrightZone,
      brightIntensity: lightData.brightIntensity ?? defaults.brightIntensity,
      dimIntensity: lightData.dimIntensity ?? defaults.dimIntensity,
      color: lightData.color ?? defaults.color,
      colorEnabled: lightData.colorEnabled ?? defaults.colorEnabled,
      colorIntensity: lightData.colorIntensity ?? defaults.colorIntensity,
      softEdge: lightData.softEdge ?? defaults.softEdge,
      softEdgeRadius: lightData.softEdgeRadius ?? get().defaultSoftEdgeRadius,
      animation: lightData.animation ?? defaults.animation,
      animationSpeed: lightData.animationSpeed ?? defaults.animationSpeed,
      animationIntensity: lightData.animationIntensity ?? defaults.animationIntensity,
    };
    
    set((state) => ({
      lights: [...state.lights, newLight],
    }));
    
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
      lights: state.lights.map((l) =>
        l.id === id ? { ...l, enabled: !l.enabled } : l
      ),
    }));
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
    
    return newLight.id;
  },
});

// Wrap with syncPatch middleware
const withSyncPatch = syncPatch<IlluminationState>({
  channel: 'illumination',
  excludePaths: ['defaultBrightZone', 'defaultSoftEdgeRadius'], // Local-only preferences
})(illuminationStoreCreator);

// Persist options
const persistOptions: PersistOptions<IlluminationState, Partial<IlluminationState>> = {
  name: 'illumination-store',
  partialize: (state) => ({
    lights: state.lights,
    globalAmbientLight: state.globalAmbientLight,
    defaultBrightZone: state.defaultBrightZone,
    defaultSoftEdgeRadius: state.defaultSoftEdgeRadius,
  }),
};

export const useIlluminationStore = create<IlluminationState>()(
  persist(withSyncPatch as StateCreator<IlluminationState, [], []>, persistOptions)
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
    colorIntensity: 0.5,
    softEdge: true,
    softEdgeRadius: 8,
    animation: 'none',
    animationSpeed: 1.0,
    animationIntensity: 0.3,
  };
}
