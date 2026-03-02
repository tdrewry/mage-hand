# Multi-Map Architecture Implementation Plan

## Overview

Transform Magehand from a single-map-with-global-entities model to a true multi-map architecture where every entity (token, region, map object, light, fog) is scoped to a specific map. This includes deprecating the Layer Stack card in favor of a Map-aware Map Tree, redesigning Map Manager with active/inactive semantics, and introducing map creation from source images with grid-aligned scaling.

## Current State Summary

- `mapStore` has a `maps[]` array with grid regions, viewport persistence, and visibility toggles -- but **no entity scoping**.
- `sessionStore.tokens[]`, `mapObjectStore.mapObjects[]`, `regionStore.regions[]`, `illuminationStore.lights[]`, `fogStore` are all **global singletons** with no `mapId`.
- `BackgroundGridCard` operates on a Fabric.js canvas that is not connected to any store -- it is non-functional dead code.
- `LayerStackCard` uses hardcoded layer types with Fabric.js -- also non-functional dead code.
- `MapTreeCard` lists all entities globally with no map grouping.
- Role permissions have `canEditMap` but no map-specific permission key.

---

## Phase 1: Data Model -- Add `mapId` to All Entity Types

### 1.1 Token type (`src/stores/sessionStore.ts`)
- Add optional `mapId?: string` to the `Token` interface.

### 1.2 MapObject type (`src/types/mapObjectTypes.ts`)
- Add optional `mapId?: string` to the `MapObject` interface.

### 1.3 CanvasRegion type (`src/stores/regionStore.ts`)
- Add optional `mapId?: string` to the `CanvasRegion` interface.

### 1.4 IlluminationSource type (`src/types/illumination.ts`)
- Add optional `mapId?: string` to the `IlluminationSource` interface.

### 1.5 FogStore -- per-map fog (`src/stores/fogStore.ts`)
- Change `serializedExploredAreas: string` to `serializedExploredAreasPerMap: Record<string, string>` (mapId to serialized geometry).
- Keep backward-compatible getter/setter that defaults to the active map.
- Existing `serializedExploredAreas` migrated to the default map on first load.

### 1.6 GroupStore (`src/stores/groupStore.ts`)
- Add optional `mapId?: string` to `EntityGroup` in `groupTransforms.ts`.

### 1.7 LightStore deprecation
- `lightStore.ts` appears to be a legacy duplicate of `illuminationStore.ts`. Confirm and mark deprecated; all new code references `illuminationStore`.

---

## Phase 2: Map Store Redesign (`src/stores/mapStore.ts`)

### 2.1 Replace `visible` with `active` semantics
- Rename `GameMap.visible` to `GameMap.active` (boolean). Active maps are rendered; inactive maps are hidden.
- `selectedMapId` remains for "which map is being edited/focused."
- Multiple maps can be `active: true` simultaneously (compound map viewing).

### 2.2 Remove or repurpose width/height/backgroundColor
- `GameMap.bounds` width/height become meaningful: they define the map's canvas extent.
- `GameMap.backgroundColor` becomes the default region fill color when no art is provided.
- Display these as "Map Dimensions" and "Default Background" in Map Manager.
- Show computed grid dimensions: `width / gridSize x height / gridSize` cells.

### 2.3 Add image support to GameMap
- Add `imageUrl?: string`, `imageHash?: string`, `imageScale?: number`, `imageOffsetX?: number`, `imageOffsetY?: number` to `GameMap`.
- When a map is created from an image, `bounds.width` and `bounds.height` are derived from the image's natural dimensions multiplied by `imageScale`.

### 2.4 Compound Map type
- Add `compoundMapId?: string` to `GameMap` -- if set, this map is a member of a compound map group.
- Add a new action `saveAsCompoundMap(name: string, mapIds: string[])` that creates a metadata entry linking multiple maps.
- Compound maps appear as a special entry in Map Manager that expands to show member maps.

---

## Phase 3: Map Manager Card Redesign (`src/components/cards/MapManagerCard.tsx`)

### 3.1 Active/Inactive toggle replaces visibility
- Replace the Eye/EyeOff icon with an Active/Inactive toggle (switch or highlighted state).
- Active maps render on canvas; inactive maps are hidden but preserved.

