import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  gridScale: number; // Decimal multiplier for grid size (1 = default)
  gridSnapping: boolean; // Per-region snapping toggle
  gridVisible: boolean; // Per-region grid visibility toggle
  backgroundImage?: string; // URL or data URI for background texture
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  backgroundOffsetX?: number; // Offset for background alignment
  backgroundOffsetY?: number; // Offset for background alignment
  
  // Path-based region support
  regionType?: 'rectangle' | 'path'; // Type of region
  pathPoints?: { x: number; y: number }[]; // Path vertices for free-form regions
}

interface RegionStore {
  regions: CanvasRegion[];
  
  // Region operations
  addRegion: (region: Omit<CanvasRegion, 'id'>) => void;
  updateRegion: (id: string, updates: Partial<CanvasRegion>) => void;
  removeRegion: (id: string) => void;
  clearRegions: () => void;
  setRegions: (regions: CanvasRegion[]) => void;
  
  // Selection operations
  selectRegion: (id: string) => void;
  deselectRegion: (id: string) => void;
  clearSelection: () => void;
  getSelectedRegions: () => CanvasRegion[];
}

export const useRegionStore = create<RegionStore>()(
  persist(
    (set, get) => ({
      regions: [],

      addRegion: (regionData) => {
        const newRegion: CanvasRegion = {
          ...regionData,
          id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          regions: [...state.regions, newRegion],
        }));
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

      clearRegions: () => {
        set({ regions: [] });
      },

      setRegions: (regions) => {
        set({ regions });
      },

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
    }),
    {
      name: 'canvas-regions-store',
      version: 1,
    }
  )
);