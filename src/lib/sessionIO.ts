/**
 * Shared session I/O utilities used by LandingScreen and ProjectManagerCard.
 * Centralises createCurrentProjectData, clearAllStores, and applyProjectData
 * so the two entry-points stay in sync.
 */

import {
  createProjectMetadata,
  ProjectData,
} from '@/lib/projectSerializer';

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
import { useItemStore } from '@/stores/itemStore';
import { useHatchingStore } from '@/stores/hatchingStore';
import { useEffectStore } from '@/stores/effectStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { normalizeImportedTokenGroups, useTokenGroupStore } from '@/stores/tokenGroupStore';
import { useMapFocusStore } from '@/stores/mapFocusStore';
// ---------------------------------------------------------------------------
// createCurrentProjectData — snapshot every store into a serialisable object
// ---------------------------------------------------------------------------

export interface CreateProjectOpts {
  projectName?: string;
  projectDescription?: string;
  authorName?: string;
  viewport?: { x: number; y: number; zoom: number };
}

export function createCurrentProjectData(opts: CreateProjectOpts = {}): ProjectData {
  const sessionStore = useSessionStore.getState();
  const mapStore = useMapStore.getState();
  const regionStore = useRegionStore.getState();
  const groupStore = useGroupStore.getState();
  const initiativeStore = useInitiativeStore.getState();
  const roleStore = useRoleStore.getState();
  const visionProfileStore = useVisionProfileStore.getState();
  const fogStore = useFogStore.getState();
  const lightStore = useLightStore.getState();
  const cardStore = useCardStore.getState();
  const dungeonStore = useDungeonStore.getState();
  const mapObjectStore = useMapObjectStore.getState();
  const illuminationStore = useIlluminationStore.getState();
  const creatureStore = useCreatureStore.getState();
  const hatchingStore = useHatchingStore.getState();
  const effectStore = useEffectStore.getState();
  const uiModeStore = useUiModeStore.getState();
  const campaignStore = useCampaignStore.getState();

  return {
    metadata: createProjectMetadata(
      opts.projectName || `Session-${Date.now()}`,
      opts.projectDescription,
      opts.authorName,
    ),
    tokens: sessionStore.tokens,
    players: sessionStore.players,
    maps: mapStore.maps,
    regions: regionStore.regions,
    groups: groupStore.groups,
    viewport: opts.viewport || { x: 0, y: 0, zoom: 1 },
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
    items: useItemStore.getState().items,
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
    campaigns: {
      campaigns: campaignStore.campaigns,
      activeCampaignId: campaignStore.activeCampaignId,
      activeProgress: campaignStore.activeProgress,
      nodePositions: campaignStore.nodePositions,
    },
    tokenGroups: {
      groups: useTokenGroupStore.getState().groups,
    },
    mapFocus: {
      unfocusedOpacity: useMapFocusStore.getState().unfocusedOpacity,
      unfocusedBlur: useMapFocusStore.getState().unfocusedBlur,
      selectionLockEnabled: useMapFocusStore.getState().selectionLockEnabled,
    },
    mapStructures: mapStore.structures,
    selectedMapId: mapStore.selectedMapId,
    autoFocusFollowsToken: mapStore.autoFocusFollowsToken,
  };
}

// ---------------------------------------------------------------------------
// clearAllStores — reset every store to empty state
// ---------------------------------------------------------------------------

export function clearAllStores(): void {
  const sessionStore = useSessionStore.getState();
  const mapStore = useMapStore.getState();
  const regionStore = useRegionStore.getState();
  const groupStore = useGroupStore.getState();
  const initiativeStore = useInitiativeStore.getState();
  const lightStore = useLightStore.getState();
  const fogStore = useFogStore.getState();
  const effectStore = useEffectStore.getState();

  sessionStore.clearAllTokens();
  sessionStore.setTokens([]);
  mapStore.maps.forEach(m => mapStore.removeMap(m.id));
  regionStore.regions.forEach(r => regionStore.removeRegion(r.id));
  groupStore.clearAllGroups();
  initiativeStore.endCombat();
  lightStore.clearAllLights();
  fogStore.resetFog();

  const effectMapIds = new Set(effectStore.placedEffects.map(e => e.mapId));
  effectMapIds.forEach(id => effectStore.clearEffectsForMap(id));
  useTokenGroupStore.getState().clearAllGroups();
}

// ---------------------------------------------------------------------------
// applyProjectData — hydrate every store from a ProjectData blob
// ---------------------------------------------------------------------------

