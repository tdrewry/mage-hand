# Fine-Grained CoValue Migration: Tokens, Regions, Map Objects

## Overview

Migrate tokens (already partially done), regions, and map objects from blob-based sync to per-entity CoMap sync within Jazz. This eliminates the 1MB blob limit issue entirely for these entity types and enables real-time per-field granular updates. Clean break — no blob fallback for migrated kinds.

## Current State

- **Tokens**: Already have fine-grained CoMaps (`JazzToken`/`JazzTokenList`) but with a limited field set — many fields packed into an `extras` JSON string. The bridge handles add/update/remove individually.
- **Regions**: Synced as a single blob via `JazzDOBlob`. ~30 fields per region.
- **Map Objects**: Synced as a single blob via `JazzDOBlob`. ~35 fields per object, including `customPath` arrays and portal links.
- **Effects**: Already fixed by stripping `template` snapshots from blob. Keep as blob for now (low entity count, template reconstructible).

## Plan

### 1. Expand JazzToken Schema (schema.ts)

The current `JazzToken` has only basic fields. Many important fields are stuffed into `extras` JSON. Promote them to first-class CoMap fields:

```typescript
export const JazzToken = co.map({
  tokenId: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  label: z.string(),
  name: z.string(),
  gridWidth: z.number(),
  gridHeight: z.number(),
  mapId: z.optional(z.string()),
  // Promoted from extras:
  hp: z.optional(z.number()),
  maxHp: z.optional(z.number()),
  ac: z.optional(z.number()),
  hostility: z.optional(z.string()),
  imageHash: z.optional(z.string()),
  roleId: z.optional(z.string()),
  isHidden: z.optional(z.boolean()),
  labelPosition: z.optional(z.string()),
  labelColor: z.optional(z.string()),
  labelBackgroundColor: z.optional(z.string()),
  initiative: z.optional(z.number()),
  inCombat: z.optional(z.boolean()),
  pathStyle: z.optional(z.string()),
  pathColor: z.optional(z.string()),
  pathWeight: z.optional(z.number()),
  pathOpacity: z.optional(z.number()),
  footprintType: z.optional(z.string()),
  locked: z.optional(z.boolean()),
  notes: z.optional(z.string()),
  statBlockJson: z.optional(z.string()),
  // Remaining complex fields stay in extras:
  // illuminationSources, entityRef, appearanceVariants, activeVariantId
  extras: z.optional(z.string()),
});
```

### 2. Create JazzRegion Schema (schema.ts)

```typescript
export const JazzRegion = co.map({
  regionId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  gridType: z.string(), // 'square' | 'hex' | 'free'
  gridSize: z.number(),
  gridScale: z.number(),
  gridSnapping: z.boolean(),
  gridVisible: z.boolean(),
  textureHash: z.optional(z.string()),
  backgroundRepeat: z.optional(z.string()),
  backgroundScale: z.optional(z.number()),
  backgroundOffsetX: z.optional(z.number()),
  backgroundOffsetY: z.optional(z.number()),
  backgroundColor: z.optional(z.string()),
  regionType: z.optional(z.string()),
  rotation: z.optional(z.number()),
  locked: z.optional(z.boolean()),
  mapId: z.optional(z.string()),
  smoothing: z.optional(z.boolean()),
  // Complex nested data as JSON strings:
  pathPointsJson: z.optional(z.string()),
  bezierControlPointsJson: z.optional(z.string()),
  rotationCenterJson: z.optional(z.string()),
});

export const JazzRegionList = co.list(JazzRegion);
```

### 3. Create JazzMapObject Schema (schema.ts)

```typescript
export const JazzMapObject = co.map({
  objectId: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.optional(z.number()),
  shape: z.string(),
  fillColor: z.string(),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  opacity: z.number(),
  imageHash: z.optional(z.string()),
  textureScale: z.optional(z.number()),
  textureOffsetX: z.optional(z.number()),
  textureOffsetY: z.optional(z.number()),
  castsShadow: z.boolean(),
  blocksMovement: z.boolean(),
  blocksVision: z.boolean(),
  revealedByLight: z.boolean(),
  isOpen: z.optional(z.boolean()),
  doorType: z.optional(z.number()),
  label: z.optional(z.string()),
  category: z.string(),
  locked: z.optional(z.boolean()),
  renderOrder: z.optional(z.number()),
  mapId: z.optional(z.string()),
  portalName: z.optional(z.string()),
  portalTargetId: z.optional(z.string()),
  portalHiddenInPlay: z.optional(z.boolean()),
  portalAutoActivateTarget: z.optional(z.boolean()),
  annotationText: z.optional(z.string()),
  annotationReference: z.optional(z.string()),
  terrainFeatureId: z.optional(z.string()),
  // Complex nested data as JSON:
  customPathJson: z.optional(z.string()),
  wallPointsJson: z.optional(z.string()),
  doorDirectionJson: z.optional(z.string()),
  // Light properties:
  lightColor: z.optional(z.string()),
  lightRadius: z.optional(z.number()),
  lightBrightRadius: z.optional(z.number()),
  lightIntensity: z.optional(z.number()),
  lightEnabled: z.optional(z.boolean()),
});

export const JazzMapObjectList = co.list(JazzMapObject);
```

