import React, { useState, useRef } from 'react';
import { APP_VERSION } from '@/lib/version';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Play,
  FilePlus,
  FolderOpen,
  Save,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { useRegionStore } from '@/stores/regionStore';
import { useGroupStore } from '@/stores/groupStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useRoleStore } from '@/stores/roleStore';
import { useVisionProfileStore } from '@/stores/visionProfileStore';
import { useFogStore } from '@/stores/fogStore';
import { useLightStore } from '@/stores/lightStore';
import { useCardStore } from '@/stores/cardStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useIlluminationStore } from '@/stores/illuminationStore';
import { useCreatureStore } from '@/stores/creatureStore';
import { useHatchingStore } from '@/stores/hatchingStore';
import { useEffectStore } from '@/stores/effectStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import {
  createProjectMetadata,
  exportProjectToFile,
  importProjectFromFile,
  ProjectData,
} from '@/lib/projectSerializer';

interface LandingScreenProps {
  onLaunch: () => void;
  hasSession: boolean;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onLaunch, hasSession }) => {
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [pendingLoadData, setPendingLoadData] = useState<ProjectData | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store hooks
  const sessionStore = useSessionStore();
  const mapStore = useMapStore();
  const regionStore = useRegionStore();
  const groupStore = useGroupStore();
  const initiativeStore = useInitiativeStore();
  const roleStore = useRoleStore();
  const visionProfileStore = useVisionProfileStore();
  const fogStore = useFogStore();
  const lightStore = useLightStore();
  const cardStore = useCardStore();
  const dungeonStore = useDungeonStore();
  const mapObjectStore = useMapObjectStore();
  const illuminationStore = useIlluminationStore();
  const creatureStore = useCreatureStore();
  const hatchingStore = useHatchingStore();
  const effectStore = useEffectStore();
  const uiModeStore = useUiModeStore();

  // --- Session helpers ---
  const createCurrentProjectData = (): ProjectData => ({
    metadata: createProjectMetadata(`Session-${Date.now()}`),
    tokens: sessionStore.tokens,
    players: sessionStore.players,
    maps: mapStore.maps,
    regions: regionStore.regions,
    groups: groupStore.groups,
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: {
      gridSnappingEnabled: false,
      tokenVisibility: sessionStore.tokenVisibility,
      labelVisibility: sessionStore.labelVisibility,
      gridColor: '#333333',
      backgroundColor: '#1a1a1a',
      defaultGridSize: 50,
    },
    initiative: {
      isInCombat: initiativeStore.isInCombat,
      currentTurnIndex: initiativeStore.currentTurnIndex,
      roundNumber: initiativeStore.roundNumber,
      initiativeOrder: initiativeStore.initiativeOrder,
      restrictMovement: initiativeStore.restrictMovement,
    },
    roles: roleStore.roles,
    visionProfiles: visionProfileStore.profiles,
    fogData: {
      ...(fogStore.fogSettingsPerMap['default-map'] || {}),
      serializedExploredAreas: fogStore.serializedExploredAreas,
      serializedExploredAreasPerMap: fogStore.serializedExploredAreasPerMap,
      fogVersion: fogStore.fogVersion,
      realtimeVisionDuringDrag: fogStore.realtimeVisionDuringDrag,
      realtimeVisionThrottleMs: fogStore.realtimeVisionThrottleMs,
      fogSettingsPerMap: fogStore.fogSettingsPerMap,
    },
    lights: lightStore.lights,
    cardStates: cardStore.cards,
    dungeonData: {
      doors: dungeonStore.doors,
      importedWallSegments: dungeonStore.importedWallSegments,
      lightSources: dungeonStore.lightSources,
      renderingMode: dungeonStore.renderingMode,
      watabouStyle: dungeonStore.watabouStyle,
      wallEdgeStyle: dungeonStore.wallEdgeStyle,
      wallThickness: dungeonStore.wallThickness,
      textureScale: dungeonStore.textureScale,
      lightDirection: dungeonStore.lightDirection,
      shadowDistance: dungeonStore.shadowDistance,
      enforceMovementBlocking: dungeonStore.enforceMovementBlocking,
      enforceRegionBounds: dungeonStore.enforceRegionBounds,
    },
    mapObjects: mapObjectStore.mapObjects,
    illumination: {
      lights: illuminationStore.lights,
      globalAmbientLight: illuminationStore.globalAmbientLight,
    },
    creatures: {
      characters: creatureStore.characters,
      monsters: creatureStore.monsters,
    },
    hatching: {
      enabled: hatchingStore.enabled,
      hatchingOptions: hatchingStore.hatchingOptions,
    },
    viewportTransforms: sessionStore.viewportTransforms,
    effects: {
      placedEffects: effectStore.placedEffects,
      customTemplates: effectStore.customTemplates,
    },
    uiMode: uiModeStore.currentMode === 'dm' ? 'dm' : 'play',
  });

  const clearAllStores = () => {
    sessionStore.clearAllTokens();
    sessionStore.setTokens([]);
    mapStore.maps.forEach(m => mapStore.removeMap(m.id));
    regionStore.regions.forEach(r => regionStore.removeRegion(r.id));
    groupStore.clearAllGroups();
    initiativeStore.endCombat();
    lightStore.clearAllLights();
    // Clear fog to defaults so imported settings take effect cleanly
    fogStore.resetFog();
    // Clear effects
    const effectMapIds = new Set(effectStore.placedEffects.map(e => e.mapId));
    effectMapIds.forEach(id => effectStore.clearEffectsForMap(id));
  };

  // --- New Session ---
  const handleNewSession = () => {
    if (hasSession) {
      setShowNewConfirm(true);
    } else {
      doNewSession();
    }
  };

  const doNewSession = () => {
    try {
      clearAllStores();
      toast.success('New session started');
      onLaunch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to start new session');
    }
  };

  // --- Save Session ---
  const handleSaveSession = async () => {
    if (!hasSession) {
      toast.error('No active session to save');
      return;
    }
    setIsSaving(true);
    try {
      const data = createCurrentProjectData();
      await exportProjectToFile(data, `session-${Date.now()}.mhsession`);
      toast.success('Session saved to disk');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Load Session ---
  const handleLoadSession = () => {
    if (hasSession) {
      // Show confirm first, then open file picker after confirm
      setShowLoadConfirm(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsLoading(true);
    try {
      const data = await importProjectFromFile(file);
      setPendingLoadData(data);
      if (!hasSession) {
        // No existing session — apply immediately
        await applyAndLaunch(data);
      }
      // If hasSession, we already confirmed above; apply now
    } catch (err) {
      console.error(err);
      toast.error('Failed to load session file');
    } finally {
      setIsLoading(false);
    }
  };

  const applyAndLaunch = async (data: ProjectData) => {
    try {
      clearAllStores();

      // Core entities
      if (data.tokens) sessionStore.setTokens(data.tokens);
      if (data.maps) data.maps.forEach(m => mapStore.addMap(m));
      if (data.regions) data.regions.forEach(r => regionStore.addRegion(r));
      if (data.groups) data.groups.forEach(g => useGroupStore.getState().restoreGroup(g));
      if (data.mapObjects) useMapObjectStore.getState().setMapObjects(data.mapObjects);
      if (data.lights) lightStore.setLights(data.lights);

      // Roles & vision profiles
      if (data.roles) {
        roleStore.clearRoles();
        data.roles.forEach(r => roleStore.addRole(r));
      }
      if (data.visionProfiles) {
        useVisionProfileStore.getState().clearProfiles();
        data.visionProfiles.forEach(vp => useVisionProfileStore.getState().addProfile(vp));
      }

      // Initiative
      if (data.initiative) {
        const initStore = useInitiativeStore.getState();
        initStore.setInitiativeOrder(data.initiative.initiativeOrder || []);
        if (data.initiative.isInCombat) {
          initStore.startCombat();
          initStore.setCurrentTurn(data.initiative.currentTurnIndex || 0);
        }
        initStore.setRestrictMovement(data.initiative.restrictMovement ?? false);
      }

      // Fog of war
      if (data.fogData) {
        const fs = useFogStore.getState();
        if (data.fogData.fogSettingsPerMap) {
          Object.entries(data.fogData.fogSettingsPerMap).forEach(([mapId, settings]) => {
            fs.setMapFogSettings(mapId, settings);
          });
        }
        if (data.fogData.serializedExploredAreas) {
          fs.setSerializedExploredAreas(data.fogData.serializedExploredAreas);
        }
        if (data.fogData.serializedExploredAreasPerMap) {
          Object.entries(data.fogData.serializedExploredAreasPerMap).forEach(([mapId, serialized]) => {
            fs.setSerializedExploredAreasForMap(mapId, serialized);
          });
        }
        if (data.fogData.realtimeVisionDuringDrag !== undefined) {
          fs.setRealtimeVisionDuringDrag(data.fogData.realtimeVisionDuringDrag);
        }
        if (data.fogData.realtimeVisionThrottleMs !== undefined) {
          fs.setRealtimeVisionThrottleMs(data.fogData.realtimeVisionThrottleMs);
        }
      }

      // Dungeon data
      if (data.dungeonData) {
        const ds = useDungeonStore.getState();
        if (data.dungeonData.doors) ds.setDoors(data.dungeonData.doors);
        if (data.dungeonData.importedWallSegments) ds.setImportedWallSegments(data.dungeonData.importedWallSegments);
        if (data.dungeonData.lightSources) ds.setLightSources(data.dungeonData.lightSources);
        if (data.dungeonData.renderingMode) ds.setRenderingMode(data.dungeonData.renderingMode);
        if (data.dungeonData.watabouStyle) ds.setWatabouStyle(data.dungeonData.watabouStyle);
        if (data.dungeonData.wallEdgeStyle) ds.setWallEdgeStyle(data.dungeonData.wallEdgeStyle);
        if (data.dungeonData.wallThickness !== undefined) ds.setWallThickness(data.dungeonData.wallThickness);
        if (data.dungeonData.textureScale !== undefined) ds.setTextureScale(data.dungeonData.textureScale);
        if (data.dungeonData.lightDirection !== undefined) ds.setLightDirection(data.dungeonData.lightDirection);
        if (data.dungeonData.shadowDistance !== undefined) ds.setShadowDistance(data.dungeonData.shadowDistance);
        if (data.dungeonData.enforceMovementBlocking !== undefined) ds.setEnforceMovementBlocking(data.dungeonData.enforceMovementBlocking);
        if (data.dungeonData.enforceRegionBounds !== undefined) ds.setEnforceRegionBounds(data.dungeonData.enforceRegionBounds);
      }

      // Illumination (unified system)
      if (data.illumination) {
        const illumStore = useIlluminationStore.getState();
        illumStore.setLights(data.illumination.lights || []);
        if (data.illumination.globalAmbientLight !== undefined) {
          illumStore.setGlobalAmbientLight(data.illumination.globalAmbientLight);
        }
      }

      // Creatures (characters & monsters)
      if (data.creatures) {
        const cs = useCreatureStore.getState();
        if (data.creatures.characters) {
          data.creatures.characters.forEach(c => cs.addCharacter(c));
        }
        if (data.creatures.monsters) {
          cs.addMonsters(data.creatures.monsters);
        }
      }

      // Hatching settings
      if (data.hatching) {
        const hs = useHatchingStore.getState();
        hs.setEnabled(data.hatching.enabled);
        if (data.hatching.hatchingOptions) hs.setOptions(data.hatching.hatchingOptions);
      }

      // Viewport transforms
      if (data.viewportTransforms) {
        Object.entries(data.viewportTransforms).forEach(([mapId, transform]) => {
          useSessionStore.getState().setViewportTransform(mapId, transform);
        });
      }

      // Settings
      if (data.settings) {
        if (data.settings.tokenVisibility) sessionStore.setTokenVisibility(data.settings.tokenVisibility);
        if (data.settings.labelVisibility) sessionStore.setLabelVisibility(data.settings.labelVisibility);
      }

      toast.success('Session loaded');
      onLaunch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply session data');
    }
  };

  const confirmLoad = async () => {
    setShowLoadConfirm(false);
    // Open file picker after confirmation
    if (!pendingLoadData) {
      fileInputRef.current?.click();
    } else {
      await applyAndLaunch(pendingLoadData);
      setPendingLoadData(null);
    }
  };

  const menuItems = [
    {
      id: 'continue',
      label: 'Continue',
      description: hasSession ? 'Resume your current session' : 'No active session in memory',
      icon: Play,
      disabled: !hasSession,
      active: hasSession,
      onClick: onLaunch,
    },
    {
      id: 'new',
      label: 'New Session',
      description: 'Start a fresh tabletop session',
      icon: FilePlus,
      disabled: false,
      active: false,
      onClick: handleNewSession,
    },
    {
      id: 'load',
      label: 'Load Session',
      description: 'Load a session from a .mhsession file',
      icon: FolderOpen,
      disabled: isLoading,
      active: false,
      onClick: handleLoadSession,
    },
    {
      id: 'save',
      label: 'Save Session',
      description: hasSession ? 'Save current session to disk' : 'No active session to save',
      icon: Save,
      disabled: !hasSession || isSaving,
      active: false,
      onClick: handleSaveSession,
    },
    {
      id: 'about',
      label: 'About',
      description: 'Application information',
      icon: Info,
      disabled: false,
      active: false,
      onClick: () => setShowAbout(true),
    },
  ];

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-6 space-y-8">
        {/* Title block */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Magehand</h1>
          <p className="text-sm text-muted-foreground">The application is paused.</p>
          <p className="text-xs text-muted-foreground/50 font-mono">v{APP_VERSION}</p>
        </div>

        {/* Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                disabled={item.disabled}
                className={[
                  'w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-150 text-left group',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-accent cursor-pointer',
                  item.active && !item.disabled
                    ? 'border border-green-500/40 bg-green-500/10 hover:bg-green-500/20'
                    : 'border border-transparent',
                ].join(' ')}
              >
                <div className={[
                  'flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center',
                  item.active && !item.disabled
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted text-muted-foreground group-hover:text-foreground',
                ].join(' ')}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={[
                    'text-sm font-medium',
                    item.active && !item.disabled ? 'text-green-400' : 'text-foreground',
                  ].join(' ')}>
                    {item.label}
                    {item.id === 'save' && isSaving && ' …'}
                    {item.id === 'load' && isLoading && ' …'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
                {!item.disabled && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mhsession,.json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* New Session confirmation */}
      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a New Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session in memory. Starting a new session will clear all current data.
              Make sure to save your session first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doNewSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Start New Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Load Session confirmation (when session exists) */}
      <AlertDialog open={showLoadConfirm && !pendingLoadData} onOpenChange={(open) => {
        if (!open) setShowLoadConfirm(false);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load a Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session in memory. Loading a new session will replace all current data.
              Save your session first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLoadConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoad}>
              Continue &amp; Select File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* About modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
          <DialogTitle className="text-xl font-bold">About Magehand</DialogTitle>
            <DialogDescription>Tabletop virtual game table</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-foreground font-medium">Version</span>
              <span className="font-mono">{APP_VERSION}</span>
              <span className="text-foreground font-medium">Format</span>
              <span className="font-mono">.mhsession</span>
              <span className="text-foreground font-medium">Platform</span>
              <span>Web (React + PixiJS)</span>
            </div>
            <p className="text-xs text-muted-foreground/70 border-t border-border pt-3">
              Magehand is a browser-based virtual tabletop application supporting fog of war, token management,
              initiative tracking, vision profiles, and multi-layer maps.
            </p>
            <p className="text-xs text-muted-foreground/50">
              Session files are stored locally in your browser. Use Save Session to export a portable file.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