export function applyProjectData(data: ProjectData): void {
  const sessionStore = useSessionStore.getState();

  // Core entities
  if (data.tokens) sessionStore.setTokens(data.tokens);
  if (data.maps) {
    data.maps.forEach(m => {
      const { regions, ...mapData } = m;
      useMapStore.getState().restoreMap({ ...mapData, regions: regions || [] });
    });
    // Restore structures before selecting a map
    if (data.mapStructures) {
      useMapStore.setState({ structures: data.mapStructures });
    }
    // Restore selected map (prefer saved, fallback to first)
    const targetSelectedId = data.selectedMapId || (data.maps.length > 0 ? data.maps[0].id : null);
    if (targetSelectedId) {
      useMapStore.getState().setSelectedMap(targetSelectedId);
    }
    if (data.autoFocusFollowsToken !== undefined) {
      useMapStore.getState().setAutoFocusFollowsToken(data.autoFocusFollowsToken);
    }
  }
  if (data.regions) data.regions.forEach(r => useRegionStore.getState().addRegion(r));
  if (data.groups) data.groups.forEach(g => useGroupStore.getState().restoreGroup(g));
  if (data.mapObjects) useMapObjectStore.getState().setMapObjects(data.mapObjects);
  if (data.lights) useLightStore.getState().setLights(data.lights);

  // Roles & vision profiles
  if (data.roles) {
    const roleStore = useRoleStore.getState();
    roleStore.clearRoles();
    data.roles.forEach(r => roleStore.addRole(r));
  }
  if (data.visionProfiles) {
    const vps = useVisionProfileStore.getState();
    vps.clearProfiles();
    data.visionProfiles.forEach(vp => vps.addProfile(vp));
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
      useFogStore.setState({ fogSettingsPerMap: {} });
      Object.entries(data.fogData.fogSettingsPerMap).forEach(([mapId, settings]) => {
        fs.initMapFogSettings(mapId);
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

  // Illumination
  if (data.illumination) {
    const illumStore = useIlluminationStore.getState();
    illumStore.setLights(data.illumination.lights || []);
    if (data.illumination.globalAmbientLight !== undefined) {
      illumStore.setGlobalAmbientLight(data.illumination.globalAmbientLight);
    }
  }

  // Creatures
  if (data.creatures) {
    const cs = useCreatureStore.getState();
    if (data.creatures.characters) data.creatures.characters.forEach(c => cs.addCharacter(c));
    if (data.creatures.monsters) cs.addMonsters(data.creatures.monsters);
  }

  // Hatching
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

  // Effects
  if (data.effects) {
    const es = useEffectStore.getState();
    (data.effects.customTemplates || []).forEach((t: any) => es.addCustomTemplate(t));
    if (data.effects.placedEffects?.length) {
      const now = performance.now();
      const restored = data.effects.placedEffects
        .filter((e: any) => !e.dismissedAt)
        .map((e: any) => ({
          ...e,
          placedAt: now,
          dismissedAt: undefined,
          ...(e.isAura ? { tokensInsideArea: e.tokensInsideArea ?? [] } : {}),
        }));
      useEffectStore.setState({ placedEffects: restored });
    }
  }

  // UI mode
  if (data.uiMode) {
    useUiModeStore.getState().setMode(data.uiMode === 'play' ? 'play' : 'dm');
  }

  // Settings
  if (data.settings) {
    if (data.settings.tokenVisibility) sessionStore.setTokenVisibility(data.settings.tokenVisibility);
    if (data.settings.labelVisibility) sessionStore.setLabelVisibility(data.settings.labelVisibility);
  }

  // Campaigns
  if (data.campaigns) {
    const cd = data.campaigns;
    const cs = useCampaignStore.getState();
    // Clear existing
    cs.campaigns.forEach(c => cs.removeCampaign(c.id));
    if (cd.campaigns) cd.campaigns.forEach((c: any) => cs.addCampaign(c));
    if (cd.nodePositions) {
      Object.entries(cd.nodePositions).forEach(([campaignId, positions]: [string, any]) => {
        Object.entries(positions).forEach(([nodeId, pos]: [string, any]) => {
          cs.setNodePosition(campaignId, nodeId, pos);
        });
      });
    }
    if (cd.activeCampaignId) cs.setActiveCampaign(cd.activeCampaignId);
    if (cd.activeProgress) cs.setProgress(cd.activeProgress);
  }

  // Token Groups
  if (data.tokenGroups?.groups) {
    const normalizedGroups = normalizeImportedTokenGroups(data.tokenGroups.groups);
    useTokenGroupStore.setState({ groups: normalizedGroups });
  }

  // Map Focus settings
  if (data.mapFocus) {
    const mf = useMapFocusStore.getState();
    if (data.mapFocus.unfocusedOpacity !== undefined) mf.setUnfocusedOpacity(data.mapFocus.unfocusedOpacity);
    if (data.mapFocus.unfocusedBlur !== undefined) mf.setUnfocusedBlur(data.mapFocus.unfocusedBlur);
    if (data.mapFocus.selectionLockEnabled !== undefined) mf.setSelectionLockEnabled(data.mapFocus.selectionLockEnabled);
  }
}
