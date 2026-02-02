import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DoorConnection, Annotation, TerrainFeature, LightSource } from '@/lib/dungeonTypes';
import { WatabouStyle, DEFAULT_STYLE } from '@/lib/watabouStyles';
import { WallGeometry } from '@/lib/wallGeometry';

interface DungeonStore {
  doors: DoorConnection[];
  annotations: Annotation[];
  terrainFeatures: TerrainFeature[];
  lightSources: LightSource[];
  renderingMode: 'edit' | 'play';
  watabouStyle: WatabouStyle;
  wallEdgeStyle: 'stone' | 'wood' | 'metal' | 'simple';
  wallThickness: number;
  textureScale: number;
  lightDirection: number; // Angle in degrees (0 = top, 90 = right, 180 = bottom, 270 = left)
  shadowDistance: number; // Distance shadows extend from walls in pixels
  
  // Movement blocking settings
  enforceMovementBlocking: boolean; // Prevent tokens from passing through obstacles
  enforceRegionBounds: boolean; // Constrain tokens to stay within regions
  
  // Wall geometry caching
  cachedWallGeometry: WallGeometry | null;
  wallGeometryCacheKey: string | null;

  /**
   * Sets the cached wall geometry and its cache key.
   * @param geometry The wall geometry to cache, or null.
   * @param cacheKey The key associated with the cached geometry.
   */
  setCachedWallGeometry: (geometry: WallGeometry | null, cacheKey: string | null) => void;
  
  // Movement blocking setters
  /**
   * Sets whether movement blocking through obstacles is enforced.
   * @param enforce Whether to enforce movement blocking.
   */
  setEnforceMovementBlocking: (enforce: boolean) => void;
  
  /**
   * Sets whether tokens are constrained to region boundaries.
   * @param enforce Whether to enforce region bounds.
   */
  setEnforceRegionBounds: (enforce: boolean) => void;
  
  // Rendering mode
  /**
   * Sets the current rendering mode.
   * @param mode The rendering mode ('edit' or 'play').
   */
  setRenderingMode: (mode: 'edit' | 'play') => void;

  /**
   * Sets the Watabou style configuration for the dungeon.
   * @param style The Watabou style to apply.
   */
  setWatabouStyle: (style: WatabouStyle) => void;

  /**
   * Sets the edge style for dungeon walls.
   * @param style The wall edge style.
   */
  setWallEdgeStyle: (style: 'stone' | 'wood' | 'metal' | 'simple') => void;

  /**
   * Sets the thickness of dungeon walls.
   * @param thickness The wall thickness.
   */
  setWallThickness: (thickness: number) => void;

  /**
   * Sets the texture scaling factor for dungeon surfaces.
   * @param scale The texture scale.
   */
  setTextureScale: (scale: number) => void;

  /**
   * Sets the light direction for shadow rendering.
   * @param angle The angle in degrees.
   */
  setLightDirection: (angle: number) => void;

  /**
   * Sets the distance shadows extend from walls.
   * @param distance The shadow distance in pixels.
   */
  setShadowDistance: (distance: number) => void;
  
  // Light source operations
  /**
   * Adds a new light source to the dungeon.
   * @param source The light source data to add.
   */
  addLightSource: (source: Omit<LightSource, 'id'>) => void;

  /**
   * Updates an existing light source.
   * @param id The ID of the light source to update.
   * @param updates The updates to apply.
   */
  updateLightSource: (id: string, updates: Partial<LightSource>) => void;

  /**
   * Removes a light source from the dungeon.
   * @param id The ID of the light source to remove.
   */
  removeLightSource: (id: string) => void;

  /**
   * Clears all light sources from the dungeon.
   */
  clearLightSources: () => void;

  /**
   * Replaces the entire light sources array.
   * @param sources The new array of light sources.
   */
  setLightSources: (sources: LightSource[]) => void;
  
  // Door operations
  /**
   * Adds a new door connection to the dungeon.
   * @param door The door data to add.
   */
  addDoor: (door: Omit<DoorConnection, 'id'>) => void;

  /**
   * Updates an existing door.
   * @param id The ID of the door to update.
   * @param updates The updates to apply.
   */
  updateDoor: (id: string, updates: Partial<DoorConnection>) => void;

  /**
   * Removes a door from the dungeon.
   * @param id The ID of the door to remove.
   */
  removeDoor: (id: string) => void;

  /**
   * Clears all doors from the dungeon.
   */
  clearDoors: () => void;

  /**
   * Replaces the entire doors array.
   * @param doors The new array of doors.
   */
  setDoors: (doors: DoorConnection[]) => void;
  
