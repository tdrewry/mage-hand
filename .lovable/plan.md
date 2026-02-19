
# Migrate All Terrain Features to MapObjects — Full Deprecation of dungeonStore.terrainFeatures

## The Goal

Every shape that arrives through any import path must become a first-class **MapObject**. After this change, the `terrainFeatures` array in `dungeonStore` will always be empty and can be removed entirely from state, persistence, rendering, and serialization. No data migration is needed for legacy saves because there are no existing clients.

---

## What Currently Uses TerrainFeatures

Only two terrain types still use the `TerrainFeature` path at runtime:

| Type | Current path | Problem |
|---|---|---|
| `water` | `watabouImporter` → `terrainFeatures[]` → `dungeonStore` → `renderTerrainFeatures()` | Cannot be grouped, moved, rotated, or undone |
| `trap` | Same path as water (same render function) | Same problems |

`column` and `debris` were previously migrated to MapObjects and are already skipped inside `renderTerrainFeatures`. The skeletons are still there but produce no output.

---

## New MapObject Categories

Add two new values to the `MapObjectCategory` union in `src/types/mapObjectTypes.ts`:

```
'water' | 'trap'
```

**Water preset:**
- `shape: 'custom'`
- `fillColor: 'rgba(59, 130, 246, 0.35)'` (translucent blue)
- `strokeColor: 'rgba(96, 165, 250, 0.6)'`
- `strokeWidth: 1`
- `castsShadow: false`, `blocksMovement: false`, `blocksVision: false`
- `revealedByLight: false`

**Trap preset:**
- `shape: 'custom'`
- `fillColor: 'rgba(220, 38, 38, 0.2)'` (translucent red)
- `strokeColor: '#dc2626'`
- `strokeWidth: 2`
- `castsShadow: false`, `blocksMovement: false`, `blocksVision: false`
- `revealedByLight: true`

Add labels for both in `MAP_OBJECT_CATEGORY_LABELS` and `MAP_OBJECT_PRESETS`.

---

## New Conversion Methods in `mapObjectStore.ts`

### `convertWaterToMapObject(tiles, fluidBoundary?): string`

Creates **one** MapObject per water body:
- `shape: 'custom'`
- `category: 'water'`
- `customPath` = `fluidBoundary` points (the marching-squares contour). Falls back to a bounding rectangle from `tiles` if no fluid boundary.
- `position` = centroid of `customPath` (or tile bounding box center)
- `width` / `height` = bounding box of the path

All the geometry is already computed by `convertWater()` in `watabouImporter.ts`. We just need to move it into a MapObject instead of a TerrainFeature struct.

### `convertTrapToMapObject(tiles): string[]`

Creates **one** MapObject per trap tile (traps are individual cells, not grouped):
- `shape: 'custom'`
- `category: 'trap'`
- `customPath` = a simple square polygon for the tile bounds (50×50 px)
- `position` = tile center

---

## Changes to `watabouImporter.ts`

The `importWatabouDungeon()` function currently returns `terrainFeatures: Omit<TerrainFeature, 'id'>[]` from `convertWater()`. We change this return shape:

**Before:**
```typescript
return {
  regions, doors, annotations,
  terrainFeatures,   // ← water lives here
  columnTiles,
  metadata,
};
```

**After:**
```typescript
return {
  regions, doors, annotations,
  waterMapObjectData: waterBody | null,   // raw params for convertWaterToMapObject
  trapTiles: scaledTiles[],               // raw tile coords for convertTrapToMapObject
  columnTiles,
  metadata,
};
```

The `terrainFeatures` field is removed from the return type entirely. The `TerrainFeature` import at the top of the file is also removed.

---

## Changes to `WatabouImportCard.tsx`

Replace the two lines that call the old terrain system:

```typescript
// REMOVE:
const featuresWithIds = imported.terrainFeatures.map(...)
setTerrainFeatures(featuresWithIds);

// ADD:
if (imported.waterMapObjectData) {
  const waterId = useMapObjectStore.getState()
    .convertWaterToMapObject(imported.waterMapObjectData.tiles, imported.waterMapObjectData.fluidBoundary);
  addedEntityIds.push({ id: waterId, type: 'mapObject' });
}
imported.trapTiles.forEach(tile => {
  const trapId = useMapObjectStore.getState().convertTrapToMapObject([tile]);
  addedEntityIds.push({ id: trapId, type: 'mapObject' });
});
```

Remove the `setTerrainFeatures` import from `useDungeonStore`. The `setAnnotations` import stays (annotations are still in dungeonStore for now).

---

## Rendering: Add `'water'` and `'trap'` Branches in `SimpleTabletop.tsx`

