
# Map Tree: Z-Order Rendering + Interactive Selection & Reordering

## The Three Problems

**1. Water/Trap Default Draw Order** — All MapObjects are rendered in one unsorted batch (`renderMapObjects` only sorts by selection). Water and trap have no mechanism to always draw beneath doors, columns, annotations, and other objects.

**2. Map Tree is display-only** — Clicking an entity in the tree does not select it on the canvas. There is no multi-select UI in the tree.

**3. No drag-to-reorder in the tree** — The z-order of entities on the canvas cannot be controlled from the tree at all.

---

## Part 1: Z-Order System

### Add `renderOrder` to `MapObject` (`src/types/mapObjectTypes.ts`)

Add an optional field:
```ts
renderOrder?: number; // Lower = drawn first (under everything). Default: 50.
```

This is a **persistent per-object integer** that fully controls draw position. It replaces the current selection-only sort.

### Category Default Render Orders

A lookup table `CATEGORY_DEFAULT_RENDER_ORDER` maps each `MapObjectCategory` to its default value:

| Category | renderOrder | Rationale |
|---|---|---|
| `water` | 10 | Below everything — the "floor puddle" |
| `trap` | 15 | Slightly above water but still under terrain |
| `debris` | 20 | Background scatter |
| `wall` | 30 | Walls sit just above floor decorations |
| `imported-obstacle` | 40 | Imported shapes |
| `door` | 50 | Doors above walls |
| `column` | 60 | Columns on top of floor and doors |
| `furniture` | 60 | Same tier as columns |
| `obstacle` | 60 | Same tier |
| `statue` | 60 | Same tier |
| `stairs` | 60 | Same tier |
| `light` | 70 | Light indicators above props |
| `annotation` | 80 | Labels always on top |
| `decoration` | 55 | Mid-tier decorations |
| `custom` | 50 | Neutral default |

### Update `renderMapObjects` Sort (`src/lib/mapObjectRenderer.ts`)

Replace the selection-only sort with a two-key sort:

```ts
const sortedObjects = [...mapObjects].sort((a, b) => {
  const aOrder = a.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[a.category] ?? 50;
  const bOrder = b.renderOrder ?? CATEGORY_DEFAULT_RENDER_ORDER[b.category] ?? 50;
  if (aOrder !== bOrder) return aOrder - bOrder;
  // Tie-break: selected on top
  return (selectedIds.includes(a.id) ? 1 : 0) - (selectedIds.includes(b.id) ? 1 : 0);
});
```

### Set `renderOrder` on Conversion

When `convertWaterToMapObject` and `convertTrapToMapObject` run in `mapObjectStore.ts`, the new MapObject is given `renderOrder: 10` (water) and `renderOrder: 15` (trap) explicitly — so even objects created before this change (if any existed) would be upgraded by the sort fallback.

---

## Part 2: Map Tree as a Z-Order Controller

### The Tree Display Order is the Z-Order

Currently the tree renders groups first, then ungrouped entities in whatever order they arrive from the store. We need the tree to **mirror the canvas draw order** — items drawn on top appear at the top of the list (Photoshop/CSS convention: top of list = frontmost).

The `allEntities` memo in `MapTreeCardContent` needs to be sorted by `renderOrder` descending (highest renderOrder = top of list = frontmost on canvas).

For entities that don't have a numeric `renderOrder` (tokens, regions, lights), we assign notional values:
- Tokens: 200 (always frontmost by definition)
- Lights: 150
- Regions: 5 (floors, always at the back)

This lets the full tree be a true z-order list.

### Drag-to-Reorder (`src/components/cards/MapTreeCard.tsx`)

Use the HTML5 `draggable` API (no additional dependency needed) on each `EntityRow`. This is the simplest approach that works inside the existing `ScrollArea`.

