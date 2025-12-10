import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';

export interface GridRegion {
  id: string;
  name: string;
  points: Array<{ x: number; y: number }>; // Polygon points instead of bounds
  gridType: 'square' | 'hex' | 'none';
  gridSize: number;
  gridColor: string;
  gridOpacity: number;
  visible: boolean;
}

export interface GameMap {
  id: string;
  name: string;
  imageUrl?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  backgroundColor: string;
  visible: boolean;
  zIndex: number;
  regions: GridRegion[];
}

// Helper type for creating new maps
type CreateMapData = Omit<GameMap, 'id' | 'regions'> & {
  regions: Omit<GridRegion, 'id'>[];
};

interface MapStore {
  maps: GameMap[];
  selectedMapId: string | null;
  
  // Map operations
  addMap: (map: CreateMapData) => void;
  updateMap: (id: string, updates: Partial<GameMap>) => void;
  removeMap: (id: string) => void;
  setSelectedMap: (id: string | null) => void;
  reorderMaps: (fromIndex: number, toIndex: number) => void;
  
  // Region operations
  addRegion: (mapId: string, region: Omit<GridRegion, 'id'>) => void;
  updateRegion: (mapId: string, regionId: string, updates: Partial<GridRegion>) => void;
  removeRegion: (mapId: string, regionId: string) => void;
  
  // Utilities
  getActiveRegionAt: (x: number, y: number) => { map: GameMap; region: GridRegion } | null;
  getVisibleMaps: () => GameMap[];
}

const createDefaultMap = (): GameMap => ({
  id: 'default-map',
  name: 'Default Battlemap',
  bounds: { x: 0, y: 0, width: 2000, height: 2000 },
  backgroundColor: '#2a2a2a',
  visible: true,
  zIndex: 0,
  regions: [
    {
      id: 'default-region',
      name: 'Main Area',
      points: [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 2000 },
        { x: 0, y: 2000 }
      ], // Rectangle as polygon
      gridType: 'square',
      gridSize: 40,
      gridColor: '#ffffff',
      gridOpacity: 80,
      visible: true,
    }
  ]
});

// Define the store creator separately for better type inference
const mapStoreCreator: StateCreator<MapStore> = (set, get) => ({
  maps: [createDefaultMap()],
  selectedMapId: 'default-map',

  addMap: (mapData) => {
    const newMap: GameMap = {
      ...mapData,
      id: `map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      regions: mapData.regions.map(region => ({
        ...region,
        id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))
    };
    
    set((state) => ({
      maps: [...state.maps, newMap],
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateMap: (id, updates) => {
    set((state) => ({
      maps: state.maps.map((map) =>
        map.id === id ? { ...map, ...updates } : map
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  removeMap: (id) => {
    set((state) => {
      const newMaps = state.maps.filter((map) => map.id !== id);
      return {
        maps: newMaps,
        selectedMapId: state.selectedMapId === id ? newMaps[0]?.id || null : state.selectedMapId,
      };
    });
    // Sync happens automatically via syncPatch middleware
  },

  setSelectedMap: (id) => {
    set({ selectedMapId: id });
  },

  reorderMaps: (fromIndex, toIndex) => {
    set((state) => {
      const newMaps = [...state.maps];
      const [removed] = newMaps.splice(fromIndex, 1);
      newMaps.splice(toIndex, 0, removed);
      
      // Update z-indices based on new order
      newMaps.forEach((map, index) => {
        map.zIndex = index;
      });
      
      return { maps: newMaps };
    });
    // Sync happens automatically via syncPatch middleware
  },

  addRegion: (mapId, regionData) => {
    const newRegion: GridRegion = {
      ...regionData,
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    set((state) => ({
      maps: state.maps.map((map) =>
        map.id === mapId
          ? { ...map, regions: [...map.regions, newRegion] }
          : map
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateRegion: (mapId, regionId, updates) => {
    set((state) => ({
      maps: state.maps.map((map) =>
        map.id === mapId
          ? {
              ...map,
              regions: map.regions.map((region) =>
                region.id === regionId ? { ...region, ...updates } : region
              ),
            }
          : map
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  removeRegion: (mapId, regionId) => {
    set((state) => ({
      maps: state.maps.map((map) =>
        map.id === mapId
          ? {
              ...map,
              regions: map.regions.filter((region) => region.id !== regionId),
            }
          : map
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  getActiveRegionAt: (x, y) => {
    const { maps } = get();
    const visibleMaps = maps
      .filter((map) => map.visible)
      .sort((a, b) => b.zIndex - a.zIndex); // Higher z-index first

    for (const map of visibleMaps) {
      // Check if point is within map bounds
      if (
        x >= map.bounds.x &&
        x <= map.bounds.x + map.bounds.width &&
        y >= map.bounds.y &&
        y <= map.bounds.y + map.bounds.height
      ) {
        // Find the smallest visible region at this point (most specific)
        const matchingRegions = map.regions
          .filter((region) => region.visible)
          .filter((region) => isPointInPolygon(x, y, region.points));

        if (matchingRegions.length > 0) {
          // Sort by area (smallest first) to get the most specific region
          const smallestRegion = matchingRegions.sort((a, b) => {
            const areaA = calculatePolygonArea(a.points);
            const areaB = calculatePolygonArea(b.points);
            return areaA - areaB;
          })[0];

          return { map, region: smallestRegion };
        }
      }
    }

    return null;
  },

  getVisibleMaps: () => {
    const { maps } = get();
    return maps
      .filter((map) => map.visible)
      .sort((a, b) => a.zIndex - b.zIndex); // Lower z-index first for rendering
  },
});

// Wrap with syncPatch middleware
const withSyncPatch = syncPatch<MapStore>({ 
  channel: 'maps',
  excludePaths: ['selectedMapId'], // Local selection state
  debug: false,
})(mapStoreCreator);

// Persist options
const persistOptions: PersistOptions<MapStore, Partial<MapStore>> = {
  name: 'map-store',
  version: 2, // Increment version for polygon migration
};

export const useMapStore = create<MapStore>()(
  persist(withSyncPatch as StateCreator<MapStore, [], []>, persistOptions)
);

// Utility functions for polygon operations
function isPointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    if (((points[i].y > y) !== (points[j].y > y)) &&
        (x < (points[j].x - points[i].x) * (y - points[i].y) / (points[j].y - points[i].y) + points[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

function calculatePolygonArea(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}