### 4. Extend JazzSessionRoot (schema.ts)

```typescript
export const JazzSessionRoot = co.map({
  sessionName: z.string(),
  tokens: JazzTokenList,
  maps: JazzMapList,
  regions: JazzRegionList,        // NEW
  mapObjects: JazzMapObjectList,  // NEW
  blobs: JazzDOBlobList,          // Still used for remaining kinds
  textures: co.optional(JazzTextureList),
});
```

### 5. Create Region Bridge Helpers (bridge.ts)

Follow the same pattern as the token bridge:
- `regionToJazzInit(r: CanvasRegion)` — serialize, strip `backgroundImage`, serialize nested objects to JSON strings
- `jazzToZustandRegion(jr: any)` — deserialize JSON strings back to objects, set `backgroundImage: ''`
- `pushRegionsToJazz(sessionRoot)` — bulk push
- `pullRegionsFromJazz(sessionRoot)` — bulk pull
- In `startBridge()`: subscribe to `useRegionStore` for outbound changes (add/update/remove), subscribe to `sessionRoot.regions.$jazz.subscribe` for inbound

### 6. Create MapObject Bridge Helpers (bridge.ts)

Same pattern:
- `mapObjectToJazzInit(obj: MapObject)` — serialize, strip `imageUrl`, serialize `customPath`/`wallPoints`/`doorDirection` to JSON
- `jazzToZustandMapObject(jmo: any)` — deserialize
- `pushMapObjectsToJazz(sessionRoot)` / `pullMapObjectsFromJazz(sessionRoot)`
- Bridge subscriptions in `startBridge()`

### 7. Enhance Token Bridge (bridge.ts)

Update `tokenToJazzInit` and `jazzToZustandToken` to use promoted first-class fields instead of packing into `extras`. Keep `extras` only for truly complex nested structures (illuminationSources, entityRef, appearanceVariants).

Update the change-detection in the token bridge subscription to diff more fields beyond just x/y/label/color.

### 8. Remove Blob Sync for Migrated Kinds

- Remove `'regions'` and `'mapObjects'` from `BLOB_SYNC_KINDS`
- Remove their entries from `STORE_FOR_KIND`
- Remove `stripRegionTexturesForSync` and `stripMapObjectTexturesForSync` (no longer needed — textures stripped at CoMap level)
- Update `pullAllFromJazz` to call `pullRegionsFromJazz` and `pullMapObjectsFromJazz`
- Update `pushAllToJazz` to call `pushRegionsToJazz` and `pushMapObjectsToJazz`

### 9. Update createSessionRoot (schema.ts)

Create empty `JazzRegionList` and `JazzMapObjectList` alongside tokens/maps/blobs.

### 10. Update Exports (jazz/index.ts)

Export new schemas and bridge functions.

### 11. Version Bump

Bump `APP_VERSION`.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/jazz/schema.ts` | Add JazzRegion, JazzMapObject schemas; expand JazzToken; extend JazzSessionRoot |
| `src/lib/jazz/bridge.ts` | Add region/mapObject bridge helpers; enhance token bridge; remove blob sync for these kinds |
| `src/lib/jazz/index.ts` | Export new schemas |
| `src/lib/version.ts` | Bump version |

## Migration Notes

- **Clean break**: Old sessions with only blobs for regions/mapObjects won't auto-migrate. Users need to re-export/import or start new sessions.
- **Backward compat for sessionRoot**: Use `co.optional()` for new lists so old session roots don't crash. The bridge creates lists lazily if missing.
- **Texture sync unchanged**: FileStream-based texture sync already handles all entity types. The `collectAllTextureHashes()` function already collects from tokens, regions, mapObjects, effects, and maps.
- **`selected` field excluded**: Selection is local UI state, never synced.

## Remaining Blob-Synced Kinds After Migration

maps, groups, initiative, roles, visionProfiles, fog, lights, illumination, dungeon, creatures, hatching, effects, actions, dice

These are generally small (< 100KB) and don't carry textures, so blob sync remains appropriate.
