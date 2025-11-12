import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';

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
  backgroundColor?: string; // Background color for region
  
  // Path-based region support
  regionType?: 'rectangle' | 'path'; // Type of region
  pathPoints?: { x: number; y: number }[]; // Path vertices for free-form regions
  bezierControlPoints?: { cp1: { x: number; y: number }; cp2: { x: number; y: number } }[]; // Bezier control points for each segment
  smoothing?: boolean; // Whether to apply smoothing to path curves (default true)
  
  // Transformation support
  rotation?: number; // Rotation angle in degrees
  rotationCenter?: { x: number; y: number }; // Custom rotation center
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

export const useRegionStore = create<RegionStore>()(
  persist(
    (set, get) => ({
      regions: [],

      addRegion: (regionData) => {
        console.log('🔷 addRegion called with:', { hasId: !!regionData.id, regionData });
        
        // Generate ID if not provided
        const newRegion: CanvasRegion = {
          ...regionData,
          id: regionData.id || `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          regions: [...state.regions, newRegion],
        }));
        
        // Check if this is a remote sync by looking for the _fromRemote flag
        // Remote syncs will have `_fromRemote: true` added by the handler
        const isRemoteSync = (regionData as any)._fromRemote === true;
        
        // Only sync if this is a new LOCAL region (not from remote)
        if (!isRemoteSync && syncManager.isConnected()) {
          console.log('📤 Syncing new region:', newRegion.id);
          syncManager.syncRegionAdd(newRegion);
        } else if (isRemoteSync) {
          console.log('⏭️ Skipping sync for remote region:', newRegion.id);
        }
      },

      updateRegion: (id, updates) => {
        set((state) => ({
          regions: state.regions.map((region) =>
            region.id === id ? { ...region, ...updates } : region
          ),
        }));
        
        // Only sync if not coming from remote (updates without sync flag)
        if (updates.id === undefined || updates.id === id) {
          syncManager.syncRegionUpdate(id, updates);
        }
      },

      removeRegion: (id) => {
        const regionExists = get().regions.some(region => region.id === id);
        
        set((state) => ({
          regions: state.regions.filter((region) => region.id !== id),
        }));
        
        // Only sync if region existed (to avoid syncing remote removals)
        if (regionExists) {
          syncManager.syncRegionRemove(id);
        }
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