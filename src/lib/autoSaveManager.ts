import { useSessionStore } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { useRegionStore } from '@/stores/regionStore';
import { useGroupStore } from '@/stores/groupStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useRoleStore } from '@/stores/roleStore';
import { useVisionProfileStore } from '@/stores/visionProfileStore';
import { useFogStore } from '@/stores/fogStore';
// lightStore removed — freestanding lights now in illuminationStore
import { useCardStore } from '@/stores/cardStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useIlluminationStore } from '@/stores/illuminationStore';
import { useCreatureStore } from '@/stores/creatureStore';
import { useHatchingStore } from '@/stores/hatchingStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { serializeProject, deserializeProject, ProjectData } from './projectSerializer';

const AUTO_SAVE_KEY = 'magehand-autosave';
const AUTO_SAVE_SETTINGS_KEY = 'magehand-autosave-settings';
const AUTO_SAVE_TIMESTAMP_KEY = 'magehand-autosave-timestamp';

export interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
}

export const DEFAULT_AUTO_SAVE_SETTINGS: AutoSaveSettings = {
  enabled: false,
  intervalMinutes: 2,
};

export class AutoSaveManager {
  private intervalId: NodeJS.Timeout | null = null;
  private debounceTimeoutId: NodeJS.Timeout | null = null;
  private settings: AutoSaveSettings;
  private lastSaveTime: number = 0;
  private hasChanges: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.settings = this.loadSettings();
    this.lastSaveTime = this.loadLastSaveTime();
    this.setupStoreListeners();
  }

  private loadSettings(): AutoSaveSettings {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_AUTO_SAVE_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load auto-save settings:', error);
    }
    return DEFAULT_AUTO_SAVE_SETTINGS;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(AUTO_SAVE_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save auto-save settings:', error);
    }
  }

  private loadLastSaveTime(): number {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_TIMESTAMP_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      console.error('Failed to load last save time:', error);
      return 0;
    }
  }

  private setupStoreListeners(): void {
    // Listen to store changes to mark that there are pending changes
    const markChanges = () => {
      this.hasChanges = true;
      this.debouncedSave();
    };

    // Subscribe to all stores
    useSessionStore.subscribe(markChanges);
    useMapStore.subscribe(markChanges);
    useRegionStore.subscribe(markChanges);
    useGroupStore.subscribe(markChanges);
    useInitiativeStore.subscribe(markChanges);
    useRoleStore.subscribe(markChanges);
    useVisionProfileStore.subscribe(markChanges);
    useFogStore.subscribe(markChanges);
    // useLightStore removed — illuminationStore subscription covers freestanding lights
    useCardStore.subscribe(markChanges);
    useDungeonStore.subscribe(markChanges);
    useMapObjectStore.subscribe(markChanges);
    useIlluminationStore.subscribe(markChanges);
    useCreatureStore.subscribe(markChanges);
    useHatchingStore.subscribe(markChanges);
    useRuleStore.subscribe(markChanges);
    useGlobalConfigStore.subscribe(markChanges);
  }

  private debouncedSave(): void {
    if (!this.settings.enabled) return;

    // Clear existing debounce timeout
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
    }

    // Wait 5 seconds after last change before saving
    this.debounceTimeoutId = setTimeout(() => {
      this.performSave();
    }, 5000);
  }

  private async performSave(): Promise<void> {
    if (!this.settings.enabled || !this.hasChanges) return;

    try {
      const sessionState = useSessionStore.getState();
      const mapState = useMapStore.getState();
      const regionState = useRegionStore.getState();
      const groupState = useGroupStore.getState();
      const initiativeState = useInitiativeStore.getState();
      const roleState = useRoleStore.getState();
      const visionProfileState = useVisionProfileStore.getState();
      const fogState = useFogStore.getState();

      const cardState = useCardStore.getState();
      const dungeonState = useDungeonStore.getState();
      const mapObjectState = useMapObjectStore.getState();
      const illuminationState = useIlluminationStore.getState();
      const creatureState = useCreatureStore.getState();
      const hatchingState = useHatchingStore.getState();
      const ruleState = useRuleStore.getState();
      const globalConfigState = useGlobalConfigStore.getState();

      // Strip large data URIs from tokens to avoid blowing up localStorage
      const strippedTokens = sessionState.tokens.map(t => {
        const stripped = { ...t };
        if (stripped.imageUrl && stripped.imageUrl.startsWith('data:')) {
          stripped.imageUrl = ''; // Keep imageHash for recovery from IndexedDB
        }
        return stripped;
      });

      // Strip large data URIs from regions
      const strippedRegions = regionState.regions.map(r => {
        const stripped = { ...r };
        if (stripped.backgroundImage && stripped.backgroundImage.startsWith('data:')) {
          stripped.backgroundImage = ''; // Keep textureHash for recovery
        }
        return stripped;
      });

      const projectData: ProjectData = {
        metadata: {
          id: 'autosave',
          name: 'Auto-saved Session',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          version: '1.0.0',
        },
        tokens: strippedTokens,
        players: sessionState.players,
        maps: mapState.maps,
        regions: strippedRegions,
        groups: groupState.groups,
        viewport: { x: 0, y: 0, zoom: 1 },
        settings: {
          gridSnappingEnabled: true,
          tokenVisibility: sessionState.tokenVisibility,
          labelVisibility: sessionState.labelVisibility,
          gridColor: '#000000',
          backgroundColor: '#ffffff',
          defaultGridSize: 50,
        },
        initiative: {
          isInCombat: initiativeState.isInCombat,
          currentTurnIndex: initiativeState.currentTurnIndex,
          roundNumber: initiativeState.roundNumber,
          initiativeOrder: initiativeState.initiativeOrder,
          restrictMovement: initiativeState.restrictMovement,
        },
        roles: roleState.roles,
        visionProfiles: visionProfileState.profiles,
        fogData: {
          // Legacy fields from default-map for backwards compatibility
          ...(fogState.fogSettingsPerMap['default-map'] || {}),
          serializedExploredAreas: fogState.serializedExploredAreas,
          serializedExploredAreasPerMap: fogState.serializedExploredAreasPerMap,
          fogVersion: fogState.fogVersion,
          realtimeVisionDuringDrag: fogState.realtimeVisionDuringDrag,
          realtimeVisionThrottleMs: fogState.realtimeVisionThrottleMs,
          fogSettingsPerMap: fogState.fogSettingsPerMap,
        },
        // lights field removed — use illumination block below
        cardStates: cardState.cards,
        dungeonData: {
          doors: dungeonState.doors,
          importedWallSegments: dungeonState.importedWallSegments,
          lightSources: dungeonState.lightSources,
          renderingMode: dungeonState.renderingMode,
          watabouStyle: dungeonState.watabouStyle,
          wallEdgeStyle: dungeonState.wallEdgeStyle,
          wallThickness: dungeonState.wallThickness,
          textureScale: dungeonState.textureScale,
          lightDirection: dungeonState.lightDirection,
          shadowDistance: dungeonState.shadowDistance,
        },
        mapObjects: mapObjectState.mapObjects,
        illumination: {
          lights: illuminationState.lights,
          globalAmbientLight: illuminationState.globalAmbientLight,
        },
        creatures: {
          characters: creatureState.characters,
          monsters: creatureState.monsters,
        },
        hatching: {
          enabled: hatchingState.enabled,
          hatchingOptions: hatchingState.hatchingOptions,
        },
        rulesEngine: {
          vocabularyCategories: globalConfigState.categories,
          pipelines: ruleState.pipelines,
        },
        viewportTransforms: sessionState.viewportTransforms,
      };

      const serialized = serializeProject(projectData);
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(serialized.data));
      
      this.lastSaveTime = Date.now();
      localStorage.setItem(AUTO_SAVE_TIMESTAMP_KEY, this.lastSaveTime.toString());
      
      this.hasChanges = false;
      this.notifyListeners();
      
      console.log('Auto-save completed successfully');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('Auto-save quota exceeded – disabling auto-save to prevent repeated failures. Free up storage via the Storage Manager.');
        this.stop();
      } else {
        console.error('Auto-save failed:', error);
      }
    }
  }

  start(): void {
    if (this.intervalId) return;

    this.settings.enabled = true;
    this.saveSettings();

    // Set up interval for periodic saves
    const intervalMs = this.settings.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      if (this.hasChanges) {
        this.performSave();
      }
    }, intervalMs);

    this.notifyListeners();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
    }

    this.settings.enabled = false;
    this.saveSettings();
    this.notifyListeners();
  }

  setInterval(minutes: number): void {
    this.settings.intervalMinutes = minutes;
    this.saveSettings();

    // Restart with new interval if currently running
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  getSettings(): AutoSaveSettings {
    return { ...this.settings };
  }

  getLastSaveTime(): number {
    return this.lastSaveTime;
  }

  hasAutoSave(): boolean {
    try {
      return localStorage.getItem(AUTO_SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  loadAutoSave(): ProjectData | null {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // New format: stores raw ProjectData directly.
      // Old format (pre-0.2.9): stored a SerializedProject { version, data: ProjectData }.
      // Handle both so existing autosaves don't break on upgrade.
      if (parsed && parsed.version && parsed.data && parsed.data.tokens !== undefined) {
        return parsed.data as ProjectData;
      }
      return parsed as ProjectData;
    } catch (error) {
      console.error('Failed to load auto-save:', error);
      return null;
    }
  }

  clearAutoSave(): void {
    try {
      localStorage.removeItem(AUTO_SAVE_KEY);
      localStorage.removeItem(AUTO_SAVE_TIMESTAMP_KEY);
      this.lastSaveTime = 0;
      this.hasChanges = false;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to clear auto-save:', error);
    }
  }

  getAutoSaveSize(): number {
    try {
      const data = localStorage.getItem(AUTO_SAVE_KEY);
      if (!data) return 0;
      return new Blob([data]).size / 1024; // Return size in KB
    } catch (error) {
      console.error('Failed to get auto-save size:', error);
      return 0;
    }
  }

  clearOldAutoSaves(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    try {
      const lastSave = this.getLastSaveTime();
      const now = Date.now();
      
      if (lastSave > 0 && (now - lastSave) > maxAgeMs) {
        this.clearAutoSave();
        console.log('Cleared old auto-save data');
      }
    } catch (error) {
      console.error('Failed to clear old auto-saves:', error);
    }
  }

  forceAutoSave(): void {
    this.hasChanges = true;
    this.performSave();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Singleton instance
export const autoSaveManager = new AutoSaveManager();
