

# Per-Map Fog Settings

## Overview

Transition the fog of war system from a single global settings store to per-map fog configurations. Each map gets its own independent fog settings (enabled, opacity, vision range, GPU effects, etc.). The Fog Control Card targets whichever map currently has focus. The Map Tree gains buttons to open fog controls for any map and for entire structures.

## Architecture

### Current State
- `fogStore` holds one global set of fog settings (enabled, fogOpacity, exploredOpacity, visionRange, effectSettings, etc.)
- `FogControlCard` reads/writes directly from this single store
- `SimpleTabletop` uses `fogEnabled` from the global store for all ~20+ rendering checks

### New State
- Fog settings move into a `Record<string, MapFogSettings>` keyed by `mapId`
- A new `MapFogSettings` interface holds per-map copies of all configurable fog fields
- The global store retains helper actions and the `serializedExploredAreasPerMap` data
- `SimpleTabletop` derives `currentMapFogSettings` from the focused map's entry
- New sessions create a default entry for the initial `'default-map'`

## Technical Details

### 1. fogStore.ts - Per-Map Settings Record

Add a new interface and restructure the store:

```text
interface MapFogSettings {
  enabled: boolean
  revealAll: boolean
  visionRange: number         // 1-50
  fogOpacity: number          // 0-1
  exploredOpacity: number     // 0-1
  showExploredAreas: boolean
  effectSettings: FogEffectSettings
}
```

Replace the flat fields (`enabled`, `revealAll`, `visionRange`, `fogOpacity`, `exploredOpacity`, `showExploredAreas`, `effectSettings`) with:

```text
fogSettingsPerMap: Record<string, MapFogSettings>
```

Add actions:
- `getMapFogSettings(mapId: string): MapFogSettings` -- returns settings for a map, falling back to defaults
- `setMapFogSettings(mapId: string, updates: Partial<MapFogSettings>)` -- partial update for one map
- `initMapFogSettings(mapId: string)` -- creates a default entry if none exists
- `removeMapFogSettings(mapId: string)` -- cleanup when a map is deleted
- `setStructureFogSettings(structureId: string, updates: Partial<MapFogSettings>)` -- applies settings to all maps in a structure (requires reading mapStore to find member maps)

Keep existing fields that remain global:
- `serializedExploredAreasPerMap` (already per-map)
- `realtimeVisionDuringDrag`, `realtimeVisionThrottleMs` (local-only feature flags)
- `fogVersion`

Legacy migration in `onRehydrateStorage`:
- If `fogSettingsPerMap` is empty/missing but old flat fields exist, migrate them into a `'default-map'` entry
- Preserve existing `serializedExploredAreasPerMap` migration

Update `partialize` to persist `fogSettingsPerMap` instead of the old flat fields.

Update `resetFog` to clear `fogSettingsPerMap` to `{}`.

Update `clearExploredAreas` -- unchanged (already per-map).

### 2. defaultFogEffectSettings.ts - Add Default MapFogSettings

Export a `DEFAULT_MAP_FOG_SETTINGS` constant:

```text
export const DEFAULT_MAP_FOG_SETTINGS: MapFogSettings = {
  enabled: false,
  revealAll: false,
  visionRange: 6,
  fogOpacity: 0.95,
  exploredOpacity: 0.4,
  showExploredAreas: true,
  effectSettings: DEFAULT_FOG_EFFECT_SETTINGS,
}
```

### 3. SimpleTabletop.tsx - Derive Per-Map Fog State

Replace the current destructured fog fields with a derived memo:

```text
const currentMapFog = useMemo(() => {
  return getMapFogSettings(selectedMapId || 'default-map');
}, [fogSettingsPerMap, selectedMapId]);

const fogEnabled = currentMapFog.enabled;
const fogRevealAll = currentMapFog.revealAll;
const fogVisionRange = currentMapFog.visionRange;
const fogOpacity = currentMapFog.fogOpacity;
const exploredOpacity = currentMapFog.exploredOpacity;
const effectSettings = currentMapFog.effectSettings;
```

By re-assigning to the same local variable names (`fogEnabled`, `fogOpacity`, etc.), the ~20+ downstream references require **zero changes** -- they continue to work as before but now pull from the focused map's settings.

