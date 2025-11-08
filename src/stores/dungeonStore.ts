import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DoorConnection, Annotation, TerrainFeature } from '@/lib/dungeonTypes';
import { WatabouStyle, DEFAULT_STYLE } from '@/lib/watabouStyles';
import { WallGeometry } from '@/lib/wallGeometry';

interface DungeonStore {
  doors: DoorConnection[];
  annotations: Annotation[];
  terrainFeatures: TerrainFeature[];
  renderingMode: 'edit' | 'play';
  watabouStyle: WatabouStyle;
  wallEdgeStyle: 'stone' | 'wood' | 'metal' | 'simple';
  
  // Wall geometry caching
  cachedWallGeometry: WallGeometry | null;
  wallGeometryCacheKey: string | null;
  setCachedWallGeometry: (geometry: WallGeometry | null, cacheKey: string | null) => void;
  
  // Rendering mode
  setRenderingMode: (mode: 'edit' | 'play') => void;
  setWatabouStyle: (style: WatabouStyle) => void;
  setWallEdgeStyle: (style: 'stone' | 'wood' | 'metal' | 'simple') => void;
  
  // Door operations
  addDoor: (door: Omit<DoorConnection, 'id'>) => void;
  updateDoor: (id: string, updates: Partial<DoorConnection>) => void;
  removeDoor: (id: string) => void;
  clearDoors: () => void;
  setDoors: (doors: DoorConnection[]) => void;
  
  // Annotation operations
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  setAnnotations: (annotations: Annotation[]) => void;
  
  // Terrain operations
  addTerrainFeature: (feature: Omit<TerrainFeature, 'id'>) => void;
  updateTerrainFeature: (id: string, updates: Partial<TerrainFeature>) => void;
  removeTerrainFeature: (id: string) => void;
  clearTerrainFeatures: () => void;
  setTerrainFeatures: (features: TerrainFeature[]) => void;
  
  // Clear all dungeon data
  clearAll: () => void;
}

export const useDungeonStore = create<DungeonStore>()(
  persist(
    (set) => ({
    doors: [],
    annotations: [],
    terrainFeatures: [],
    renderingMode: 'edit',
    watabouStyle: DEFAULT_STYLE,
    wallEdgeStyle: 'stone',
    cachedWallGeometry: null,
    wallGeometryCacheKey: null,
      
      setRenderingMode: (mode) => set({ renderingMode: mode }),
      setWatabouStyle: (style) => set({ watabouStyle: style }),
      setWallEdgeStyle: (style) => set({ wallEdgeStyle: style }),
      setCachedWallGeometry: (geometry, cacheKey) => set({ 
        cachedWallGeometry: geometry, 
        wallGeometryCacheKey: cacheKey 
      }),
      
      // Door operations
      addDoor: (doorData) => {
        const newDoor: DoorConnection = {
          ...doorData,
          id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        set((state) => ({
          doors: [...state.doors, newDoor],
        }));
      },
      
      updateDoor: (id, updates) => {
        set((state) => ({
          doors: state.doors.map((door) =>
            door.id === id ? { ...door, ...updates } : door
          ),
        }));
      },
      
      removeDoor: (id) => {
        set((state) => ({
          doors: state.doors.filter((door) => door.id !== id),
        }));
      },
      
      clearDoors: () => {
        set({ doors: [] });
      },
      
      setDoors: (doors) => {
        set({ doors });
      },
      
      // Annotation operations
      addAnnotation: (annotationData) => {
        const newAnnotation: Annotation = {
          ...annotationData,
          id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        set((state) => ({
          annotations: [...state.annotations, newAnnotation],
        }));
      },
      
      updateAnnotation: (id, updates) => {
        set((state) => ({
          annotations: state.annotations.map((annotation) =>
            annotation.id === id ? { ...annotation, ...updates } : annotation
          ),
        }));
      },
      
      removeAnnotation: (id) => {
        set((state) => ({
          annotations: state.annotations.filter((annotation) => annotation.id !== id),
        }));
      },
      
      clearAnnotations: () => {
        set({ annotations: [] });
      },
      
      setAnnotations: (annotations) => {
        set({ annotations });
      },
      
      // Terrain operations
      addTerrainFeature: (featureData) => {
        const newFeature: TerrainFeature = {
          ...featureData,
          id: `terrain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        set((state) => ({
          terrainFeatures: [...state.terrainFeatures, newFeature],
        }));
      },
      
      updateTerrainFeature: (id, updates) => {
        set((state) => ({
          terrainFeatures: state.terrainFeatures.map((feature) =>
            feature.id === id ? { ...feature, ...updates } : feature
          ),
        }));
      },
      
      removeTerrainFeature: (id) => {
        set((state) => ({
          terrainFeatures: state.terrainFeatures.filter((feature) => feature.id !== id),
        }));
      },
      
      clearTerrainFeatures: () => {
        set({ terrainFeatures: [] });
      },
      
      setTerrainFeatures: (features) => {
        set({ terrainFeatures: features });
      },
      
      // Clear all
      clearAll: () => {
        set({
          doors: [],
          annotations: [],
          terrainFeatures: [],
        });
      },
    }),
    {
      name: 'dungeon-store',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Migrate from old mode names to new mode names
          if (persistedState.renderingMode === 'vtt') {
            persistedState.renderingMode = 'edit';
          } else if (persistedState.renderingMode === 'dungeon-map') {
            persistedState.renderingMode = 'play';
          }
        }
        return persistedState;
      },
    }
  )
);