The canvas already has a rendering path for MapObjects with `shape: 'custom'` that draws the `customPath` polygon. We need to add **category-aware visual styling** inside that block.

**Water rendering logic** (extracted from `renderWaterTiles` in `dungeonRenderer.ts`):
1. Fill the `customPath` polygon with translucent blue.
2. Apply the `computeInsetPath` ripple loop (up to 6 concentric strokes inset from the boundary).
3. This renders identically in edit and play mode — no mode switch needed.

**Trap rendering logic** (extracted from `renderTrapTiles`):
1. Fill the `customPath` polygon with translucent red.
2. Draw a red `×` stroke at the center of the bounds.

The `computeInsetPath` function will be extracted from `dungeonRenderer.ts` into a shared utility file (e.g. `src/utils/pathUtils.ts`, which already exists) so both the old renderer and the new MapObject renderer can use it without circular imports.

---

## Remove All TerrainFeature Code

Once the two new conversion methods exist and the importer no longer produces `TerrainFeature` objects, the following can be deleted or emptied:

| Location | What to remove |
|---|---|
| `src/stores/dungeonStore.ts` | `terrainFeatures: []`, `addTerrainFeature`, `updateTerrainFeature`, `removeTerrainFeature`, `clearTerrainFeatures`, `setTerrainFeatures` — the entire terrain section. Also remove from `clearAll()`. |
| `src/lib/dungeonTypes.ts` | `TerrainFeature` interface (keep the file for `DoorConnection`, `Annotation`, `LightSource`, `WatabouJSON`, `DOOR_TYPE_LABELS`). |
| `src/lib/dungeonRenderer.ts` | `renderTerrainFeatures()`, `renderWaterTiles()`, `renderTrapTiles()`, `renderColumnTiles()`, `renderDebrisTiles()`. Keep `renderDungeonMapRegions`, `renderDoors`, `renderAnnotations`, `computeInsetPath` (moved to pathUtils). |
| `src/components/SimpleTabletop.tsx` | Remove the `renderTerrainFeatures` import and the call at line 2164. Remove the `terrainFeatures` destructuring from `useDungeonStore`. Remove the group-drag terrain-propagation block (~lines 5874 and 6395). |
| `src/components/modals/ClearDataDialog.tsx` | Remove `clearTerrainFeatures` call (after clearing map objects, water MapObjects are cleared with the rest). |
| `src/lib/autoSaveManager.ts` | Remove `terrainFeatures` from the dungeon data snapshot. |
| `src/components/cards/ProjectManagerCard.tsx` | Remove `dungeonData.terrainFeatures` read/write in both `applyProjectData` and the rollback path. |

---

## Files Changed (Summary)

```text
src/types/mapObjectTypes.ts           — add 'water' | 'trap' to MapObjectCategory union + presets + labels
src/stores/mapObjectStore.ts          — add convertWaterToMapObject(), convertTrapToMapObject()
src/lib/watabouImporter.ts            — return waterMapObjectData+trapTiles instead of terrainFeatures
src/components/cards/WatabouImportCard.tsx  — call new conversion methods, remove setTerrainFeatures
src/components/SimpleTabletop.tsx     — add water/trap rendering in customPath block, remove terrainFeature references (~5 sites)
src/utils/pathUtils.ts                — add computeInsetPath() utility (extracted from dungeonRenderer)
src/lib/dungeonRenderer.ts            — remove renderTerrainFeatures + water/trap/column/debris helpers
src/stores/dungeonStore.ts            — remove terrainFeatures field and all terrain CRUD methods
src/lib/dungeonTypes.ts               — remove TerrainFeature interface
src/lib/autoSaveManager.ts            — remove terrainFeatures from dungeon snapshot
src/components/cards/ProjectManagerCard.tsx  — remove terrainFeatures read/write
src/components/modals/ClearDataDialog.tsx    — remove clearTerrainFeatures call
src/lib/version.ts                    — bump to 0.3.0
```

---

## What This Fixes (recap)

- Water and traps are now **MapObjects** — they participate in group membership, are included in `addedEntityIds`, and get a proper ID in the group.
- **Undo works** — MapObject CRUD commands exist; water/trap moves will revert correctly.
- **Rotation works** — `groupTransforms.ts` iterates `mapObject` members; water/trap are now members.
- **Bounding box works** — `computeGroupAABB` handles `mapObject`; water/trap are included.
- **Edit-mode rendering fixed** — `shape: 'custom'` with `customPath` renders the organic polygon in both modes, not tile-by-tile blue boxes.
- **No group-drag special-casing** — the terrain propagation hacks in the mousemove handler can be deleted; the standard MapObject delta path handles it.
- **Clean export/import** — `terrainFeatures` disappears from `dungeonData`; water/trap live in `mapObjects` alongside doors and walls.
