import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';

export type EffectQuality = 'performance' | 'balanced' | 'cinematic';

export interface FogEffectSettings {
  postProcessingEnabled: boolean; // Enable PixiJS post-processing
  edgeBlur: number; // 0-20 pixels
  lightFalloff: number; // 0-1, percentage of light radius where inner bright zone ends
  volumetricEnabled: boolean;
  effectQuality: EffectQuality;
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
  
  // Post-processing effect settings
  effectSettings: FogEffectSettings;
}

interface FogState extends FogSettings {
  // Actions
  setEnabled: (enabled: boolean) => void;
  setRevealAll: (revealAll: boolean) => void;
  setVisionRange: (range: number) => void;
  setFogOpacity: (opacity: number) => void;
  setExploredOpacity: (opacity: number) => void;
  setShowExploredAreas: (show: boolean) => void;
  setSerializedExploredAreas: (data: string) => void;
  clearExploredAreas: () => void;
  resetFog: () => void;
  
  // Post-processing effect actions
  setPostProcessingEnabled: (enabled: boolean) => void;
  setEdgeBlur: (blur: number) => void;
  setLightFalloff: (falloff: number) => void;
  setVolumetricEnabled: (enabled: boolean) => void;
  setEffectQuality: (quality: EffectQuality) => void;
  setEffectSettings: (settings: Partial<FogEffectSettings>) => void;
}

export const useFogStore = create<FogState>()(
  persist(
    (set) => ({
      // Initial state
      enabled: false,
      revealAll: false,
      visionRange: 6, // 6 grid units default
      fogOpacity: 0.95,
      exploredOpacity: 0.4,
      showExploredAreas: true,
      serializedExploredAreas: '',
      fogVersion: 1,
      
      // Post-processing effect settings
      effectSettings: {
        postProcessingEnabled: false,
        edgeBlur: 8,
        lightFalloff: 0.5, // 50% of light radius is fully bright, rest is dimmer
        volumetricEnabled: false,
        effectQuality: 'balanced' as EffectQuality,
      },
      
      // Actions
      setEnabled: (enabled) => {
        set({ enabled });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ enabled });
        }
      },
      
      setRevealAll: (revealAll) => {
        set({ revealAll });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ revealAll });
        }
      },
      
      setVisionRange: (range) => {
        const clampedRange = Math.max(1, Math.min(50, range));
        set({ visionRange: clampedRange });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ visionRange: clampedRange });
        }
      },
      
      setFogOpacity: (opacity) => {
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        set({ fogOpacity: clampedOpacity });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ fogOpacity: clampedOpacity });
        }
      },
      
      setExploredOpacity: (opacity) => {
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        set({ exploredOpacity: clampedOpacity });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ exploredOpacity: clampedOpacity });
        }
      },
      
      setShowExploredAreas: (show) => {
        set({ showExploredAreas: show });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ showExploredAreas: show });
        }
      },
      
      setSerializedExploredAreas: (data) => {
        set({ serializedExploredAreas: data });
        
        // Sync to multiplayer (fog reveals)
        if (syncManager.isConnected()) {
          syncManager.syncFogReveal(data);
        }
      },
      
      clearExploredAreas: () => {
        set({ serializedExploredAreas: '' });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogClear();
        }
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
          effectSettings: {
            postProcessingEnabled: false,
            edgeBlur: 8,
            lightFalloff: 0.5,
            volumetricEnabled: false,
            effectQuality: 'balanced' as EffectQuality,
          },
        });
      },
      
      // Post-processing effect actions
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
      setEffectSettings: (settings) => {
        set((state) => ({
          effectSettings: { ...state.effectSettings, ...settings },
        }));
      },
    }),
    {
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
        effectSettings: state.effectSettings,
      }),
    }
  )
);
