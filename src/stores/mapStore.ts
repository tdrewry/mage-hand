import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import { useFogStore } from '@/stores/fogStore';

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

export interface Structure {
  id: string;
  name: string;
  /** When true, focusing a map in this structure deactivates all other maps in the structure */
  exclusiveFocus?: boolean;
}

export interface GameMap {
  id: string;
  name: string;
  imageUrl?: string; // In-memory image data (excluded from sync)
  imageHash?: string; // Hash for texture sync
  imageScale?: number; // Scale factor for the map image (default 1)
  imageOffsetX?: number; // Pixel offset for sub-grid alignment
  imageOffsetY?: number; // Pixel offset for sub-grid alignment
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  backgroundColor: string;
  /** @deprecated Use `active` instead */
  visible?: boolean;
  /** Whether this map is actively rendered on canvas. Multiple maps can be active simultaneously. */
  active: boolean;
  zIndex: number;
  regions: GridRegion[];
  /** If set, this map is a member of a compound map group */
  compoundMapId?: string;
  /** If set, this map belongs to a structure (e.g., multi-floor building) */
  structureId?: string;
  /** Floor number within a structure for ordering */
  floorNumber?: number;
}

// Helper type for creating new maps
type CreateMapData = Omit<GameMap, 'id' | 'regions'> & {
  regions: Omit<GridRegion, 'id'>[];
};

interface MapStore {
  maps: GameMap[];
  selectedMapId: string | null;
  structures: Structure[];
  /** Whether focus auto-follows the active token's map */
  autoFocusFollowsToken: boolean;
  
  addMap: (map: CreateMapData) => void;

  /**
   * Updates an existing map.
   * @param id The ID of the map to update.
   * @param updates The updates to apply.
   */
  updateMap: (id: string, updates: Partial<GameMap>) => void;

  /**
   * Removes a map from the store by its ID.
   * @param id The ID of the map to remove.
   */
  removeMap: (id: string) => void;

  /**
   * Sets the currently selected map.
   * @param id The ID of the map to select, or null.
   */
  setSelectedMap: (id: string | null) => void;

  /**
   * Reorders maps in the list.
   * @param fromIndex The original index of the map.
   * @param toIndex The new index of the map.
   */
  reorderMaps: (fromIndex: number, toIndex: number) => void;

  /**
   * Adds a new region to a specific map.
   * @param mapId The ID of the map.
   * @param region The region data to add.
   */
  addRegion: (mapId: string, region: Omit<GridRegion, 'id'>) => void;

  /**
   * Updates an existing region on a specific map.
   * @param mapId The ID of the map containing the region.
   * @param regionId The ID of the region to update.
   * @param updates The updates to apply.
   */
  updateRegion: (mapId: string, regionId: string, updates: Partial<GridRegion>) => void;

  /**
   * Removes a region from a specific map.
   * @param mapId The ID of the map containing the region.
   * @param regionId The ID of the region to remove.
   */
  removeRegion: (mapId: string, regionId: string) => void;

  /**
   * Finds the active region at the given coordinates.
   * @param x The x-coordinate.
   * @param y The y-coordinate.
   * @returns An object containing the map and region, or null if none found.
   */
  getActiveRegionAt: (x: number, y: number) => { map: GameMap; region: GridRegion } | null;

  /**
   * Gets a list of all currently visible maps.
   * @returns An array of visible GameMap objects.
   */
  getVisibleMaps: () => GameMap[];

  // Structure management
  addStructure: (name: string) => string;
  removeStructure: (id: string) => void;
  renameStructure: (id: string, name: string) => void;
  assignMapToStructure: (mapId: string, structureId: string, floorNumber?: number) => void;
  removeMapFromStructure: (mapId: string) => void;
  setAutoFocusFollowsToken: (value: boolean) => void;
  setStructureExclusiveFocus: (structureId: string, value: boolean) => void;

  /** Navigate to adjacent floor within same structure. Returns the map id navigated to, or null. */
  navigateFloor: (direction: 'up' | 'down') => string | null;
}

