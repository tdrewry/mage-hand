import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FogSettings {
  enabled: boolean;
  revealAll: boolean; // DM mode - show entire map
  visionRange: number; // Default token vision range in pixels
  fogOpacity: number; // 0-1, how dark the fog is for unexplored areas
  exploredOpacity: number; // 0-1, how dark explored but not visible areas are
  showExploredAreas: boolean; // Whether to show previously explored areas as dimmed
  exploredAreas: Array<{ x: number; y: number }>; // Serialized explored area polygon
}

interface FogState extends FogSettings {
  // Actions
  setEnabled: (enabled: boolean) => void;
  setRevealAll: (revealAll: boolean) => void;
  setVisionRange: (range: number) => void;
  setFogOpacity: (opacity: number) => void;
  setExploredOpacity: (opacity: number) => void;
  setShowExploredAreas: (show: boolean) => void;
  addExploredArea: (points: Array<{ x: number; y: number }>) => void;
  clearExploredAreas: () => void;
  resetFog: () => void;
}

export const useFogStore = create<FogState>()(
  persist(
    (set) => ({
      // Initial state
      enabled: false,
      revealAll: false,
      visionRange: 300,
      fogOpacity: 0.95,
      exploredOpacity: 0.4,
      showExploredAreas: true,
      exploredAreas: [],
      
      // Actions
      setEnabled: (enabled) => set({ enabled }),
      
      setRevealAll: (revealAll) => set({ revealAll }),
      
      setVisionRange: (range) => set({ visionRange: Math.max(50, Math.min(1000, range)) }),
      
      setFogOpacity: (opacity) => set({ fogOpacity: Math.max(0, Math.min(1, opacity)) }),
      
      setExploredOpacity: (opacity) => set({ exploredOpacity: Math.max(0, Math.min(1, opacity)) }),
      
      setShowExploredAreas: (show) => set({ showExploredAreas: show }),
      
      addExploredArea: (points) => set((state) => {
        // Merge new points with existing explored areas
        // For now, just concatenate - proper union would be done with paper.js
        const merged = [...state.exploredAreas, ...points];
        return { exploredAreas: merged };
      }),
      
      clearExploredAreas: () => set({ exploredAreas: [] }),
      
      resetFog: () => {
        set({
          enabled: false,
          revealAll: false,
          visionRange: 300,
          fogOpacity: 0.95,
          exploredOpacity: 0.4,
          showExploredAreas: true,
          exploredAreas: [],
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
        exploredAreas: state.exploredAreas,
      }),
    }
  )
);
