import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';

export interface FogSettings {
  enabled: boolean;
  revealAll: boolean; // DM mode - show entire map
  visionRange: number; // Default token vision range in grid units
  fogOpacity: number; // 0-1, how dark the fog is for unexplored areas
  exploredOpacity: number; // 0-1, how dark explored but not visible areas are
  showExploredAreas: boolean; // Whether to show previously explored areas as dimmed
  serializedExploredAreas: string; // Paper.js JSON serialized explored geometry
  fogVersion: number; // Schema version for migration
  
  // Gradient soft edges settings
  useGradients: boolean; // Enable soft gradient edges on vision
  innerFadeStart: number; // 0-1, where fade begins (default: 0.7)
  midpointPosition: number; // 0-1, position of mid-fade (default: 0.85)
  midpointOpacity: number; // 0-1, opacity at midpoint (default: 0.2)
  outerFadeStart: number; // 0-1, where outer fade starts (default: 0.9)
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
  
  // Gradient actions
  setUseGradients: (enabled: boolean) => void;
  setInnerFadeStart: (value: number) => void;
  setMidpointPosition: (value: number) => void;
  setMidpointOpacity: (value: number) => void;
  setOuterFadeStart: (value: number) => void;
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
      
      // Gradient settings
      useGradients: true,
      innerFadeStart: 0.7,
      midpointPosition: 0.85,
      midpointOpacity: 0.2,
      outerFadeStart: 0.9,
      
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
          visionRange: 6, // 6 grid units default
          fogOpacity: 0.95,
          exploredOpacity: 0.4,
          showExploredAreas: true,
          serializedExploredAreas: '',
          fogVersion: 1,
          useGradients: true,
          innerFadeStart: 0.7,
          midpointPosition: 0.85,
          midpointOpacity: 0.2,
          outerFadeStart: 0.9,
        });
      },
      
      // Gradient actions
      setUseGradients: (enabled) => {
        set({ useGradients: enabled });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ useGradients: enabled });
        }
      },
      setInnerFadeStart: (value) => {
        const clampedValue = Math.max(0, Math.min(1, value));
        set({ innerFadeStart: clampedValue });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ innerFadeStart: clampedValue });
        }
      },
      setMidpointPosition: (value) => {
        const clampedValue = Math.max(0, Math.min(1, value));
        set({ midpointPosition: clampedValue });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ midpointPosition: clampedValue });
        }
      },
      setMidpointOpacity: (value) => {
        const clampedValue = Math.max(0, Math.min(1, value));
        set({ midpointOpacity: clampedValue });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ midpointOpacity: clampedValue });
        }
      },
      setOuterFadeStart: (value) => {
        const clampedValue = Math.max(0, Math.min(1, value));
        set({ outerFadeStart: clampedValue });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncFogSettings({ outerFadeStart: clampedValue });
        }
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
        useGradients: state.useGradients,
        innerFadeStart: state.innerFadeStart,
        midpointPosition: state.midpointPosition,
        midpointOpacity: state.midpointOpacity,
        outerFadeStart: state.outerFadeStart,
      }),
    }
  )
);
