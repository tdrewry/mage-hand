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
  gridScale: number; // Decimal multiplier for grid size (1 = default)
  gridSnapping: boolean; // Per-region snapping toggle
  gridVisible: boolean; // Per-region grid visibility toggle
  backgroundImage?: string; // URL or data URI for background texture (in-memory only, excluded from sync)
  textureHash?: string; // Hash for texture sync - this is what gets synced to other clients
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  backgroundScale?: number; // Scale factor for background image (1 = original size)
  backgroundOffsetX?: number; // Offset for background alignment
  backgroundOffsetY?: number; // Offset for background alignment
  backgroundColor?: string; // Background color for region
  
  // Path-based region support
  regionType?: 'rectangle' | 'path'; // Type of region
  pathPoints?: { x: number; y: number }[]; // Path vertices for free-form regions
  bezierControlPoints?: { cp1: { x: number; y: number }; cp2: { x: number; y: number } }[]; // Bezier control points for each segment
  smoothing?: boolean; // Whether to apply smoothing to path curves (default true)
  
  // Transformation support
  rotation?: number; // Rotation angle in degrees
  rotationCenter?: { x: number; y: number }; // Custom rotation center
  locked?: boolean; // Prevent movement, resize, and deletion
}

interface RegionStore {
  regions: CanvasRegion[];
  
  // Region operations
  addRegion: (region: Omit<CanvasRegion, 'id'> & { id?: string }) => void;
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

// Define the store creator separately for better type inference
const regionStoreCreator: StateCreator<RegionStore> = (set, get) => ({
  regions: [],

  addRegion: (regionData) => {
    // Generate ID if not provided
    const newRegion: CanvasRegion = {
      ...regionData,
      id: regionData.id || `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    set((state) => ({
      regions: [...state.regions, newRegion],
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateRegion: (id, updates) => {
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === id ? { ...region, ...updates } : region
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  removeRegion: (id) => {
    set((state) => ({
      regions: state.regions.filter((region) => region.id !== id),
    }));
    // Sync happens automatically via syncPatch middleware
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
});

// Wrap with syncPatch middleware
const withSyncPatch = syncPatch<RegionStore>({ 
  channel: 'regions',
  excludePaths: ['regions.*.backgroundImage'], // Exclude large image data, sync textureHash instead
  debug: false,
})(regionStoreCreator);

// Persist options
const persistOptions: PersistOptions<RegionStore, Partial<RegionStore>> = {
  name: 'canvas-regions-store',
  version: 2,
  partialize: (state) => ({
    ...state,
    // Exclude backgroundImage from persistence to avoid localStorage quota issues
    // Base64 images are too large for localStorage (~5MB limit)
    regions: state.regions.map(region => ({
      ...region,
      backgroundImage: undefined,
    })),
  }),
};

export const useRegionStore = create<RegionStore>()(
  persist(withSyncPatch as StateCreator<RegionStore, [], []>, persistOptions)
);
