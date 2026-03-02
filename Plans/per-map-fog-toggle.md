# Per-Map Fog Settings (Implemented v0.5.44)

## Overview
Allow fog of war to be enabled/disabled independently per map. One map (e.g. an overworld) can have no fog while a dungeon map uses full fog. The global `fogStore.enabled` remains as a master switch — fog only renders when **both** the global toggle and the map-level toggle are true.

## Data Model

### MapData (mapStore.ts)
- Add `fogEnabled?: boolean` to `MapData` interface
- Default: `undefined` → treated as `true` (backwards-compatible)
- New action: `setMapFogEnabled(mapId: string, enabled: boolean)`

### No fogStore changes
The global `enabled` flag stays as-is. Per-map state lives on the map itself, keeping the two concerns (global master switch vs per-map policy) cleanly separated.

## Derived Flag

In `SimpleTabletop.tsx`, derive a single reactive value:

```ts
const currentMapFogEnabled = useMemo(() => {
  if (!fogEnabled) return false; // Master switch off → no fog anywhere
  if (!selectedMapId) return true; // No map selected → default on
  const map = maps.find(m => m.id === selectedMapId);
  return map?.fogEnabled !== false; // undefined defaults to true
}, [fogEnabled, selectedMapId, maps]);
```

Replace all ~20+ uses of raw `fogEnabled` in rendering, interaction, and safety-black logic with `currentMapFogEnabled`. The fog computation effect's dependency array already includes `selectedMapId` and `maps`.

## Files Modified

### 1. `src/stores/mapStore.ts`
- Add `fogEnabled?: boolean` to `MapData`
- Add `setMapFogEnabled` action

### 2. `src/components/SimpleTabletop.tsx`
- Add `currentMapFogEnabled` derived memo
- Replace `fogEnabled` → `currentMapFogEnabled` in:
  - Post-processing `enabled` prop (~line 514)
  - Explored area loading effect (~line 1530)
  - Fog-disabled cleanup effect (~line 1553)
  - Fog computation gate (~line 1729)
  - Fog computation dependency array (~line 2149)
  - Token visibility/interaction checks in play mode (~lines 2219, 2561, 3324)
  - Annotation fog checks (~line 3251)
  - Overlay canvas decision (~line 3503)
  - Safety-black render (~line 3555)
  - Fog mask rendering (~line 3566)
  - Overlay token draw (~line 3775)
  - Fog brush activation guard (~line 3812)
  - Portal/token fog checks (~line 6614)
- Keep raw `fogEnabled` only where the global master switch is needed:
  - `setFogEnabled` / `setFogRevealAll` callbacks (these control the global toggle)

### 3. `src/components/cards/MapTreeCard.tsx`
- Add fog toggle icon (Cloud/CloudOff) per map row
- Calls `setMapFogEnabled(mapId, !current)`
- Only shown when global fog is enabled (grayed/hidden otherwise)

### 4. `src/components/cards/FogControlCard.tsx`
- Show current map's fog state as an indicator badge
- Optional: quick toggle for current map's fog from the fog panel

### 5. `src/lib/version.ts`
- Bump version

## Edge Cases
- **No selected map**: `currentMapFogEnabled` defaults to global `fogEnabled`
- **Map switch mid-play**: fog caches already clear on `selectedMapId` change (v0.5.43), so switching from fog-on to fog-off map correctly stops rendering fog
- **Fog brush**: guard already checks `fogEnabled && isDM && renderingMode === 'play'` — replace with `currentMapFogEnabled`
- **Compound maps (non-exclusive)**: fog state follows the focused/selected map; non-focused maps inherit their own `fogEnabled` but are rendered with the focused map's fog pipeline (acceptable simplification)
- **Serialization**: `fogEnabled` on MapData persists via mapStore's existing persist middleware — no extra work needed
- **Networking**: no ephemeral changes needed; the flag syncs via mapStore's syncPatch middleware
