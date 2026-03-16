# Portal System & Map Focus Architecture

## Overview
Four interconnected features that enable multi-floor dungeon navigation with portal teleportation, map focus management, and structural map relationships.

---

## Feature 1: Portal Map Object Type

### Data Model
- New `MapObjectCategory`: `'portal'`
- New `MapObjectShape`: `'portal'`
- New fields on `MapObject`:
  - `portalName?: string` — Display name for the portal
  - `portalTargetId?: string` — ID of linked portal MapObject
  - `portalHiddenInPlay?: boolean` — Hidden from players in play mode
  - `portalAutoActivateTarget?: boolean` — Off by default; when on, activating this portal auto-activates target map and sets focus

### Portal Creation
- Any **region** can be "converted" to a portal via context menu or UI action
  - Creates a new MapObject of category `portal` using the region's bounds/position
  - Region is optionally kept or removed (user choice)
- Portals can also be created directly from the map object creation flow

### Visual Rendering
- Region keeps its shape but gets:
  - A portal icon badge (centered)
  - A colored border (distinct portal color, e.g., purple/cyan glow)
  - Portal name label rendered near the badge
  - Linked portals share a visual indicator (matching color or line)

### Teleportation Behavior
- On token drag-end, check if drop position intersects a portal with a valid `portalTargetId`
- If yes:
  1. Brief fade-out animation (~300ms) on source token
  2. Reassign token's `mapId` to target portal's `mapId`
  3. Set token position to target portal's center
  4. If target map is inactive:
     - Token becomes hidden/inactive (not rendered)
     - If `portalAutoActivateTarget` is true:
       - Activate target map
       - Set target map as focused (`selectedMapId`)
  5. Toast notification: "Token teleported to [portal name]"

### Portal Linking UI
- Portal panel (in MapObjectControlBar or a modal) shows:
  - Portal name input
  - Dropdown of all other portals (grouped by map) to select target
  - Toggle: "Hidden in play mode"
  - Toggle: "Auto-activate target map" (off by default)

---

## Feature 2: Map Focus Blur/Fade

### Behavior
- Non-focused active maps are visually dimmed/blurred
- User-configurable slider controlling:
  - Opacity reduction (0–80%)
  - Gaussian blur amount (0–8px)
- Default: 0% (off) — no dimming until user enables it

### Implementation
- Add to `mapStore` or a new `mapFocusStore`:
  - `unfocusedOpacity: number` (0–1, default 1.0 = no dimming)
  - `unfocusedBlur: number` (0–8, default 0 = no blur)
- In the rendering pipeline (`SimpleTabletop.tsx`):
  - Apply CSS filter/opacity to canvas layers for maps whose `id !== selectedMapId`
  - Or use PixiJS alpha/blur filters on the post-processing layer
- Settings UI: Add a "Map Focus" section in the Map Controls card or a new settings area
  - Slider: "Non-focused map opacity" (0%–100%)
  - Slider: "Non-focused map blur" (0px–8px)

---

## Feature 3: Focus-Based Selection Locking

### Behavior
- Entities (tokens, map objects, annotations, regions) on a non-focused map cannot be selected
- Click/drag interactions pass through non-focused content
- Focus must be returned to a map before its entities become interactive

### Implementation
- In hit-testing logic (`SimpleTabletop.tsx`):
  - Before checking entity interaction, verify `entity.mapId === selectedMapId` (or `mapId === undefined` for legacy)
  - Skip hit-test for entities on non-focused maps
- Visual cue: Non-focused entities already dimmed via Feature 2
- Map Tree: Clicking an entity in the tree for a non-focused map should auto-switch focus to that map

---

## Feature 4: Map Relationships (Floors/Structures)

### Data Model
- New field on `GameMap`:
  - `structureId?: string` — Groups maps into a structure (e.g., "Wizard's Tower")
  - `floorNumber?: number` — Linear ordering within a structure (1, 2, 3...)
- New store or extension to `mapStore`:
  - `structures: Structure[]`
  - `Structure = { id: string; name: string; }`

### Behavior
- Maps in a structure have:
  - Explicit floor ordering (Up/Down navigation)
  - Portal connections between any maps (not just adjacent floors)
- Map Tree groups maps by structure with floor labels
- Auto-determination: When active token is on a specific floor, that floor's map gains focus
  - Optional toggle: "Auto-focus follows active token"

### UI
- Structure management in Map Manager or Map Tree context menu:
  - "Assign to Structure" → select/create structure
  - "Set Floor Number" → numeric input
  - "Remove from Structure"
- Floor navigation widget (small up/down arrows) appears when a structure is active

---

## Implementation Order

1. **Phase 1**: Portal data model + MapObject preset + basic rendering
2. **Phase 2**: Teleportation logic in SimpleTabletop drag-end handler
3. **Phase 3**: Portal linking UI (modal or panel)
4. **Phase 4**: Map focus blur/fade (store + rendering + settings UI)
5. **Phase 5**: Focus-based selection locking (hit-test filtering)
6. **Phase 6**: Map relationship data model + Map Tree integration
7. **Phase 7**: Floor navigation widget + auto-focus behavior

---

## Files to Modify

- `src/types/mapObjectTypes.ts` — Portal category, shape, fields
- `src/stores/mapStore.ts` — Structure fields, focus settings
- `src/stores/mapObjectStore.ts` — Portal-aware queries
- `src/components/SimpleTabletop.tsx` — Teleport logic, blur/fade, selection locking
- `src/components/cards/MapTreeCard.tsx` — Structure grouping, portal context menu
- `src/components/cards/MapObjectPanelCard.tsx` — Portal linking UI
- `src/lib/mapObjectRenderer.ts` — Portal visual rendering
- `src/lib/version.ts` — Version bump
