import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import { MapObject, MapObjectCategory, MAP_OBJECT_PRESETS, DOOR_TYPE_STYLES } from '@/types/mapObjectTypes';
import { DoorConnection } from '@/lib/dungeonTypes';
import { groupConnectedTiles, generateSimpleContour } from '@/utils/marchingSquares';
import { simplifyPath, smoothPath } from '@/utils/pathSimplification';

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
  
  // Conversion from terrain features (legacy column/debris)
  convertTerrainFeatureToMapObjects: (
    terrainType: 'column' | 'debris',
    tiles: { x: number; y: number }[],
    terrainFeatureId?: string
  ) => string[];
  
  // Conversion from water/trap terrain data to MapObjects
  convertWaterToMapObject: (
    tiles: { x: number; y: number }[],
    fluidBoundary?: { x: number; y: number }[]
  ) => string;
  convertTrapToMapObject: (tile: { x: number; y: number }) => string;

  // Conversion from annotations
  convertAnnotationToMapObject: (annotation: { id?: string; text: string; reference: string; position: { x: number; y: number } }) => string;
  
  // Conversion from doors
  convertDoorToMapObject: (door: DoorConnection) => string;
  convertDoorsToMapObjects: (doors: DoorConnection[]) => string[];
  
  // Door-specific operations
  toggleDoor: (id: string) => void;
  setDoorState: (id: string, isOpen: boolean) => void;
  closeAllDoors: () => void;
  
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
      
      // Columns should be at grid intersection points (tile coordinates directly)
      // Debris/other objects should be centered on the tile (+25 offset)
      const isColumn = terrainType === 'column';
      
      return {
        id,
        position: {
          // Columns: at grid intersection (no offset)
          // Others: center of tile (+25 offset for 50px grid)
          x: isColumn ? tile.x : tile.x + 25,
          y: isColumn ? tile.y : tile.y + 25,
        },
        width: preset.width || 16,
        height: preset.height || 16,
        shape: preset.shape || 'circle',
        fillColor: preset.fillColor || '#71717a',
        strokeColor: preset.strokeColor || '#52525b',
        strokeWidth: preset.strokeWidth || 2,
        opacity: preset.opacity ?? 1,
        castsShadow: preset.castsShadow ?? false,
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

  convertWaterToMapObject: (tiles, fluidBoundary) => {
    const GRID_SIZE = 50;
    let boundary = fluidBoundary;

    // If no fluid boundary, generate one from tiles using marching squares
    if (!boundary || boundary.length < 3) {
      if (tiles.length > 0) {
        const groups = groupConnectedTiles(tiles);
        if (groups.length > 0) {
          const largest = groups.reduce((a, b) => a.length > b.length ? a : b);
          let contour = generateSimpleContour(largest, GRID_SIZE);
          if (contour.length > 0) {
            contour = simplifyPath(contour, 3.0);
            contour = smoothPath(contour, 3);
            boundary = contour;
          }
        }
      }
    }

    // Fallback: bounding rectangle from tiles
    if (!boundary || boundary.length < 3) {
      if (tiles.length === 0) {
        boundary = [
          { x: 0, y: 0 }, { x: GRID_SIZE, y: 0 },
          { x: GRID_SIZE, y: GRID_SIZE }, { x: 0, y: GRID_SIZE },
        ];
      } else {
        const xs = tiles.map(t => t.x);
        const ys = tiles.map(t => t.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs) + GRID_SIZE;
        const minY = Math.min(...ys), maxY = Math.max(...ys) + GRID_SIZE;
        boundary = [
          { x: minX, y: minY }, { x: maxX, y: minY },
          { x: maxX, y: maxY }, { x: minX, y: maxY },
        ];
      }
    }

    // Compute centroid of boundary (used as position)
    const centroidX = boundary.reduce((s, p) => s + p.x, 0) / boundary.length;
    const centroidY = boundary.reduce((s, p) => s + p.y, 0) / boundary.length;

    // Make customPath relative to centroid so ctx.translate(position) + draw works correctly
    const relativePath = boundary.map(p => ({ x: p.x - centroidX, y: p.y - centroidY }));

    // Bounding box
    const xs = relativePath.map(p => p.x);
    const ys = relativePath.map(p => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);

    const id = generateId();
    const mapObj: MapObject = {
      id,
      position: { x: centroidX, y: centroidY },
      width: w,
      height: h,
      shape: 'custom',
      category: 'water',
      customPath: relativePath,
      fillColor: 'rgba(59, 130, 246, 0.35)',
      strokeColor: 'rgba(96, 165, 250, 0.6)',
      strokeWidth: 1,
      opacity: 1,
      castsShadow: false,
      blocksMovement: false,
      blocksVision: false,
      revealedByLight: false,
      selected: false,
    };

    set(state => ({ mapObjects: [...state.mapObjects, mapObj] }));
    return id;
  },

  convertTrapToMapObject: (tile) => {
    const GRID_SIZE = 50;
    // One MapObject per trap tile — simple square polygon
    const cx = tile.x + GRID_SIZE / 2;
    const cy = tile.y + GRID_SIZE / 2;
    const half = GRID_SIZE / 2;

    const relativePath = [
      { x: -half, y: -half },
      { x:  half, y: -half },
      { x:  half, y:  half },
      { x: -half, y:  half },
    ];

    const id = generateId();
    const mapObj: MapObject = {
      id,
      position: { x: cx, y: cy },
      width: GRID_SIZE,
      height: GRID_SIZE,
      shape: 'custom',
      category: 'trap',
      customPath: relativePath,
      fillColor: 'rgba(220, 38, 38, 0.2)',
      strokeColor: '#dc2626',
      strokeWidth: 2,
      opacity: 1,
      castsShadow: false,
      blocksMovement: false,
      blocksVision: false,
      revealedByLight: true,
      selected: false,
    };

    set(state => ({ mapObjects: [...state.mapObjects, mapObj] }));
    return id;
  },

  convertAnnotationToMapObject: (annotation) => {
    const id = annotation.id || generateId();
    const mapObj: MapObject = {
      id,
      position: { x: annotation.position.x, y: annotation.position.y },
      width: 24,
      height: 24,
      shape: 'annotation',
      category: 'annotation',
      annotationText: annotation.text,
      annotationReference: annotation.reference,
      fillColor: '#3b82f6',
      strokeColor: '#ffffff',
      strokeWidth: 2,
      opacity: 1,
      castsShadow: false,
      blocksMovement: false,
      blocksVision: false,
      revealedByLight: false,
      selected: false,
      label: annotation.reference,
    };
    set(state => ({ mapObjects: [...state.mapObjects, mapObj] }));
    return id;
  },

  convertDoorToMapObject: (door) => {
    const id = generateId();
    const doorStyle = DOOR_TYPE_STYLES[door.type] || DOOR_TYPE_STYLES[0];
    
    // Determine if vertical based on direction
    // Watabou door.direction indicates which way the door faces
    // If door faces up/down (y dominant), it's a horizontal door (no rotation needed)
    // If door faces left/right (x dominant), it's a vertical door (needs 90° rotation)
    const isVertical = door.direction ? Math.abs(door.direction.x) > Math.abs(door.direction.y) : false;
    
    // Door dimensions - match grid spacing (50px is GRID_SIZE)
    // width = door span (length of doorway), height = door thickness
    // These stay consistent; rotation handles orientation
    const doorLength = 40; // Slightly smaller than grid cell
    const doorThickness = 6;
    
    const newMapObject: MapObject = {
      id,
      position: door.position,
      // Always use consistent dimensions: width = span, height = thickness
      width: doorLength,
      height: doorThickness,
      // Use rotation to orient the door: 0° = horizontal, 90° = vertical
      rotation: isVertical ? 90 : 0,
      shape: 'door',
      fillColor: doorStyle.fillColor,
      strokeColor: doorStyle.strokeColor,
      strokeWidth: 2,
      opacity: 1,
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
      
      // Determine if vertical based on direction
      // If door faces left/right (x dominant), it's a vertical door (needs 90° rotation)
      const isVertical = door.direction ? Math.abs(door.direction.x) > Math.abs(door.direction.y) : false;
      
      // Door dimensions - match grid spacing
      // width = door span (length of doorway), height = door thickness
      const doorLength = 40;
      const doorThickness = 6;
      
      newMapObjects.push({
        id,
        position: door.position,
        // Always use consistent dimensions: width = span, height = thickness
        width: doorLength,
        height: doorThickness,
        // Use rotation to orient the door: 0° = horizontal, 90° = vertical
        rotation: isVertical ? 90 : 0,
        shape: 'door',
        fillColor: doorStyle.fillColor,
        strokeColor: doorStyle.strokeColor,
        strokeWidth: 2,
        opacity: 1,
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

  closeAllDoors: () => {
    set((state) => ({
      mapObjects: state.mapObjects.map((obj) => {
        if (obj.category === 'door') {
          return {
            ...obj,
            isOpen: false,
            blocksVision: true,
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