### 3.2 Map creation from source image
- Add "New Map from Image" button that opens a modal:
  - File upload or URL input for the source image.
  - Grid overlay preview with adjustable grid size (slider + number input).
  - Scale slider to resize the image relative to the grid.
  - Pixel-nudge controls: 4 arrow buttons to shift the image by 1px in each direction (for sub-grid alignment).
  - "Create Map" commits: creates a new `GameMap` with computed bounds, stores the image in texture storage, creates a default region covering the full image extent.

### 3.3 Save current canvas as map
- When only the default map exists, show a "Save as Map" action that names/saves the current state.
- When a second map is added by any means (import, create), prompt: "Save current canvas as [name]?" with Save/Discard options.

### 3.4 Drag-to-reorder maps
- Maps are reorderable via drag handles (already partially implemented via `reorderMaps`).
- Order determines z-order when multiple maps are active simultaneously.

### 3.5 Compound Map management
- "Save as Compound Map" action: select multiple active maps, name the compound, save.
- Compound maps appear as collapsible groups in the map list.
- Activating a compound map activates all its member maps.

### 3.6 Map dimensions and grid info display
- Show `width x height` px and `cols x rows` grid cells in the expanded map details.
- Show grid scale if relevant.

---

## Phase 4: Map Tree Integration (`src/components/cards/MapTreeCard.tsx`)

### 4.1 Maps as top-level tree nodes
- Each active map becomes a collapsible top-level node in the Map Tree.
- Children are grouped by type: Regions, Map Objects, Tokens, Lights (filtered by `mapId`).
- Map nodes show active/inactive toggle and are drag-reorderable (synced with Map Manager order).

### 4.2 Bidirectional sync with Map Manager
- Reordering maps in Map Tree updates `mapStore.reorderMaps`.
- Toggling active/inactive in Map Tree updates `mapStore.updateMap(id, { active })`.
- Changes in Map Manager are reflected immediately in Map Tree (both read from `mapStore`).

### 4.3 Unassigned entities section
- Entities with no `mapId` (legacy data) appear under an "Unassigned" section at the bottom.
- Provide a context menu action "Move to Map..." to assign a `mapId`.

---

## Phase 5: Deprecate Layer Stack and Background Grid Card

### 5.1 Remove LayerStackCard
- Delete `src/components/cards/LayerStackCard.tsx`.
- Delete `src/components/LayerStackModal.tsx`.
- Remove `CardType.LAYERS` from `cardStore.ts`.
- Remove Layer Stack references from `VerticalToolbar.tsx`, `ToolsCard.tsx`, `CardManager.tsx`.
- Reassign the left-hand menu button (Layers icon) to open **Map Tree** instead.

### 5.2 Remove BackgroundGridCard
- Delete `src/components/cards/BackgroundGridCard.tsx`.
- Remove its `CardType` registration and references.
- Grid and background settings are now per-map in Map Manager or per-region in the Regions tab.

---

## Phase 6: Rendering Pipeline -- Filter by Active Map

### 6.1 SimpleTabletop token filtering
- In `SimpleTabletop.tsx`, filter rendered tokens: only show tokens where `token.mapId` matches an active map's ID (or `mapId` is undefined for legacy).

### 6.2 MapObject rendering filtering
- In `mapObjectRenderer.ts` and related canvas code, filter `mapObjects` by active map IDs.

### 6.3 Region rendering filtering
- Filter `regions` by active map IDs.

### 6.4 Light/Illumination filtering
- Filter illumination sources by active map IDs.

### 6.5 Fog per-map
- When computing fog geometry, use the active map's `serializedExploredAreasPerMap[mapId]`.
- Fog brush operations write to the current `selectedMapId`'s entry.

### 6.6 Wall geometry cache
- Key wall geometry caches by `mapId` so switching maps doesn't require full recomputation.

---

## Phase 7: Role Permissions for Map Management

### 7.1 New permission key
- Add `canManageMaps: boolean` to `Role.permissions`.
- Default: `true` for DM, `false` for Player.

