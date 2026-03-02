# Auto-Focus Follows Active Token

## Overview
When enabled, the map focus automatically switches to follow the active initiative token when it moves to a different map (via portal teleportation or manual mapId reassignment).

## Implementation

### Toggle
- `autoFocusFollowsToken` boolean in `mapStore` (persisted, default `false`)
- UI toggle added to `MapFocusSettings.tsx` as "Auto-focus follows turn"

### Behavior
1. **Initiative turn change**: A `useEffect` in `SimpleTabletop.tsx` watches `currentTurnIndex`, `initiativeOrder`, and `tokens`. When the active token's `mapId` differs from `selectedMapId`, it auto-activates the target map (if inactive) and switches focus.
2. **Portal teleportation**: The portal teleport handler in `SimpleTabletop.tsx` now also checks `autoFocusFollowsToken` (in addition to `portalAutoActivateTarget`) to decide whether to switch focus after cross-map teleport.

### Files Modified
- `src/components/SimpleTabletop.tsx` — useEffect for auto-focus + portal teleport update
- `src/components/MapFocusSettings.tsx` — Toggle UI
- `src/lib/version.ts` — 0.5.31
