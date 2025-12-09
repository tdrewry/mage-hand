import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

interface ViewportStore {
  // Map ID -> Transform mapping
  transforms: Record<string, ViewportTransform>;
  
  setTransform: (mapId: string, transform: ViewportTransform) => void;
}

const DEFAULT_TRANSFORM: ViewportTransform = { x: 0, y: 0, zoom: 1 };

export const useViewportStore = create<ViewportStore>()(
  persist(
    (set, get) => ({
      transforms: {},
      
      setTransform: (mapId: string, transform: ViewportTransform) => {
        console.log('[ViewportStore] Saving transform for map:', mapId, transform);
        set((state) => ({
          transforms: {
            ...state.transforms,
            [mapId]: transform,
          },
        }));
      },
    }),
    {
      name: 'viewport-store',
      version: 1,
      // Migrate from old structure if needed
      migrate: (persistedState: any, version: number) => {
        console.log('[ViewportStore] Migrating from version:', version, persistedState);
        if (version === 0 || !persistedState) {
          return { transforms: {} };
        }
        // Handle old single transform structure
        if (persistedState.transform && !persistedState.transforms) {
          return { transforms: {} };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        console.log('[ViewportStore] Rehydrated:', state?.transforms);
      },
    }
  )
);

// Helper to get transform with default fallback
export const getViewportTransform = (mapId: string | null): ViewportTransform => {
  if (!mapId) return DEFAULT_TRANSFORM;
  const state = useViewportStore.getState();
  return state.transforms[mapId] || DEFAULT_TRANSFORM;
};
