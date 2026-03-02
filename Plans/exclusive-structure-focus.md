# Exclusive Focus Mode for Structures

## Overview
Structures gain an optional "exclusive focus" toggle. When enabled, only the currently focused map within the structure is active — all sibling maps are deactivated. This prevents compound rendering of multi-floor structures when only one floor should be visible at a time.

## Implementation

### Data Model
- `Structure.exclusiveFocus?: boolean` added to `mapStore.ts`
- New action `setStructureExclusiveFocus(structureId, value)` toggles the flag and immediately enforces deactivation if enabling

### Enforcement Points
1. **`setSelectedMap`** — after setting `selectedMapId`, checks if the new map belongs to a structure with `exclusiveFocus`. If so, deactivates all other maps in that structure and activates the focused one.
2. **`navigateFloor`** — when exclusive, sets `active: m.id === target.id` for all structure maps in a single `set()` call.
3. **`setStructureExclusiveFocus`** — on enable, immediately deactivates non-focused siblings.

### UI
- Eye icon button added to structure header row in `MapTreeCard.tsx`, highlighted with `text-primary` when active. Tooltip explains state.

### Files Modified
- `src/stores/mapStore.ts` — Structure interface, setSelectedMap, navigateFloor, new action
- `src/components/cards/MapTreeCard.tsx` — toggle button in structure header
- `src/lib/version.ts` — 0.5.40
