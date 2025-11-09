import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FogSettings {
  enabled: boolean;
  revealAll: boolean; // DM mode - show entire map
  visionRange: number; // Default token vision range in grid units
  fogOpacity: number; // 0-1, how dark the fog is for unexplored areas
  exploredOpacity: number; // 0-1, how dark explored but not visible areas are
  showExploredAreas: boolean; // Whether to show previously explored areas as dimmed
  serializedExploredAreas: string; // Paper.js JSON serialized explored geometry
  fogVersion: number; // Schema version for migration
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
      
      // Actions
      setEnabled: (enabled) => set({ enabled }),
      
      setRevealAll: (revealAll) => set({ revealAll }),
      
      setVisionRange: (range) => set({ visionRange: Math.max(1, Math.min(50, range)) }),
      
      setFogOpacity: (opacity) => set({ fogOpacity: Math.max(0, Math.min(1, opacity)) }),
      
      setExploredOpacity: (opacity) => set({ exploredOpacity: Math.max(0, Math.min(1, opacity)) }),
      
      setShowExploredAreas: (show) => set({ showExploredAreas: show }),
      
      setSerializedExploredAreas: (data) => set({ serializedExploredAreas: data }),
      
      clearExploredAreas: () => set({ serializedExploredAreas: '' }),
      
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
        });
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
      }),
    }
  )
);
