# Map Hydrator Phantom Blank Map Fix (v0.7.109)

## Problem
1. **Phantom blank maps on reload/sync**: Every time the maps blob was hydrated (session join, reconnect, or DM push), the hydrator called `removeMap()` in a loop. The `removeMap` invariant auto-creates a new blank map when the last map is deleted, injecting a phantom map before the real maps were restored.
2. **selectedMapId not following DM**: While `selectedMapId` was included in the blob extractor, the hydrator used `store.setSelectedMap()` which could be overridden by the phantom map's creation or by the post-hydration fallback logic.

## Root Cause
The maps hydrator used `store.removeMap(m.id)` to clear existing maps before restoring. The always-one-map invariant in `removeMap()` fires when the last map is removed, creating a default blank map. This blank map persisted alongside the restored maps.

## Fix
Replaced the remove-then-restore loop with an atomic `useMapStore.setState()` call that directly replaces `maps`, `structures`, and `selectedMapId` in a single update. This bypasses the `removeMap` invariant entirely and ensures:
- No phantom blank maps are created during hydration
- `selectedMapId` is set atomically with the map data
- Fog settings are initialized for all incoming maps
- If no maps arrive (edge case), the existing local maps are preserved

## Files Changed
- `src/lib/durableObjectRegistry.ts` — atomic map hydrator using setState
- `src/lib/version.ts` — bumped to 0.7.109

## Impact
- **Jazz service**: No restart needed
- **WebSocket server**: No impact
