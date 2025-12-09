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
  // Currently active map ID
  activeMapId: string | null;
  
  getTransform: (mapId: string) => ViewportTransform;
  setTransform: (mapId: string, transform: ViewportTransform) => void;
  setActiveMapId: (mapId: string | null) => void;
}

const DEFAULT_TRANSFORM: ViewportTransform = { x: 0, y: 0, zoom: 1 };

export const useViewportStore = create<ViewportStore>()(
  persist(
    (set, get) => ({
      transforms: {},
      activeMapId: null,
      
      getTransform: (mapId: string) => {
        return get().transforms[mapId] || DEFAULT_TRANSFORM;
      },
      
      setTransform: (mapId: string, transform: ViewportTransform) => {
        set((state) => ({
          transforms: {
            ...state.transforms,
            [mapId]: transform,
          },
        }));
      },
      
      setActiveMapId: (mapId: string | null) => {
        set({ activeMapId: mapId });
      },
    }),
    {
      name: 'viewport-store',
      version: 2, // Bump version for new structure
    }
  )
);
