# Auto-Focus Follows Active Token

## Overview
When enabled, the map focus automatically switches to follow the active initiative token when it moves to a different map (via portal teleportation or manual mapId reassignment). The viewport also centers on the token after the map switch.

## Implementation

### Toggle
- `autoFocusFollowsToken` boolean in `mapStore` (persisted, default `false`)
- UI toggle added to `MapFocusSettings.tsx` as "Auto-focus follows turn"

### Behavior
1. **Initiative turn change**: A `useEffect` in `SimpleTabletop.tsx` watches `currentTurnIndex`, `initiativeOrder`, and `tokens`. When the active token's `mapId` differs from `selectedMapId`, it auto-activates the target map (if inactive), switches focus, and centers the viewport on the token via `requestAnimationFrame`.
2. **Portal teleportation**: The portal teleport handler in `SimpleTabletop.tsx` also centers the viewport on the target portal position after switching focus.

### Files Modified
- `src/components/SimpleTabletop.tsx` — useEffect for auto-focus + viewport centering + portal teleport update
- `src/components/MapFocusSettings.tsx` — Toggle UI
- `src/lib/version.ts` — 0.5.32
