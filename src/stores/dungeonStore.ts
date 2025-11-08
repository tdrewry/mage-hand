import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DoorConnection, Annotation, TerrainFeature } from '@/lib/dungeonTypes';
import { WatabouStyle, DEFAULT_STYLE } from '@/lib/watabouStyles';

interface DungeonStore {
  doors: DoorConnection[];
  annotations: Annotation[];
  terrainFeatures: TerrainFeature[];
  renderingMode: 'vtt' | 'dungeon-map';
  watabouStyle: WatabouStyle;
  
  // Rendering mode
  setRenderingMode: (mode: 'vtt' | 'dungeon-map') => void;
  setWatabouStyle: (style: WatabouStyle) => void;
  
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
    renderingMode: 'vtt',
    watabouStyle: DEFAULT_STYLE,
      
      setRenderingMode: (mode) => set({ renderingMode: mode }),
      setWatabouStyle: (style) => set({ watabouStyle: style }),
      
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
      version: 1,
    }
  )
);
