import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import { MapObject, MapObjectCategory, MAP_OBJECT_PRESETS, DOOR_TYPE_STYLES } from '@/types/mapObjectTypes';
import { DoorConnection, TerrainFeature } from '@/lib/dungeonTypes';

interface MapObjectStore {
  mapObjects: MapObject[];
  
  // Selection state
  selectedMapObjectIds: string[];
  
  // CRUD operations
  addMapObject: (mapObject: Omit<MapObject, 'id'> & { id?: string }) => string;
  updateMapObject: (id: string, updates: Partial<MapObject>) => void;
  removeMapObject: (id: string) => void;
  clearMapObjects: () => void;
  setMapObjects: (mapObjects: MapObject[]) => void;
  
  // Bulk operations
  updateMultipleMapObjects: (ids: string[], updates: Partial<MapObject>) => void;
  removeMultipleMapObjects: (ids: string[]) => void;
  
  // Selection operations
  selectMapObject: (id: string, additive?: boolean) => void;
  deselectMapObject: (id: string) => void;
  clearSelection: () => void;
  selectMultiple: (ids: string[]) => void;
  getSelectedMapObjects: () => MapObject[];
  
  // Factory method for creating from preset
  createFromPreset: (category: MapObjectCategory, position: { x: number; y: number }) => string;
  
  // Conversion from terrain features
  convertTerrainFeatureToMapObjects: (
    terrainType: 'column' | 'debris',
    tiles: { x: number; y: number }[],
    terrainFeatureId?: string
  ) => string[];
  
  // Conversion from doors
  convertDoorToMapObject: (door: DoorConnection) => string;
  convertDoorsToMapObjects: (doors: DoorConnection[]) => string[];
  
  // Door-specific operations
  toggleDoor: (id: string) => void;
  setDoorState: (id: string, isOpen: boolean) => void;
  
  // Get vision-blocking objects (for fog calculation)
  getVisionBlockingObjects: () => MapObject[];
}

