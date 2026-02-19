

# Universal Grouping System

## Overview

Replace the existing token-only `groupStore` with a universal grouping system that can contain **any combination** of regions, map objects, tokens, and lights. Groups act as a single unit for selection, dragging, rotation, and can be exported/imported as reusable "prefabs" (e.g., a pre-built room with walls, doors, lights, and encounter tokens).

## Data Model

### New `EntityGroup` type (replaces `TokenGroup`)

```typescript
interface GroupMember {
  id: string;
  type: 'token' | 'region' | 'mapObject' | 'light';
}

interface EntityGroup {
  id: string;
  name: string;
  members: GroupMember[];
  pivot: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  locked: boolean;
  visible: boolean;
}
```

Each member references an entity by its ID and type. The group does not own the entities -- it's a lightweight association layer. Deleting a group does not delete its members.

## Architecture

### 1. Rewrite `src/stores/groupStore.ts`

- Replace `TokenGroup` and `tokenIds: string[]` with `EntityGroup` and `members: GroupMember[]`.
- Add helpers: `getMembersByType(groupId, type)`, `getGroupForEntity(entityId, entityType)`, `addMembersToGroup(groupId, members[])`, `removeMemberFromGroup(groupId, entityId)`.
- Keep existing selection state (`selectedGroupIds`).
- Add `recalculateBounds(groupId)` that reads positions from all member stores (sessionStore for tokens, regionStore for regions, mapObjectStore for map objects, lightStore for lights).

### 2. Rewrite `src/lib/groupTransforms.ts`

- Replace token-specific bounds calculation with a universal `calculateEntityBounds()` that accepts `GroupMember[]` and reads geometry from the appropriate store.
- Update `applyGroupTransformToMembers()` to compute deltas and apply position changes to each entity via its store's update method.
- Keep the transformation matrix math (it's entity-agnostic).

### 3. Update `src/components/SimpleTabletop.tsx` -- Selection Integration

- When clicking an entity (token, region, or map object), check if it belongs to a group via `getGroupForEntity()`.
- If it does, select all sibling members in their respective stores (highlight them all).
- When dragging a grouped entity, compute the delta and apply it to **all** group members by calling each store's update method.
- When rotating or scaling via group handles, transform all member positions relative to the group pivot.

### 4. Update `src/components/GroupManagerModal.tsx`

- Replace the token-only UI with a unified member picker showing tokens, regions, map objects, and lights in categorized sections.
- Support creating groups from the current multi-selection (if tokens and regions are both selected, group them all).
- Show member icons by type (token icon, region icon, wall icon, light icon).

### 5. Add Group Control Bar integration

- When a group is selected (via clicking any member), show a bottom bar similar to `MapObjectControlBar` with:
  - Group name display
  - Lock/Unlock toggle
  - Ungroup button (dissolves the group, keeps members)
  - Export button (see below)

### 6. Export/Import as Prefab

**Export (`src/lib/groupSerializer.ts` -- new file)**:
- `exportGroupToPrefab(groupId)`: Collects all member data from their stores, normalizes positions relative to the group's top-left corner (so the prefab is origin-relative), embeds textures for tokens/regions, and saves as a `.d20prefab` JSON file.

**Import**:
- `importPrefabToMap(file, placementPosition)`: Parses the prefab, creates new entities in each store with fresh IDs, offsets all positions by the placement point, and creates a new group linking them.
- Add import UI in the existing project manager or a new toolbar button.

**Prefab data structure**:
```typescript
interface PrefabData {
  version: string;
  name: string;
  bounds: { width: number; height: number };
  tokens: Token[];
  regions: CanvasRegion[];
  mapObjects: MapObject[];
  lights: LightSource[];
  embeddedTextures?: EmbeddedTextures;
}
```

### 7. Update `src/lib/projectSerializer.ts`

- Replace `groups: TokenGroup[]` with `groups: EntityGroup[]` in `ProjectData`.
- Add migration logic: if loading old data with `tokenIds`, convert to `members` format with `type: 'token'`.

## Implementation Sequence

1. **New data model**: Rewrite `groupTransforms.ts` types and `groupStore.ts` with the universal `EntityGroup` model and migration for old `TokenGroup` data.
2. **Bounds calculation**: Implement `recalculateBounds()` that reads from all entity stores.
3. **Selection propagation**: In `SimpleTabletop.tsx`, when an entity is clicked, check group membership and select all siblings.
4. **Group dragging**: When dragging a grouped entity, apply delta to all group members.
5. **Group Manager UI**: Update the modal to show all entity types and support creating groups from mixed selections.
6. **Group Control Bar**: Add bottom bar with group actions when a group is selected.
7. **Prefab export/import**: Add `groupSerializer.ts` and integrate with UI for export button on groups and import via file picker.
8. **Project serializer migration**: Update `ProjectData` type and add backward compatibility.

## Technical Considerations

- **No circular dependencies**: The group store will not import entity stores directly. Instead, bounds recalculation is done via a helper function that receives entity data as arguments (called from the component layer).
- **Performance**: Group membership lookups use a derived `Map<entityId, groupId>` index rebuilt on group changes.
- **Lights from lightStore vs MapObject lights**: Both are supported as group members. MapObject lights use `type: 'mapObject'`, standalone lights use `type: 'light'`.
- **Nested groups**: Not supported in v1 to keep complexity manageable.

