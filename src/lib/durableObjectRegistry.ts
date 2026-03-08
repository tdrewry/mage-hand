/**
 * Durable Object Registry — wires all durable stores to the DO export/import system.
 * 
 * Each registration defines:
 *   - kind: unique key for the DO
 *   - version: schema version (for future migrations)
 *   - label: human-readable name
 *   - extractor: pulls serializable state from the store
 *   - hydrator: restores state into the store
 *   - summarizer: optional count string for the manifest UI
 */

import { DurableObjectRegistry } from './durableObjects';
import { computeScaledTemplate } from '@/types/effectTypes';
import { getBuiltInTemplate } from '@/lib/effectTemplateLibrary';
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
import { useDiceStore } from '@/stores/diceStore';
import { useActionStore } from '@/stores/actionStore';
import { useEffectStore } from '@/stores/effectStore';
import { useMapFocusStore } from '@/stores/mapFocusStore';

// ── Tokens ─────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'tokens',
  version: 1,
  label: 'Tokens',
  extractor: () => {
    const s = useSessionStore.getState();
    return {
      tokens: s.tokens.map(t => ({ ...t, imageUrl: '' })), // strip large image data
      players: s.players,
      tokenVisibility: s.tokenVisibility,
      labelVisibility: s.labelVisibility,
    };
  },
  hydrator: (state: any) => {
    const store = useSessionStore.getState();
    // Clear existing
    store.tokens.forEach(t => store.removeToken(t.id));
    // Add imported
    (state.tokens || []).forEach((t: any) => store.addToken(t));
    (state.players || []).forEach((p: any) => store.addPlayer(p));
    if (state.tokenVisibility) store.setTokenVisibility(state.tokenVisibility);
    if (state.labelVisibility) store.setLabelVisibility(state.labelVisibility);
  },
  summarizer: () => `${useSessionStore.getState().tokens.length} tokens`,
});

// ── Maps ───────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'maps',
  version: 2,
  label: 'Maps',
  authoritative: true, // DM is the source of truth for map activation/structure
  extractor: () => ({
    maps: useMapStore.getState().maps.map(m => ({ ...m, imageUrl: '' })),
    structures: useMapStore.getState().structures,
    selectedMapId: useMapStore.getState().selectedMapId,
  }),
  hydrator: (state: any) => {
    const store = useMapStore.getState();
    store.maps.forEach(m => store.removeMap(m.id));

    const mapsArr = state?.maps || state || []; // v2 has { maps, structures }, v1 has just array
    mapsArr.forEach((m: any) => {
      store.restoreMap({ ...m, regions: m.regions || [] });
    });

    // Restore structures if present (v2+)
    if (state?.structures && Array.isArray(state.structures)) {
      useMapStore.setState({ structures: state.structures });
    }

    // For non-creator clients: follow the DM's selected map
    if (state?.selectedMapId) {
      const mapExists = mapsArr.some((m: any) => m.id === state.selectedMapId);
      if (mapExists) {
        store.setSelectedMap(state.selectedMapId);
      }
    }

    // Select the first active map if no valid selection
    const currentSelected = useMapStore.getState().selectedMapId;
    const activeMap = mapsArr.find((m: any) => m.active);
    if (!currentSelected || !mapsArr.some((m: any) => m.id === currentSelected)) {
      if (activeMap) store.setSelectedMap(activeMap.id);
      else if (mapsArr.length > 0) store.setSelectedMap(mapsArr[0].id);
    }
  },
  summarizer: () => `${useMapStore.getState().maps.length} maps`,
});

// ── Regions ────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'regions',
  version: 1,
  label: 'Regions',
  extractor: () => useRegionStore.getState().regions,
  hydrator: (state: any) => {
    const store = useRegionStore.getState();
    store.clearRegions();
    (state || []).forEach((r: any) => store.addRegion(r));
  },
  summarizer: () => `${useRegionStore.getState().regions.length} regions`,
});

// ── Groups ─────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'groups',
  version: 1,
  label: 'Groups',
  extractor: () => useGroupStore.getState().groups,
  hydrator: (state: any) => {
    const store = useGroupStore.getState();
    store.clearAllGroups();
    (state || []).forEach((g: any) => {
      const members = g.members || (g.tokenIds || []).map((id: string) => ({ id, type: 'token' }));
      store.restoreGroup({
        id: g.id, name: g.name, members,
        pivot: g.pivot ?? { x: 0, y: 0 },
        bounds: g.bounds ?? { x: 0, y: 0, width: 0, height: 0 },
        locked: g.locked ?? false, visible: g.visible ?? true,
      });
    });
  },
  summarizer: () => `${useGroupStore.getState().groups.length} groups`,
});