const generateId = () => `map-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const mapObjectStoreCreator: StateCreator<MapObjectStore> = (set, get) => ({
  mapObjects: [],
  selectedMapObjectIds: [],

  addMapObject: (mapObjectData) => {
    const id = mapObjectData.id || generateId();
    const newMapObject: MapObject = {
      ...mapObjectData,
      id,
    };
    
    set((state) => ({
      mapObjects: [...state.mapObjects, newMapObject],
    }));
    
    return id;
  },

  updateMapObject: (id, updates) => {
    set((state) => ({
      mapObjects: state.mapObjects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }));
  },

  removeMapObject: (id) => {
    set((state) => ({
      mapObjects: state.mapObjects.filter((obj) => obj.id !== id),
      selectedMapObjectIds: state.selectedMapObjectIds.filter((selectedId) => selectedId !== id),
    }));
  },

  clearMapObjects: () => {
    set({ mapObjects: [], selectedMapObjectIds: [] });
  },

  setMapObjects: (mapObjects) => {
    set({ mapObjects });
  },

  updateMultipleMapObjects: (ids, updates) => {
    set((state) => ({
      mapObjects: state.mapObjects.map((obj) =>
        ids.includes(obj.id) ? { ...obj, ...updates } : obj
      ),
    }));
  },

  removeMultipleMapObjects: (ids) => {
    set((state) => ({
      mapObjects: state.mapObjects.filter((obj) => !ids.includes(obj.id)),
      selectedMapObjectIds: state.selectedMapObjectIds.filter((id) => !ids.includes(id)),
    }));
  },

  selectMapObject: (id, additive = false) => {
    set((state) => {
      if (additive) {
        if (state.selectedMapObjectIds.includes(id)) {
          return state; // Already selected
        }
        return {
          selectedMapObjectIds: [...state.selectedMapObjectIds, id],
          mapObjects: state.mapObjects.map((obj) =>
            obj.id === id ? { ...obj, selected: true } : obj
          ),
        };
      }
      // Non-additive: clear others and select this one
      return {
        selectedMapObjectIds: [id],
        mapObjects: state.mapObjects.map((obj) => ({
          ...obj,
          selected: obj.id === id,
        })),
      };
    });
  },

  deselectMapObject: (id) => {
    set((state) => ({
      selectedMapObjectIds: state.selectedMapObjectIds.filter((selectedId) => selectedId !== id),
      mapObjects: state.mapObjects.map((obj) =>
        obj.id === id ? { ...obj, selected: false } : obj
      ),
    }));
  },

  clearSelection: () => {
    set((state) => ({
      selectedMapObjectIds: [],
      mapObjects: state.mapObjects.map((obj) => ({ ...obj, selected: false })),
    }));
  },

  selectMultiple: (ids) => {
    set((state) => ({
      selectedMapObjectIds: ids,
      mapObjects: state.mapObjects.map((obj) => ({
        ...obj,
        selected: ids.includes(obj.id),
      })),
    }));
  },

  getSelectedMapObjects: () => {
    const { mapObjects, selectedMapObjectIds } = get();
    return mapObjects.filter((obj) => selectedMapObjectIds.includes(obj.id));
  },

  createFromPreset: (category, position) => {
    const preset = MAP_OBJECT_PRESETS[category];
    const id = generateId();
    
    const newMapObject: MapObject = {
      id,
      position,
      width: preset.width || 20,
      height: preset.height || 20,
      shape: preset.shape || 'circle',
      fillColor: preset.fillColor || '#6b7280',
      strokeColor: preset.strokeColor || '#4b5563',
      strokeWidth: preset.strokeWidth || 2,
      opacity: preset.opacity ?? 1,
      castsShadow: preset.castsShadow ?? false,
      blocksMovement: preset.blocksMovement ?? false,
      blocksVision: preset.blocksVision ?? false,
      revealedByLight: preset.revealedByLight ?? true,
      selected: false,
      category,
      isOpen: preset.isOpen,
    };
    
    set((state) => ({
      mapObjects: [...state.mapObjects, newMapObject],
    }));
    
    return id;
  },

  convertTerrainFeatureToMapObjects: (terrainType, tiles, terrainFeatureId) => {
    const category: MapObjectCategory = terrainType === 'column' ? 'column' : 'debris';
    const preset = MAP_OBJECT_PRESETS[category];
    const ids: string[] = [];
    
    const newMapObjects = tiles.map((tile) => {
      const id = generateId();
      ids.push(id);
      
      return {
        id,
        position: {
          // Center the object on the tile
          x: tile.x + 25,
          y: tile.y + 25,
        },
        width: preset.width || 16,
        height: preset.height || 16,
        shape: preset.shape || 'circle',
        fillColor: preset.fillColor || '#71717a',
        strokeColor: preset.strokeColor || '#52525b',
        strokeWidth: preset.strokeWidth || 2,
        opacity: preset.opacity ?? 1,
        castsShadow: preset.castsShadow ?? true,
        blocksMovement: preset.blocksMovement ?? true,
        blocksVision: preset.blocksVision ?? true,
        revealedByLight: preset.revealedByLight ?? true,
        selected: false,
        category,
        terrainFeatureId,
      } as MapObject;
    });
    
    set((state) => ({
      mapObjects: [...state.mapObjects, ...newMapObjects],
    }));
    
    return ids;
  },

  convertDoorToMapObject: (door) => {
    const id = generateId();
    const doorStyle = DOOR_TYPE_STYLES[door.type] || DOOR_TYPE_STYLES[0];
    const preset = MAP_OBJECT_PRESETS.door;
    
    // Calculate rotation based on door direction
    // Direction { x: 0, y: -1 } = facing up = 0 degrees
    // Direction { x: 1, y: 0 } = facing right = 90 degrees
    let rotation = 0;
    if (door.direction) {
      rotation = Math.atan2(door.direction.x, -door.direction.y) * (180 / Math.PI);
    }
    
    const newMapObject: MapObject = {
      id,
      position: door.position,
      width: preset.width || 50,
      height: preset.height || 8,
      rotation,
      shape: 'door',
      fillColor: doorStyle.fillColor,
      strokeColor: doorStyle.strokeColor,
      strokeWidth: preset.strokeWidth || 2,
      opacity: preset.opacity ?? 1,
      castsShadow: false,
      blocksMovement: false,
      blocksVision: true, // Closed doors block vision by default
      revealedByLight: true,
      selected: false,
      category: 'door',
      isOpen: false,
      doorType: door.type,
      doorDirection: door.direction,
      label: doorStyle.label,
    };
    
    set((state) => ({
      mapObjects: [...state.mapObjects, newMapObject],
    }));
    
    return id;
  },

  convertDoorsToMapObjects: (doors) => {
    const ids: string[] = [];
    const newMapObjects: MapObject[] = [];
    
    doors.forEach((door) => {
      const id = generateId();
      ids.push(id);
      
      const doorStyle = DOOR_TYPE_STYLES[door.type] || DOOR_TYPE_STYLES[0];
      const preset = MAP_OBJECT_PRESETS.door;
      
      // Calculate rotation based on door direction
      let rotation = 0;
      if (door.direction) {
        rotation = Math.atan2(door.direction.x, -door.direction.y) * (180 / Math.PI);
      }
      
      newMapObjects.push({
        id,
        position: door.position,
        width: preset.width || 50,
        height: preset.height || 8,
        rotation,
        shape: 'door',
        fillColor: doorStyle.fillColor,
        strokeColor: doorStyle.strokeColor,
        strokeWidth: preset.strokeWidth || 2,
        opacity: preset.opacity ?? 1,
        castsShadow: false,
        blocksMovement: false,
        blocksVision: true,
        revealedByLight: true,
        selected: false,
        category: 'door',
        isOpen: false,
        doorType: door.type,
        doorDirection: door.direction,
        label: doorStyle.label,
      });
    });
    
    set((state) => ({
      mapObjects: [...state.mapObjects, ...newMapObjects],
    }));
    
    return ids;
  },

  toggleDoor: (id) => {
    set((state) => ({
      mapObjects: state.mapObjects.map((obj) => {
        if (obj.id === id && obj.category === 'door') {
          const newIsOpen = !obj.isOpen;
          return {
            ...obj,
            isOpen: newIsOpen,
            // When open, don't block vision; when closed, block vision
            blocksVision: !newIsOpen,
          };
        }
        return obj;
      }),
    }));
  },

  setDoorState: (id, isOpen) => {
    set((state) => ({
      mapObjects: state.mapObjects.map((obj) => {
        if (obj.id === id && obj.category === 'door') {
          return {
            ...obj,
            isOpen,
            blocksVision: !isOpen,
          };
        }
        return obj;
      }),
    }));
  },

  getVisionBlockingObjects: () => {
    const { mapObjects } = get();
    return mapObjects.filter((obj) => obj.blocksVision);
  },
});

// Wrap with syncPatch middleware
const withSyncPatch = syncPatch<MapObjectStore>({
  channel: 'mapObjects',
  excludePaths: ['selectedMapObjectIds', 'mapObjects.*.imageUrl'],
  debug: false,
})(mapObjectStoreCreator);

// Persist options
const persistOptions: PersistOptions<MapObjectStore, Partial<MapObjectStore>> = {
  name: 'map-objects-store',
  version: 1,
  partialize: (state) => ({
    ...state,
    // Exclude selection state and large image data from persistence
    selectedMapObjectIds: [],
    mapObjects: state.mapObjects.map((obj) => ({
      ...obj,
      selected: false,
      imageUrl: undefined,
    })),
  }),
};

export const useMapObjectStore = create<MapObjectStore>()(
  persist(withSyncPatch as StateCreator<MapObjectStore, [], []>, persistOptions)
);