  // Annotation operations
  /**
   * Adds a new annotation to the dungeon.
   * @param annotation The annotation data to add.
   */
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;

  /**
   * Updates an existing annotation.
   * @param id The ID of the annotation to update.
   * @param updates The updates to apply.
   */
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;

  /**
   * Removes an annotation from the dungeon.
   * @param id The ID of the annotation to remove.
   */
  removeAnnotation: (id: string) => void;

  /**
   * Clears all annotations from the dungeon.
   */
  clearAnnotations: () => void;

  /**
   * Replaces the entire annotations array.
   * @param annotations The new array of annotations.
   */
  setAnnotations: (annotations: Annotation[]) => void;
  
  // Terrain operations
  /**
   * Adds a new terrain feature to the dungeon.
   * @param feature The terrain feature data to add.
   */
  addTerrainFeature: (feature: Omit<TerrainFeature, 'id'>) => void;

  /**
   * Updates an existing terrain feature.
   * @param id The ID of the terrain feature to update.
   * @param updates The updates to apply.
   */
  updateTerrainFeature: (id: string, updates: Partial<TerrainFeature>) => void;

  /**
   * Removes a terrain feature from the dungeon.
   * @param id The ID of the terrain feature to remove.
   */
  removeTerrainFeature: (id: string) => void;

  /**
   * Clears all terrain features from the dungeon.
   */
  clearTerrainFeatures: () => void;

  /**
   * Replaces the entire terrain features array.
   * @param features The new array of terrain features.
   */
  setTerrainFeatures: (features: TerrainFeature[]) => void;
  
  // Clear all dungeon data
  /**
   * Clears all data related to the dungeon (doors, annotations, terrain, light sources).
   */
  clearAll: () => void;
}

export const useDungeonStore = create<DungeonStore>()(
  persist(
    (set) => ({
    doors: [],
    annotations: [],
    terrainFeatures: [],
    lightSources: [],
    renderingMode: 'edit',
    watabouStyle: DEFAULT_STYLE,
    wallEdgeStyle: 'stone',
    wallThickness: 1,
    textureScale: 1,
    lightDirection: 315, // Default: top-left (45 degrees from top)
    shadowDistance: 30, // Default: 30px shadow distance
    enforceMovementBlocking: false, // Default: disabled
    enforceRegionBounds: false, // Default: disabled
    cachedWallGeometry: null,
    wallGeometryCacheKey: null,
      
      setRenderingMode: (mode) => set({ renderingMode: mode }),
      setWatabouStyle: (style) => set({ watabouStyle: style }),
      setWallEdgeStyle: (style) => set({ wallEdgeStyle: style }),
      setWallThickness: (thickness) => set({ wallThickness: thickness }),
      setTextureScale: (scale) => set({ textureScale: scale }),
      setLightDirection: (angle) => set({ lightDirection: angle }),
      setShadowDistance: (distance) => set({ shadowDistance: distance }),
      setEnforceMovementBlocking: (enforce) => set({ enforceMovementBlocking: enforce }),
      setEnforceRegionBounds: (enforce) => set({ enforceRegionBounds: enforce }),
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
      
      // Light source operations
      addLightSource: (sourceData) => {
        const newSource: LightSource = {
          ...sourceData,
          id: `light-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        set((state) => ({
          lightSources: [...state.lightSources, newSource],
        }));
      },
      
      updateLightSource: (id, updates) => {
        set((state) => ({
          lightSources: state.lightSources.map((source) =>
            source.id === id ? { ...source, ...updates } : source
          ),
        }));
      },
      
      removeLightSource: (id) => {
        set((state) => ({
          lightSources: state.lightSources.filter((source) => source.id !== id),
        }));
      },
      
      clearLightSources: () => {
        set({ lightSources: [] });
      },
      
      setLightSources: (sources) => {
        set({ lightSources: sources });
      },
      
      // Clear all
      clearAll: () => {
        set({
          doors: [],
          annotations: [],
          terrainFeatures: [],
          lightSources: [],
        });
      },
    }),
    {
      name: 'dungeon-store',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Migrate from old mode names to new mode names
          if (persistedState.renderingMode === 'vtt') {
            persistedState.renderingMode = 'edit';
          } else if (persistedState.renderingMode === 'dungeon-map') {
            persistedState.renderingMode = 'play';
          }
        }
        if (version < 3) {
          // Migrate wall thickness from screen space (1-10) to world space (0.5-3)
          if (persistedState.wallThickness && persistedState.wallThickness > 3) {
            persistedState.wallThickness = 1; // Reset to default
          }
        }
        return persistedState;
      },
    }
  )
);