// ── Initiative ─────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'initiative',
  version: 1,
  label: 'Initiative',
  extractor: () => {
    const s = useInitiativeStore.getState();
    return {
      isInCombat: s.isInCombat,
      currentTurnIndex: s.currentTurnIndex,
      roundNumber: s.roundNumber,
      initiativeOrder: s.initiativeOrder,
      restrictMovement: s.restrictMovement,
    };
  },
  hydrator: (state: any) => {
    const store = useInitiativeStore.getState();
    store.endCombat();
    if (state?.initiativeOrder) {
      store.setInitiativeOrder(state.initiativeOrder);
    }
    if (state?.isInCombat) {
      store.startCombat();
      for (let i = 0; i < (state.currentTurnIndex || 0); i++) store.nextTurn();
    }
    if (state?.restrictMovement !== undefined) store.setRestrictMovement(state.restrictMovement);
  },
  summarizer: () => {
    const s = useInitiativeStore.getState();
    return s.isInCombat ? `${s.initiativeOrder.length} entries, round ${s.roundNumber}` : 'not in combat';
  },
});

// ── Roles ──────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'roles',
  version: 1,
  label: 'Roles',
  extractor: () => useRoleStore.getState().roles,
  hydrator: (state: any) => {
    const store = useRoleStore.getState();
    store.roles.forEach(r => store.removeRole(r.id));
    (state || []).forEach((r: any) => store.addRole(r));
  },
  summarizer: () => `${useRoleStore.getState().roles.length} roles`,
});

// ── Vision Profiles ────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'visionProfiles',
  version: 1,
  label: 'Vision Profiles',
  extractor: () => useVisionProfileStore.getState().profiles,
  hydrator: (state: any) => {
    const store = useVisionProfileStore.getState();
    store.clearProfiles();
    (state || []).forEach((p: any) => store.addProfile(p));
  },
  summarizer: () => `${useVisionProfileStore.getState().profiles.length} profiles`,
});

// ── Fog of War ─────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'fog',
  version: 1,
  label: 'Fog of War',
  authoritative: true,
  extractor: () => {
    const s = useFogStore.getState();
    return {
      fogSettingsPerMap: s.fogSettingsPerMap,
      serializedExploredAreas: s.serializedExploredAreas,
      serializedExploredAreasPerMap: s.serializedExploredAreasPerMap,
      fogVersion: s.fogVersion,
      realtimeVisionDuringDrag: s.realtimeVisionDuringDrag,
      realtimeVisionThrottleMs: s.realtimeVisionThrottleMs,
    };
  },
  hydrator: (state: any) => {
    if (!state) return;
    const store = useFogStore.getState();

    // Restore per-map fog settings using store actions for proper reactivity
    if (state.fogSettingsPerMap && typeof state.fogSettingsPerMap === 'object') {
      // First, replace the entire fogSettingsPerMap to clear stale entries
      useFogStore.setState({ fogSettingsPerMap: {} });
      for (const [mapId, settings] of Object.entries(state.fogSettingsPerMap)) {
        store.initMapFogSettings(mapId);
        store.setMapFogSettings(mapId, settings as any);
      }
    }

    // Restore explored geometry
    if (state.serializedExploredAreas) {
      store.setSerializedExploredAreas(state.serializedExploredAreas);
    }
    if (state.serializedExploredAreasPerMap) {
      for (const [mapId, data] of Object.entries(state.serializedExploredAreasPerMap)) {
        store.setSerializedExploredAreasForMap(mapId, data as string);
      }
    }

    // Restore global fog fields
    if (state.fogVersion !== undefined) useFogStore.setState({ fogVersion: state.fogVersion });
    if (state.realtimeVisionDuringDrag !== undefined) store.setRealtimeVisionDuringDrag(state.realtimeVisionDuringDrag);
    if (state.realtimeVisionThrottleMs !== undefined) store.setRealtimeVisionThrottleMs(state.realtimeVisionThrottleMs);
  },
  summarizer: () => {
    const maps = Object.keys(useFogStore.getState().fogSettingsPerMap);
    return `${maps.length} map configs`;
  },
});

// ── Legacy Lights ──────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'lights',
  version: 1,
  label: 'Legacy Lights',
  authoritative: true,
  extractor: () => ({
    lights: useLightStore.getState().lights,
    globalAmbientLight: useLightStore.getState().globalAmbientLight,
  }),
  hydrator: (state: any) => {
    const store = useLightStore.getState();
    store.clearAllLights();
    (state?.lights || []).forEach((l: any) => store.addLight(l));
    if (state?.globalAmbientLight !== undefined) store.setGlobalAmbientLight(state.globalAmbientLight);
  },
  summarizer: () => `${useLightStore.getState().lights.length} lights`,
});

