

# Sync Fix Plan — Regions, MapObjects, Effects Disappearing

## Issues Identified

### Issue 1: Token pull guard blocks joiners incorrectly
`pullTokensFromJazz` (line 1023) blocks the pull unconditionally when Jazz has 0 tokens but local has >0. Unlike regions/mapObjects/effects, it does NOT check `_isCreator`. This means if a joiner has stale localStorage tokens and Jazz hasn't propagated yet, the pull is blocked — but more critically, if Jazz genuinely has 0 tokens (empty session), the joiner can never clear their stale tokens.

**Fix**: Add `&& _isCreator` to the guard, matching the pattern used by regions, mapObjects, and effects.

### Issue 2: Push functions append without deduplication
`pushRegionsToJazz`, `pushMapObjectsToJazz`, and `pushEffectsToJazz` always append new entries to Jazz CoLists without checking for existing IDs. Only `pushTokensToJazz` has upsert logic. This causes duplicate entities to accumulate in Jazz when:
- `pushAllToJazz` is called at session create, then the outbound subscription fires
- "Sync to Players" calls `pushAllToJazz` again
- Session file load triggers clear→repopulate, and the trailing-edge throttle fires the repopulate push which appends to a CoList that still has stale entries from before the clear

**Fix**: Add upsert logic to `pushRegionsToJazz`, `pushMapObjectsToJazz`, and `pushEffectsToJazz` — check for existing IDs before appending, update in-place if found.

### Issue 3: Outbound region/mapObject diff uses potentially stale `capturedPrev`
The trailing-edge throttle correctly stores the latest closure, but when multiple rapid store changes occur, the final closure's `capturedPrev` only reflects the state from the penultimate change — not the state from the start of the throttle window. This can cause the diff to miss earlier additions or removals.

**Fix**: Track `prevRegions`/`prevMapObjects` at the bridge level (already done), but update it **only when the throttle actually fires**, not on every store change. Move the `prevRegions = regions` assignment inside the throttled function.

### Issue 4: Inbound Jazz→Zustand subscription for regions/mapObjects fires during initial push echo
When the creator calls `pushAllToJazz` → `startBridge`, the Jazz subscription may fire with the just-pushed data, triggering `runFromJazz` store updates that then trigger outbound subscriptions. The `_fromJazz` flag prevents outbound echo, but the inbound subscription can still fire with partial/stale data during the initial propagation window.

**Fix**: Add a short startup grace period (`_bridgeStartedAt`) that suppresses inbound subscription handling for the creator during the first ~2 seconds after bridge start.

## Files to Change

| File | Change |
|------|--------|
| `src/lib/jazz/bridge.ts` | Fix token pull guard; add upsert to push functions; fix prev tracking in outbound subscriptions; add startup grace period |
| `src/lib/version.ts` | Bump to 0.7.92 |
| `Plans/map-sync-fix.md` | New plan doc |

## Technical Detail

### Token pull guard fix (line 1023)
```typescript
// Before:
if (len === 0 && localTokenCount > 0) {
// After:
if (len === 0 && localTokenCount > 0 && _isCreator) {
```

### Push upsert pattern (regions example)
```typescript
export function pushRegionsToJazz(sessionRoot: any): void {
  // ... existing setup ...
  // Build set of existing Jazz region IDs
  const existingIds = new Set<string>();
  const len = jazzRegions.length ?? 0;
  for (let i = 0; i < len; i++) {
    if (jazzRegions[i]?.regionId) existingIds.add(jazzRegions[i].regionId);
  }

  for (const r of regions) {
    if (existingIds.has(r.id)) {
      // Upsert existing
      for (let i = 0; i < len; i++) {
        const jr = jazzRegions[i];
        if (jr?.regionId === r.id) {
          const init = regionToJazzInit(r);
          for (const [key, val] of Object.entries(init)) {
            if (key !== 'regionId') jr.$jazz.set(key, val ?? undefined);
          }
          break;
        }
      }
    } else {
      // Create new
      const jr = JazzRegionSchema.create(regionToJazzInit(r), group);
      jazzRegions.$jazz.push(jr);
    }
  }
}
```

### Outbound prev tracking fix
```typescript
// Move prevRegions update INTO the throttled function, not at subscription time
let prevRegions = useRegionStore.getState().regions;
const unsubRegionsZustand = useRegionStore.subscribe((state) => {
  const regions = state.regions;
  if (regions === prevRegions) return;
  if (_fromJazz) { prevRegions = regions; return; }
  // DON'T update prevRegions here — let the throttled fn do it
  throttledPushFineGrained('regions', () => {
    const currentRegions = useRegionStore.getState().regions;
    syncRegionsToJazz(currentRegions, prevRegions);
    prevRegions = currentRegions;
  });
});
```

### Startup grace period
```typescript
let _bridgeStartedAt = 0;
const STARTUP_GRACE_MS = 2000;

// In inbound Jazz→Zustand subscriptions (creator only):
if (_isCreator && Date.now() - _bridgeStartedAt < STARTUP_GRACE_MS) {
  console.log(`[jazz-bridge] Skipping inbound ${kind} during startup grace`);
  return;
}
```

## Impact on External Services
No impact on the WebSocket server or Jazz service — all changes are client-side bridge logic.