### 7.2 Permission gating
- Map Manager card: hide create/delete/reorder/rename actions unless `canManageMaps`.
- Map Tree: hide map-level active/inactive toggles and reorder unless `canManageMaps`.
- Map switching (selecting active map): available to all roles (read-only navigation).
- "New Map from Image" modal: gated by `canManageMaps`.

### 7.3 Update role definitions
- Update `DEFAULT_DM_ROLE`, `DEFAULT_PLAYER_ROLE`, and all session templates in `sessionTemplates.ts`.
- Update `RoleManagerCard.tsx` permission labels.
- Add `canManageMaps` helper to `rolePermissions.ts`.

---

## Phase 8: Migration and Backward Compatibility

### 8.1 Default map assignment
- On first load after upgrade, if entities have no `mapId`, assign them to the first map's ID (typically `'default-map'`).
- Run this migration in each store's persist `onRehydrate` or a one-time migration function.

### 8.2 ProjectData / .mhsession format
- Add `mapId` to serialized token, region, mapObject, and illumination entries in `ProjectData`.
- Add `serializedExploredAreasPerMap` to `fogData`.
- Importing old sessions without `mapId` assigns all entities to the first map.

### 8.3 Import pipeline
- Watabou, dd2vtt, and prefab imports assign `mapId` of the currently selected map to all imported entities.

---

## Phase 9: Version Bump
- Increment `APP_VERSION` in `src/lib/version.ts`.

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/stores/sessionStore.ts` -- add `mapId` to Token |
| Modify | `src/types/mapObjectTypes.ts` -- add `mapId` to MapObject |
| Modify | `src/stores/regionStore.ts` -- add `mapId` to CanvasRegion |
| Modify | `src/types/illumination.ts` -- add `mapId` to IlluminationSource |
| Modify | `src/stores/fogStore.ts` -- per-map fog data |
| Modify | `src/lib/groupTransforms.ts` -- add `mapId` to EntityGroup |
| Modify | `src/stores/mapStore.ts` -- active/inactive, image fields, compound maps |
| Rewrite | `src/components/cards/MapManagerCard.tsx` -- active/inactive, image import, compound maps |
| Modify | `src/components/cards/MapTreeCard.tsx` -- map-level tree nodes, filtering |
| Delete | `src/components/cards/LayerStackCard.tsx` |
| Delete | `src/components/LayerStackModal.tsx` |
| Delete | `src/components/cards/BackgroundGridCard.tsx` |
| Modify | `src/stores/cardStore.ts` -- remove LAYERS and BACKGROUND_GRID card types |
| Modify | `src/components/VerticalToolbar.tsx` -- rebind Layers button to Map Tree |
| Modify | `src/components/cards/ToolsCard.tsx` -- remove Layer Stack reference |
| Modify | `src/components/CardManager.tsx` -- remove deprecated card mappings |
| Modify | `src/stores/roleStore.ts` -- add `canManageMaps` permission |
| Modify | `src/lib/rolePermissions.ts` -- add `canManageMaps` helper |
| Modify | `src/lib/sessionTemplates.ts` -- add `canManageMaps` to templates |
| Modify | `src/components/cards/RoleManagerCard.tsx` -- add permission label |
| Modify | `src/components/SimpleTabletop.tsx` -- filter entities by active maps |
| Modify | `src/lib/mapObjectRenderer.ts` -- filter by active maps |
| Modify | `src/lib/projectSerializer.ts` -- mapId in ProjectData |
| Modify | `src/lib/version.ts` -- version bump |
| Create | `src/components/modals/MapImageImportModal.tsx` -- grid overlay scaling modal |
| Create | `Plans/multi-map-architecture.md` -- save this plan |

---

## Sequencing Recommendation

Due to the breadth of this change, implement in this order:
1. **Phase 1** (data model) + **Phase 8.1** (migration) -- foundation, backward compatible
2. **Phase 2** (map store redesign) -- structural
3. **Phase 5** (deprecate dead code) -- cleanup, reduces noise
4. **Phase 6** (rendering filters) -- maps become functional
5. **Phase 3** (Map Manager UI) -- user-facing map management
6. **Phase 4** (Map Tree integration) -- hierarchy visualization
7. **Phase 7** (permissions) -- access control
8. **Phase 8.2-8.3** (serialization + imports) -- persistence
9. **Phase 9** (version bump) -- final step
