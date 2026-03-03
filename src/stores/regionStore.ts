import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';

export interface CanvasRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  color: string;
  gridType: 'square' | 'hex' | 'free';
  gridSize: number;
  gridScale: number;
  gridSnapping: boolean;
  gridVisible: boolean;
  backgroundImage?: string;
  textureHash?: string;
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  backgroundScale?: number;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  backgroundColor?: string;
  
  regionType?: 'rectangle' | 'path';
  pathPoints?: { x: number; y: number }[];
  bezierControlPoints?: { cp1: { x: number; y: number }; cp2: { x: number; y: number } }[];
  smoothing?: boolean;
  
  rotation?: number;
  rotationCenter?: { x: number; y: number };
  locked?: boolean;

  mapId?: string;
}

interface RegionStore {
  regions: CanvasRegion[];
  
  addRegion: (region: Omit<CanvasRegion, 'id'> & { id?: string }) => void;
  updateRegion: (id: string, updates: Partial<CanvasRegion>) => void;
  removeRegion: (id: string) => void;
  clearRegions: () => void;
  setRegions: (regions: CanvasRegion[]) => void;
  
  selectRegion: (id: string) => void;
  deselectRegion: (id: string) => void;
  clearSelection: () => void;
  getSelectedRegions: () => CanvasRegion[];
}

const regionStoreCreator: StateCreator<RegionStore> = (set, get) => ({
  regions: [],

  addRegion: (regionData) => {
    const newRegion: CanvasRegion = {
      ...regionData,
      id: regionData.id || `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({ regions: [...state.regions, newRegion] }));
  },

  updateRegion: (id, updates) => {
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === id ? { ...region, ...updates } : region
      ),
    }));
  },

  removeRegion: (id) => {
    set((state) => ({
      regions: state.regions.filter((region) => region.id !== id),
    }));
  },

  clearRegions: () => set({ regions: [] }),

  setRegions: (regions) => set({ regions }),

  selectRegion: (id) => {
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === id ? { ...region, selected: true } : region
      ),
    }));
  },

  deselectRegion: (id) => {
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === id ? { ...region, selected: false } : region
      ),
    }));
  },

  clearSelection: () => {
    set((state) => ({
      regions: state.regions.map((region) => ({ ...region, selected: false })),
    }));
  },

  getSelectedRegions: () => {
    const { regions } = get();
    return regions.filter((region) => region.selected);
  },
});

const withSyncPatch = syncPatch<RegionStore>({ 
  channel: 'regions',
  excludePaths: ['regions.*.backgroundImage'],
  debug: false,
})(regionStoreCreator);

const persistOptions: PersistOptions<RegionStore, Partial<RegionStore>> = {
  name: 'canvas-regions-store',
  version: 2,
  partialize: (state) => ({
    ...state,
    regions: state.regions.map(region => ({
      ...region,
      backgroundImage: undefined,
    })),
  }),
};

export const useRegionStore = create<RegionStore>()(
  persist(withSyncPatch as StateCreator<RegionStore, [], []>, persistOptions)
);
