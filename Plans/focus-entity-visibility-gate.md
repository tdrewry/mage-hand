# Non-Focused Map Entity Visibility Fix (v0.7.110)

## Problem
When map focus effects (blur/opacity) were active, entities from non-focused but still active maps (doors, portals, annotations, water) bled through and appeared on the focused map. The focus system only applied visual dimming via canvas opacity/blur, but entities were still included in the render and hit-test pipelines.

## Root Cause
`useActiveMapFilter` only checked `map.active` status when building the entity filter predicate. When focus effects were active, all active maps' entities passed the filter. The dim/blur was applied per-entity during rendering, but entities were still visible (just faded).

## Fix
Updated `useActiveMapFilter` to be focus-aware:
- When focus effects are active (`unfocusedOpacity < 1` or `unfocusedBlur > 0`), the `isEntityVisible` predicate restricts to only the `selectedMapId`
- Non-focused map entities are completely excluded from `filteredTokens`, `filteredMapObjects`, and `filteredRegions`
- Effects were already correctly filtered by `selectedMapId` in the render loop

## Files Changed
- `src/hooks/useActiveMapFilter.ts` — added focus-aware filtering using `useMapFocusStore`
- `src/lib/version.ts` — bumped to 0.7.110

## Impact
- **Jazz service**: No restart needed
- **WebSocket server**: No impact
