# STEP-007 — Light Source → Item Canvas Entity System

## Overview

Map Object Light Sources currently serve as simple freestanding light emitters. The user's vision is to evolve them into a first-class **Item** Canvas Entity type — a richer, more interactive entity that is physically representable on the map and can carry properties like illumination, a character-sheet-like data block, and an inventory.

This is the largest and most far-reaching plan in the STEP series. It touches multiple subsystems. This document focuses on the **architectural design** and breaks the work into phases.

---

## Core Concept: What is an Item?

An **Item** is a Canvas Entity that:
1. **Has a physical map presence** — rendered like a Map Object (draggable, scalable, with a zoom-invariant manipulation handle)
2. **Carries an illumination property** — a lantern, torch, brazier, or glowing artifact emits light (uses the unified illumination system from STEP-002)
3. **Can be picked up** by a Token — transferring the Item's illumination property to the token, and removing the Item from the map
4. **Has a data sheet** — actions, features, traits, material, durability, and resistances (a subset of the full character sheet schema from STEP-009)
5. **Can be a container** — holds other Items in an inventory list
6. **Can be interacted with** over the ephemeral network — pick up, examine, loot, share

Items are **more like Tokens than Map Objects** in terms of capabilities, but are **not creatures** — they don't have health pools, initiative, or AI agency.

---

## Relationship to Existing Systems

| Property | Light Source (current) | Item (proposed) |
|---|---|---|
| Map presence | ✅ Circle with zoom handle | ✅ Sprite/icon with zoom handle |
| Illumination | ✅ Simple radius/color | ✅ Full IlluminationPreset (STEP-002) |
| Pick up | ❌ | ✅ → transfers illumination to token |
| Data sheet | ❌ | ✅ Subset of generic schema (STEP-009) |
| Container | ❌ | ✅ Inventory list of child Items |
| Jazz sync | `JazzIlluminationSource` | New `JazzItem` CoValue |
| Selection | ✅ | ✅ (added to Canvas Entity table) |
| Bulk delete | ✅ | ✅ |
| Group | ✅ | ✅ |

---

## Phase 1: Item Type & Data Schema

### TypeScript Type: `CanvasItem`
```ts
interface CanvasItem {
  id: string;
  name: string;
  description?: string;
  mapId: string;
  position: { x: number; y: number };
  // Rendering
  imageHash?: string;          // Item sprite/icon
  imageUrl?: string;           // Resolved locally
  scale: number;               // Default 1.0
  rotation?: number;
  renderOrder?: number;
  // Illumination
  illuminationPreset?: IlluminationPreset; // null = no light
  // Item data
  material?: string;           // e.g., "Iron", "Oak", "Enchanted Crystal"
  durability?: number;         // 0–100, null = indestructible
  resistances?: string[];      // e.g., ["fire", "physical"]
  actions?: ItemAction[];      // interactable actions
  features?: ItemFeature[];    // descriptive rules text
  // Container
  isContainer: boolean;
  inventory?: string[];        // child Item IDs
  maxCapacity?: number;
  // State
  isHidden: boolean;
  isPickedUp: boolean;         // True when carried by a token
  carriedByTokenId?: string;   // Token currently carrying this item
}
```

### Supporting Types
```ts
interface ItemAction {
  id: string;
  name: string;
  description: string;
  // Future: formula expression (see STEP-009)
}

interface ItemFeature {
  id: string;
  name: string;
  description: string;
}
```

---

## Phase 2: Replace LightSource with itemStore

> ✅ **RESOLVED — No backward compatibility required.** The app has not been distributed; test data will be purged. `lightStore` and `JazzIlluminationSource` are deleted outright and replaced by `itemStore` and `JazzItem`.

1. Delete `lightStore.ts` and all `JazzIlluminationSource` references
2. Create `itemStore.ts` modeled after `mapObjectStore.ts`
3. Create `JazzItem` CoValue schema in Jazz bridge
4. Update bridge subscriptions: wire `itemStore` → Jazz and Jazz → `itemStore`
5. Update Canvas Entity table in `docs/Names.md`: `LightSource` → `CanvasItem`

---

## Phase 3: Pick Up Mechanic

**Trigger:** DM or Player right-clicks Item → "Pick Up" context menu action  
**Flow:**
1. Check: Is item on same map as the picking token? Is it adjacent (within 1 grid cell)?
2. User selects which token picks it up (if player controls multiple)
3. Item `isPickedUp = true`, `carriedByTokenId = tokenId`
4. If Item has `illuminationPreset`: copy preset into `token.illuminationSources`
5. Item is removed from map rendering (stays in store, but hidden)
6. Token sheet shows carried items in Inventory section
7. Ephemeral broadcast: `item_picked_up` → all clients update

**Drop item:** Token right-click → "Drop [Item Name]"  
1. Item placed at token's current position, `isPickedUp = false`
2. Token's illumination source derived from the item is removed
3. Item re-renders on map

---

## Phase 4: Container / Loot System

- Containers show a loot dialog when interacted with
- Loot dialog lists child Items → player clicks "Take" per item
- "Take All" option
- Loot can be distributed: "Give to [token]" 
- Empty containers remain on map (optional: auto-remove setting)

---

## Phase 5: Item Edit UI

- Click Item → opens Item Sheet panel (drawer or modal)
- Tabs: Overview, Illumination, Actions/Features, Inventory (if container)
- Illuminate tab → reuses `TokenIlluminationModal` component directly
- Actions tab → simple list editor (name + description for MVP)

---

## Jazz Schema

```ts
class JazzItem extends CoMap {
  id!: string;
  name!: string;
  mapId!: string;
  positionJson!: string;        // JSON { x, y }
  illuminationPresetJson!: string | null;
  itemDataJson!: string;        // Full CanvasItem JSON
  isPickedUp!: boolean;
  carriedByTokenId!: string | null;
}
```

---

## Outstanding Questions for User Review

1. ~~**Light Source migration:**~~ ✅ **RESOLVED** — No backward compatibility required. App has never shipped outside dev; test data will be purged. `lightStore` and `LightSource` type are deleted outright and replaced by `itemStore` / `CanvasItem`.

2. **Pick up range:** Should pick-up require the token to be adjacent to the item, or can any token on the same map pick up any item regardless of distance?

3. **Item rendering:** Items are described as sprite/icon based. Should they default to a specific icon (torch, chest, etc.) by category, similar to Map Object presets? What categories of Items should exist at launch (Light Source, Container, Weapon, Armor, Consumable, Miscellaneous)?

4. **Token carries multiple items:** Can a token carry multiple items at once? If so, are their illumination effects summed, or does only the "held" item's illumination apply?

5. **Player access:** Can players place new Items on the map, or is Item placement DM-only?

6. **Item sheet vs. full character sheet:** The Item data sheet is described as a subset of the character sheet from STEP-009. Should we wait for STEP-009 to define the schema before building Item sheets, or start with a simpler independent schema and migrate later?

---

## Dependencies
- **STEP-002** (Merge Lighting Models) — Item illumination uses the unified system
- **STEP-009** (Generic Token Schema) — Item data sheet schema borrows from the generic creature schema
- **STEP-005** (Canvas Redraw) — Pick up and drop need `forceRedraw()`

---

## Execution Order
STEP-002 → STEP-009 (partial, schema only) → STEP-007