Update the `setFogEnabled` / `setFogRevealAll` callbacks to use `setMapFogSettings(selectedMapId, { enabled: ... })` instead of the old global setters.

### 4. FogControlCard.tsx - Target Focused Map (or Specified Map)

Accept an optional `targetMapId` prop. When provided, the card controls that map's fog settings instead of the focused map. This enables opening fog controls for inactive maps from the Map Tree.

```text
interface FogControlCardContentProps {
  targetMapId?: string;      // If provided, controls this map
  targetLabel?: string;      // Display label (e.g. "Dungeon B1")
  isStructureMode?: boolean; // If true, applies to all maps in a structure
  structureId?: string;      // The structure to target
}
```

The card reads settings via `getMapFogSettings(effectiveMapId)` and writes via `setMapFogSettings(effectiveMapId, ...)`. In structure mode, it uses `setStructureFogSettings(structureId, ...)`.

Show a header badge indicating which map/structure is being configured.

### 5. MapTreeCard.tsx - Fog Buttons

**Per-map fog button**: Add a Cloud/CloudOff icon button to each map header row (near the active toggle). Clicking it opens a new Fog Control card instance targeting that specific map. Uses the card store's `openCard` with metadata `{ targetMapId, targetLabel }`.

**Structure fog button**: Add a Cloud icon button to each structure header row. Clicking it opens a Fog Control card in structure mode with metadata `{ isStructureMode: true, structureId, targetLabel }`.

Import `Cloud, CloudOff` from lucide-react.

### 6. CardManager.tsx / Card System - Support Targeted Fog Cards

When rendering a `CardType.FOG` card, pass `metadata.targetMapId`, `metadata.targetLabel`, `metadata.isStructureMode`, and `metadata.structureId` as props to `FogControlCardContent`.

Multiple fog cards can be open simultaneously (one per map/structure). The card title dynamically shows "Fog Control - {mapName}" or "Fog Control - {structureName}".

### 7. mapStore.ts - Auto-Init Fog on Map Creation

In `addMap`, after creating the map, call `useFogStore.getState().initMapFogSettings(newMap.id)`.

In `removeMap`, call `useFogStore.getState().removeMapFogSettings(id)` to clean up.

### 8. projectSerializer.ts - Update FogSettings Type

Update `FogSettings` import/usage to include `fogSettingsPerMap` in serialized project data. The old flat fields become optional for backwards compatibility during import.

### 9. version.ts - Bump Version

Increment `APP_VERSION` to `0.5.44`.

## Files Modified

| File | Change |
|------|--------|
| `src/stores/fogStore.ts` | Add `MapFogSettings`, `fogSettingsPerMap` record, per-map actions, migration |
| `src/stores/defaultFogEffectSettings.ts` | Add `DEFAULT_MAP_FOG_SETTINGS` export |
| `src/components/SimpleTabletop.tsx` | Derive per-map fog state via memo, keep same variable names |
| `src/components/cards/FogControlCard.tsx` | Accept `targetMapId`/structure props, read/write per-map settings |
| `src/components/cards/MapTreeCard.tsx` | Add Cloud button per map row and per structure header |
| `src/components/CardManager.tsx` | Pass fog card metadata as props to FogControlCardContent |
| `src/stores/mapStore.ts` | Call fogStore init/cleanup in addMap/removeMap |
| `src/lib/projectSerializer.ts` | Update FogSettings type for per-map data |
| `src/lib/version.ts` | Bump to 0.5.44 |

## Edge Cases

- **New session**: Default map gets `initMapFogSettings('default-map')` with fog disabled
- **Legacy projects**: `onRehydrateStorage` migrates old flat fields to `fogSettingsPerMap['default-map']`
- **Map deletion**: Fog settings and explored areas for that map are cleaned up
- **Map duplication**: `handleDuplicateMap` in MapTreeCard copies the source map's fog settings to the new map
- **Networking**: `fogSettingsPerMap` syncs via the existing `syncPatch` middleware on the fog channel
- **Structure mode**: Applies identical settings to all member maps; individual maps can still be overridden afterwards

