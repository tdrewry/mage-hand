# Map Sync Fix — Regions, MapObjects, Effects Disappearing (v0.7.92)

## Problem
When a host loads a .mhsession file (or imports JSON/DOMH) while connected to a tandem session with a client, regions, map objects, and effects load momentarily then disappear. Only tokens survive.

## Root Causes

### 1. Token pull guard blocks joiners incorrectly
`pullTokensFromJazz` blocked the pull unconditionally when Jazz had 0 tokens but local had >0, without checking `_isCreator`. Joiners with stale localStorage could never clear their tokens.

### 2. Push functions append without deduplication
`pushRegionsToJazz`, `pushMapObjectsToJazz`, and `pushEffectsToJazz` always appended to Jazz CoLists without checking for existing IDs. Only `pushTokensToJazz` had upsert logic.

### 3. Outbound prev tracking used stale state
The trailing-edge throttle captured `prevRegions`/`prevMapObjects` at subscription time (each store change), not at the time the throttled function actually fired. This caused the diff to use wrong baselines.

### 4. Inbound Jazz subscriptions fire during initial push echo
When the creator called `pushAllToJazz` → `startBridge`, Jazz subscriptions could fire with partial/stale data during the initial propagation window, overwriting the creator's populated stores.

## Fixes Applied

### Token pull guard (Issue 1)
Added `&& _isCreator` to the empty-state guard in `pullTokensFromJazz`.

### Upsert logic (Issue 2)
Added ID-based upsert to `pushRegionsToJazz`, `pushMapObjectsToJazz`, and `pushEffectsToJazz` — check for existing IDs before appending, update in-place if found.

### Outbound prev tracking (Issue 3)
Moved `prevRegions`/`prevMapObjects` assignment INTO the throttled callback. The subscription no longer updates prev — only the throttled function does, ensuring the diff baseline matches the actual last-pushed state.

### Startup grace period (Issue 4)
Added `_bridgeStartedAt` timestamp and `STARTUP_GRACE_MS` (2s). Inbound Jazz→Zustand subscriptions for regions, mapObjects, and effects are suppressed for the creator during this window.

## Files Changed
- `src/lib/jazz/bridge.ts` — All four fixes
- `src/lib/version.ts` — 0.7.92
- `Plans/map-sync-fix.md` — This plan

## Impact on External Services
No impact on the WebSocket server or Jazz service — all changes are client-side bridge logic.