// ── Illumination (Unified) ────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'illumination',
  version: 1,
  label: 'Illumination',
  authoritative: true,
  extractor: () => ({
    lights: useIlluminationStore.getState().lights,
    globalAmbientLight: useIlluminationStore.getState().globalAmbientLight,
  }),
  hydrator: (state: any) => {
    const store = useIlluminationStore.getState();
    store.clearAllLights();
    if (state?.lights) store.setLights(state.lights);
    if (state?.globalAmbientLight !== undefined) store.setGlobalAmbientLight(state.globalAmbientLight);
  },
  summarizer: () => `${useIlluminationStore.getState().lights.length} sources`,
});

// ── Cards (UI Layout) ─────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'cards',
  version: 1,
  label: 'UI Card Layout',
  extractor: () => useCardStore.getState().cards,
  hydrator: (state: any) => {
    const store = useCardStore.getState();
    store.cards.forEach(c => store.unregisterCard(c.id));
    (state || []).forEach((card: any) => {
      store.registerCard({
        type: card.type,
        title: '',
        defaultPosition: card.position,
        defaultSize: card.size,
        defaultMinimized: card.isMinimized,
        defaultVisible: card.isVisible,
        hideHeader: card.hideHeader,
        fullCardDraggable: card.fullCardDraggable,
      });
    });
  },
  summarizer: () => `${useCardStore.getState().cards.length} cards`,
});

// ── Dungeon ────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'dungeon',
  version: 1,
  label: 'Dungeon Features',
  authoritative: true,
  extractor: () => {
    const s = useDungeonStore.getState();
    return {
      doors: s.doors,
      importedWallSegments: s.importedWallSegments,
      watabouStyle: s.watabouStyle,
      wallEdgeStyle: s.wallEdgeStyle,
      wallThickness: s.wallThickness,
      textureScale: s.textureScale,
      lightDirection: s.lightDirection,
      shadowDistance: s.shadowDistance,
    };
  },
  hydrator: (state: any) => {
    const store = useDungeonStore.getState();
    store.clearAll();
    if (state?.doors) store.setDoors(state.doors);
    if (state?.importedWallSegments) store.setImportedWallSegments(state.importedWallSegments);
    if (state?.watabouStyle) store.setWatabouStyle(state.watabouStyle);
    if (state?.wallEdgeStyle) store.setWallEdgeStyle(state.wallEdgeStyle);
    if (state?.wallThickness !== undefined) store.setWallThickness(state.wallThickness);
    if (state?.textureScale !== undefined) store.setTextureScale(state.textureScale);
    if (state?.lightDirection !== undefined) store.setLightDirection(state.lightDirection);
    if (state?.shadowDistance !== undefined) store.setShadowDistance(state.shadowDistance);
  },
  summarizer: () => `${useDungeonStore.getState().doors.length} doors`,
});

// ── Map Objects ────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'mapObjects',
  version: 1,
  label: 'Map Objects',
  extractor: () => useMapObjectStore.getState().mapObjects,
  hydrator: (state: any) => {
    const store = useMapObjectStore.getState();
    store.clearMapObjects();
    (state || []).forEach((obj: any) => store.addMapObject(obj));
  },
  summarizer: () => `${useMapObjectStore.getState().mapObjects.length} objects`,
});

// ── Creatures ──────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'creatures',
  version: 1,
  label: 'Creature Library',
  extractor: () => ({
    characters: useCreatureStore.getState().characters,
    monsters: useCreatureStore.getState().monsters,
  }),
  hydrator: (state: any) => {
    const store = useCreatureStore.getState();
    // Clear existing
    store.characters.forEach(c => store.removeCharacter(c.id || ''));
    store.clearMonsters();
    // Add imported
    (state?.characters || []).forEach((c: any) => store.addCharacter(c));
    (state?.monsters || []).forEach((m: any) => store.addMonster(m));
  },
  summarizer: () => {
    const s = useCreatureStore.getState();
    return `${s.characters.length} chars, ${s.monsters.length} monsters`;
  },
});

// ── Hatching ───────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'hatching',
  version: 1,
  label: 'Edge Hatching',
  extractor: () => ({
    enabled: useHatchingStore.getState().enabled,
    hatchingOptions: useHatchingStore.getState().hatchingOptions,
  }),
  hydrator: (state: any) => {
    const store = useHatchingStore.getState();
    if (state?.enabled !== undefined) store.setEnabled(state.enabled);
    if (state?.hatchingOptions) store.setOptions(state.hatchingOptions);
  },
  summarizer: () => useHatchingStore.getState().enabled ? 'enabled' : 'disabled',
});

// ── Dice ───────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'dice',
  version: 1,
  label: 'Dice',
  extractor: () => ({
    rollHistory: useDiceStore.getState().rollHistory,
    pinnedFormulas: useDiceStore.getState().pinnedFormulas,
  }),
  hydrator: (state: any) => {
    const store = useDiceStore.getState();
    store.clearHistory();
    // Pinned formulas: re-add
    (state?.pinnedFormulas || []).forEach((p: any) => store.addPinnedFormula(p.label, p.formula));
  },
  summarizer: () => `${useDiceStore.getState().pinnedFormulas.length} pinned`,
});

