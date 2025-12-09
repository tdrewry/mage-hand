import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

interface ViewportStore {
  transform: ViewportTransform;
  setTransform: (transform: ViewportTransform) => void;
}

export const useViewportStore = create<ViewportStore>()(
  persist(
    (set) => ({
      transform: { x: 0, y: 0, zoom: 1 },
      setTransform: (transform) => set({ transform }),
    }),
    {
      name: 'viewport-store',
      version: 1,
    }
  )
);