const createDefaultMap = (): GameMap => ({
  id: 'default-map',
  name: 'Default Battlemap',
  bounds: { x: 0, y: 0, width: 2000, height: 2000 },
  backgroundColor: '#2a2a2a',
  active: true,
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
  structures: [],
  autoFocusFollowsToken: false,

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
    // Auto-init fog settings for new map
    useFogStore.getState().initMapFogSettings(newMap.id);
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
    // Cleanup fog settings for removed map
    useFogStore.getState().removeMapFogSettings(id);
    // Sync happens automatically via syncPatch middleware
  },

  setSelectedMap: (id) => {
    set({ selectedMapId: id });

    // Enforce exclusive focus for structures
    if (id) {
      const { maps, structures } = get();
      const focusedMap = maps.find(m => m.id === id);
      if (focusedMap?.structureId) {
        const structure = structures.find(s => s.id === focusedMap.structureId);
        if (structure?.exclusiveFocus) {
          set((state) => ({
            maps: state.maps.map(m => {
              if (m.structureId === focusedMap.structureId && m.id !== id) {
                return { ...m, active: false };
              }
              // Ensure the focused map is active
              if (m.id === id && !m.active) {
                return { ...m, active: true };
              }
              return m;
            }),
          }));
        }
      }
    }
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
    const activeMaps = maps
      .filter((map) => map.active)
      .sort((a, b) => b.zIndex - a.zIndex); // Higher z-index first

    for (const map of activeMaps) {
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
      .filter((map) => map.active)
      .sort((a, b) => a.zIndex - b.zIndex);
  },

  // ── Structure management ────────────────────────────────────────────────
  addStructure: (name) => {
    const id = `structure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({ structures: [...state.structures, { id, name }] }));
    return id;
  },

  removeStructure: (id) => {
    set((state) => ({
      structures: state.structures.filter(s => s.id !== id),
      maps: state.maps.map(m => m.structureId === id ? { ...m, structureId: undefined, floorNumber: undefined } : m),
    }));
  },

  renameStructure: (id, name) => {
    set((state) => ({
      structures: state.structures.map(s => s.id === id ? { ...s, name } : s),
    }));
  },

  assignMapToStructure: (mapId, structureId, floorNumber) => {
    set((state) => {
      // Auto-assign floor number if not provided
      let floor = floorNumber;
      if (floor === undefined) {
        const existing = state.maps.filter(m => m.structureId === structureId && m.floorNumber !== undefined);
        const maxFloor = existing.length > 0 ? Math.max(...existing.map(m => m.floorNumber!)) : 0;
        floor = maxFloor + 1;
      }
      return {
        maps: state.maps.map(m => m.id === mapId ? { ...m, structureId, floorNumber: floor } : m),
      };
    });
  },

  removeMapFromStructure: (mapId) => {
    set((state) => ({
      maps: state.maps.map(m => m.id === mapId ? { ...m, structureId: undefined, floorNumber: undefined } : m),
    }));
  },

  setAutoFocusFollowsToken: (value) => set({ autoFocusFollowsToken: value }),

  setStructureExclusiveFocus: (structureId, value) => {
    set((state) => ({
      structures: state.structures.map(s =>
        s.id === structureId ? { ...s, exclusiveFocus: value } : s
      ),
    }));

    // If enabling, immediately enforce: deactivate non-focused sibling maps
    if (value) {
      const { maps, selectedMapId } = get();
      const focusedMap = maps.find(m => m.id === selectedMapId);
      if (focusedMap?.structureId === structureId) {
        set((state) => ({
          maps: state.maps.map(m => {
            if (m.structureId === structureId && m.id !== selectedMapId) {
              return { ...m, active: false };
            }
            return m;
          }),
        }));
      }
    }
  },

  navigateFloor: (direction) => {
    const { maps, selectedMapId } = get();
    const currentMap = maps.find(m => m.id === selectedMapId);
    if (!currentMap?.structureId || currentMap.floorNumber === undefined) return null;

    const floorsInStructure = maps
      .filter(m => m.structureId === currentMap.structureId && m.floorNumber !== undefined)
      .sort((a, b) => a.floorNumber! - b.floorNumber!);

    const currentIdx = floorsInStructure.findIndex(m => m.id === currentMap.id);
    const targetIdx = direction === 'up' ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0 || targetIdx >= floorsInStructure.length) return null;

    const target = floorsInStructure[targetIdx];
    const structure = get().structures.find(s => s.id === currentMap.structureId);

    if (structure?.exclusiveFocus) {
      // Exclusive: activate target, deactivate all other structure maps
      set((state) => ({
        selectedMapId: target.id,
        maps: state.maps.map(m => {
          if (m.structureId === currentMap.structureId) {
            return { ...m, active: m.id === target.id };
          }
          return m;
        }),
      }));
    } else {
      set({ selectedMapId: target.id });
      // Auto-activate if inactive
      if (!target.active) {
        set((state) => ({
          maps: state.maps.map(m => m.id === target.id ? { ...m, active: true } : m),
        }));
      }
    }
    return target.id;
  },
});

// Wrap with syncPatch middleware
const withSyncPatch = syncPatch<MapStore>({ 
  channel: 'maps',
  excludePaths: ['selectedMapId', 'autoFocusFollowsToken'],
  debug: false,
})(mapStoreCreator);

// Persist options with migration from visible → active
const persistOptions: PersistOptions<MapStore, Partial<MapStore>> = {
  name: 'map-store',
  version: 3, // v3: visible → active migration
  migrate: (persistedState: any, version: number) => {
    if (version < 3 && persistedState?.maps) {
      persistedState.maps = persistedState.maps.map((map: any) => ({
        ...map,
        active: map.active ?? map.visible ?? true,
      }));
    }
    return persistedState;
  },
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
