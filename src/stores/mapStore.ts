import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GridRegion {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
      bounds: { x: 0, y: 0, width: 2000, height: 2000 },
      gridType: 'square',
      gridSize: 40,
      gridColor: '#ffffff',
      gridOpacity: 80,
      visible: true,
    }
  ]
});

export const useMapStore = create<MapStore>()(
  persist(
    (set, get) => ({
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
      },

      updateMap: (id, updates) => {
        set((state) => ({
          maps: state.maps.map((map) =>
            map.id === id ? { ...map, ...updates } : map
          ),
        }));
      },

      removeMap: (id) => {
        set((state) => {
          const newMaps = state.maps.filter((map) => map.id !== id);
          return {
            maps: newMaps,
            selectedMapId: state.selectedMapId === id ? newMaps[0]?.id || null : state.selectedMapId,
          };
        });
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
            // Find the topmost visible region at this point
            const region = map.regions
              .filter((region) => region.visible)
              .find((region) =>
                x >= region.bounds.x &&
                x <= region.bounds.x + region.bounds.width &&
                y >= region.bounds.y &&
                y <= region.bounds.y + region.bounds.height
              );

            if (region) {
              return { map, region };
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
    }),
    {
      name: 'map-store',
      version: 1,
    }
  )
);