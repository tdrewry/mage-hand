# Per-Map Fog of War Explored Areas

## Problem
Currently, all maps share a single `exploredAreaRef` (Paper.js CompoundPath) and a single `serializedExploredAreas` string in the fog store. When switching floors in a structure (e.g., surface ruins → dungeon below), explored geometry from the surface bleeds into the dungeon, revealing areas that should start fully fogged.

## Goal
Each map gets its own independent explored area geometry. Switching maps loads/saves the correct per-map explored state. The store already has `serializedExploredAreasPerMap: Record<string, string>` — the renderer just doesn't use it.

## Architecture

### Core Change: `exploredAreaRef` → `exploredAreasMapRef`
Replace the single `exploredAreaRef = useRef<paper.CompoundPath | null>(null)` with a **Map** keyed by mapId:
```ts
const exploredAreasMapRef = useRef<Map<string, paper.CompoundPath>>(new Map());
```

A helper gets the active map's explored area:
```ts
function getActiveExploredArea(): paper.CompoundPath | null {
  return exploredAreasMapRef.current.get(selectedMapId || 'default-map') || null;
}
```

### Touch Points in SimpleTabletop.tsx

1. **Initialization (mount effect ~L1511)**: Load ALL per-map explored areas from `serializedExploredAreasPerMap` into the Map, not just a single string.

2. **Fog disable effect (~L1530)**: Clear ALL entries in the Map, and call `clearExploredAreas()` on the store.

3. **External sync effect (~L1560)**: Listen to `serializedExploredAreasPerMap` changes (not the legacy single string). Deserialize only the changed map entries.

4. **Vision merge (~L1958)**: `addVisibleToExplored` uses `getActiveExploredArea()` for the selected map. Serialize back to `setSerializedExploredAreasForMap(mapId, data)`.

5. **Fog mask computation (~L1998)**: `computeFogMasks` uses `getActiveExploredArea()`.

6. **Fog brush stamp (~L9869)**: Uses `getActiveExploredArea()` and writes back to per-map.

7. **Fog brush commit (~L9939)**: Serializes to `setSerializedExploredAreasForMap(mapId, data)`.

8. **Region reveal/unreveal (~L9959, ~L10019)**: Same per-map key pattern.

9. **Visibility checks (~L2192, ~L3224, ~L6593)**: Use `getActiveExploredArea()`.

10. **Content bounds (~L1431)**: Use active explored area.

### Store Changes (fogStore.ts)
- Deprecate `serializedExploredAreas` (keep for migration)
- Primary read/write through `serializedExploredAreasPerMap`
- `clearExploredAreas()` clears both legacy and per-map
- Migration: on load, if `serializedExploredAreas` has data but `serializedExploredAreasPerMap` is empty, copy legacy data to `default-map` key

### Networking (miscHandlers.ts)
- `fog.reveal.preview` payload gains `mapId: string`
- Handler calls `setSerializedExploredAreasForMap(mapId, data)` instead of `setSerializedExploredAreas(data)`

### FogControlCard.tsx
- `clearExploredAreas` already clears both — no change needed
- Could add per-map clear option later

## Migration Strategy
1. On fog store rehydration, if legacy `serializedExploredAreas` is non-empty and `serializedExploredAreasPerMap` is empty/missing, migrate legacy data to `'default-map'` key
2. Legacy field kept but deprecated — reads fall through to per-map

## Files Modified
- `src/components/SimpleTabletop.tsx` — core ref change + all touch points
- `src/stores/fogStore.ts` — migration logic, deprecation
- `src/lib/net/ephemeral/miscHandlers.ts` — mapId in fog sync
- `src/lib/net/ephemeral/types.ts` — payload type update
- `src/lib/version.ts` — bump