**Behavior:**
- Drag an item up/down in the list to change its `renderOrder`.
- On drop, compute the new `renderOrder` as the midpoint between the neighbours it was dropped between.
- For **MapObjects**: call `updateMapObject(id, { renderOrder: newValue })`.
- For **Tokens** and **Regions**: these currently have no `renderOrder` field. For now, drag reordering is only enabled for `mapObject` type entries (which is where it matters most for terrain layering). Tokens always render above map objects. Regions always render below. This is clearly communicated by a static label in the tree ("Tokens always render above map objects").
- Groups: dragging a group row reorders the group's **lowest `renderOrder`** member to the target position, then shifts all other members by the same delta.

**Implementation detail — avoiding float drift:**
When the midpoint calculation would produce sub-integer precision after many reorders, a `normalizeRenderOrders()` helper renumbers all mapObjects from 10 to 10*N in steps of 10, preserving relative order. This is called whenever a reorder would produce a gap less than 1.

### Click-to-Select (`src/components/cards/MapTreeCard.tsx`)

Each `EntityRow` gets an `onClick` handler that calls the appropriate store selection method:

| Entity type | Action |
|---|---|
| `mapObject` | `useMapObjectStore.getState().selectMapObject(id, false)` |
| `region` | `useRegionStore.getState().selectRegion(id)` |
| `token` | `useSessionStore.getState().setSelectedTokens([id])` |

For **additive selection** (Ctrl/Cmd + click on a row): calls the additive variant of each.

The tree also needs to **reflect** selection state back from the canvas — items that are selected on the canvas should be highlighted in the tree. This is done by subscribing to `selectedMapObjectIds` from the map object store, the `selected` flag on regions, and `selectedTokenIds` from the session store inside `MapTreeCardContent`.

### Multi-Select Bubble (`src/components/cards/MapTreeCard.tsx`)

Add a selection indicator **before** each row's icon. It is a small `16×16` rounded checkbox:
- Unchecked: dimmed circle outline, only visible on row hover (opacity-0 group-hover:opacity-60)
- Checked: filled primary-colored circle with a checkmark, always visible

Clicking the bubble does **additive** selection (does not clear existing selection). This allows building a multi-selection from the tree without holding Ctrl.

The bubble appears for all entity types but is most useful for mapObjects and tokens.

---

## Files Changed

```text
src/types/mapObjectTypes.ts
  — Add `renderOrder?: number` field to MapObject interface
  — Add `CATEGORY_DEFAULT_RENDER_ORDER` constant map

src/lib/mapObjectRenderer.ts
  — Update renderMapObjects() sort to use renderOrder with category fallback

src/stores/mapObjectStore.ts
  — Set renderOrder in convertWaterToMapObject (10) and convertTrapToMapObject (15)
  — Add reorderMapObject(id, newRenderOrder) helper
  — Add normalizeRenderOrders() helper

src/components/cards/MapTreeCard.tsx  (largest change)
  — Sort allEntities by effective render order (descending = frontmost first)
  — Add SelectionBubble sub-component (checkbox circle)
  — Add onClick to EntityRow → calls store selection
  — Add onSelectAdditive to EntityRow → additive selection
  — Add draggable={true} + onDragStart/onDragOver/onDrop to EntityRow
  — Add visual drop-target indicator (blue line between rows)
  — Subscribe to selectedMapObjectIds, selectedRegionIds to highlight active rows
  — Disable drag for entity types where reordering has no effect (regions, lights)
  — Add a static info banner: "Drag to reorder draw order. Tokens always draw above map objects."
```

---

## What This Does NOT Change

- The canvas interaction (clicking on the canvas to select) remains unchanged.
- Groups retain their existing behaviour — the group row is not draggable at this stage (moving a group would require reordering all member `renderOrder` values consistently, which is a follow-up).
- Tokens and regions do not get `renderOrder` fields — their draw order relative to each other within their own layer is unchanged. Only MapObject-to-MapObject ordering is user-controllable.
- No new dependencies are introduced.
