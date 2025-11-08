import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FogSettings {
  enabled: boolean;
  revealAll: boolean; // DM mode - show entire map
  visionRange: number; // Default token vision range in pixels
  fogOpacity: number; // 0-1, how dark the fog is
  showExploredAreas: boolean; // Whether to show previously explored areas as dimmed
}

interface FogState extends FogSettings {
  // Actions
  setEnabled: (enabled: boolean) => void;
  setRevealAll: (revealAll: boolean) => void;
  setVisionRange: (range: number) => void;
  setFogOpacity: (opacity: number) => void;
  setShowExploredAreas: (show: boolean) => void;
  resetFog: () => void;
}

export const useFogStore = create<FogState>()(
  persist(
    (set) => ({
      // Initial state
      enabled: false,
      revealAll: false,
      visionRange: 300,
      fogOpacity: 0.9,
      showExploredAreas: true,
      
      // Actions
      setEnabled: (enabled) => set({ enabled }),
      
      setRevealAll: (revealAll) => set({ revealAll }),
      
      setVisionRange: (range) => set({ visionRange: Math.max(50, Math.min(1000, range)) }),
      
      setFogOpacity: (opacity) => set({ fogOpacity: Math.max(0, Math.min(1, opacity)) }),
      
      setShowExploredAreas: (show) => set({ showExploredAreas: show }),
      
      resetFog: () => {
        set({
          enabled: false,
          revealAll: false,
          visionRange: 300,
          fogOpacity: 0.9,
          showExploredAreas: true,
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
        showExploredAreas: state.showExploredAreas,
      }),
    }
  )
);