// ── Actions ────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'actions',
  version: 1,
  label: 'Action Queue',
  extractor: () => ({
    actionHistory: useActionStore.getState().actionHistory,
  }),
  hydrator: (state: any) => {
    const store = useActionStore.getState();
    store.clearHistory();
    if (state?.actionHistory) {
      store.hydrateQueue(null, [], state.actionHistory);
    }
  },
  summarizer: () => `${useActionStore.getState().actionHistory.length} history entries`,
});

// ── Effects ────────────────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'effects',
  version: 1,
  label: 'Effects',
  extractor: () => {
    const state = useEffectStore.getState();
    // Strip the entire template snapshot from placed effects.
    // Templates are reconstructed from templateId + castLevel on hydration.
    // This keeps the blob well under Jazz's 1MB limit.
    const stripLargeData = (obj: any) => {
      if (!obj) return obj;
      const copy = { ...obj };
      if (copy.texture && copy.texture.length > 200) copy.texture = '';
      if (copy.icon && typeof copy.icon === 'string' && copy.icon.length > 200) copy.icon = '';
      return copy;
    };
    return {
      placedEffects: state.placedEffects.map((e: any) => {
        // Drop the full template snapshot — it's reconstructible
        const { template, ...rest } = e;
        return rest;
      }),
      customTemplates: state.customTemplates.map(stripLargeData),
    };
  },
  hydrator: (state: any) => {
    const store = useEffectStore.getState();
    // Clear placed effects on all maps
    const mapIds = new Set(store.placedEffects.map(e => e.mapId));
    mapIds.forEach(id => store.clearEffectsForMap(id));
    // Re-add custom templates first so they're available for template reconstruction
    (state?.customTemplates || []).forEach((t: any) => {
      store.addCustomTemplate(t);
    });
    // Build a lookup of custom templates by id for reconstruction
    const customById = new Map<string, any>();
    (state?.customTemplates || []).forEach((t: any) => { if (t?.id) customById.set(t.id, t); });
    // Restore placed effects — reconstruct template from templateId + castLevel
    if (state?.placedEffects?.length) {
      const now = performance.now();
      const restored = state.placedEffects
        .filter((e: any) => !e.dismissedAt) // Skip dismissed effects
        .map((e: any) => {
          // Reconstruct template if missing (stripped during sync)
          let template = e.template;
          if (!template && e.templateId) {
            const base = customById.get(e.templateId) ?? getBuiltInTemplate(e.templateId);
            if (base) {
              template = computeScaledTemplate(base, e.castLevel);
            }
          }
          return {
            ...e,
            template: template ?? e.template,
            placedAt: now,
            dismissedAt: undefined,
            ...(e.isAura ? { tokensInsideArea: e.tokensInsideArea ?? [] } : {}),
          };
        })
        .filter((e: any) => e.template); // Drop effects whose template can't be found
      useEffectStore.setState({ placedEffects: restored });
    }
  },
  summarizer: () => {
    const s = useEffectStore.getState();
    return `${s.placedEffects.length} placed, ${s.customTemplates.length} custom templates`;
  },
});

// ── Map Focus Settings ────────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'mapFocus',
  version: 1,
  label: 'Map Focus Settings',
  authoritative: true, // DM controls blur/opacity for all clients
  extractor: () => ({
    unfocusedOpacity: useMapFocusStore.getState().unfocusedOpacity,
    unfocusedBlur: useMapFocusStore.getState().unfocusedBlur,
    selectionLockEnabled: useMapFocusStore.getState().selectionLockEnabled,
  }),
  hydrator: (state: any) => {
    if (!state || typeof state !== 'object') return;
    const store = useMapFocusStore.getState();
    if (state.unfocusedOpacity !== undefined) store.setUnfocusedOpacity(state.unfocusedOpacity);
    if (state.unfocusedBlur !== undefined) store.setUnfocusedBlur(state.unfocusedBlur);
    if (state.selectionLockEnabled !== undefined) store.setSelectionLockEnabled(state.selectionLockEnabled);
  },
});

// ── Viewport Transforms ───────────────────────────────────────────────────
DurableObjectRegistry.register({
  kind: 'viewportTransforms',
  version: 1,
  label: 'Viewport Transforms',
  extractor: () => useSessionStore.getState().viewportTransforms,
  hydrator: (state: any) => {
    if (!state || typeof state !== 'object') return;
    Object.entries(state).forEach(([mapId, transform]: [string, any]) => {
      useSessionStore.getState().setViewportTransform(mapId, transform);
    });
  },
  summarizer: () => `${Object.keys(useSessionStore.getState().viewportTransforms).length} maps`,
});
