# STEP-004 — Region Texture Sync for Late-Joining Clients

## Overview

**Bug:** When a client connects to a session where the host has already loaded map content, region geometry syncs correctly via Jazz CRDT, but **art assets (textures/background images) do not stream** to the client. Late-joining clients see empty/untextured regions.

**Root Cause:** Textures are stored in IndexedDB locally (not in Jazz). The Jazz schema stores an `imageHash` (a content hash of the texture). The bridge's `_resolveRegionTextures` function resolves hashes → image data — but it only runs when the Jazz→Zustand subscriber fires a change, not on initial join.

---

## How Texture Sync Works (Current)

```
Host:
  Region created → imageHash stored in Jazz
  Texture binary → stored in JazzBlob / textureSync system

Client (bridge starts):
  Jazz inbound subscriber fires for each region
  → jazzToZustandRegion(jr) extracts imageHash
  → If imageHash present, push to regionsNeedingTextureResolve[]
  → _resolveRegionTextures([{ id, hash }]) → fetches from Jazz binary
```

**The gap:** `_resolveRegionTextures` may not be triggered for regions that are **unchanged** (no delta) since the client joined. If the Jazz subscriber fires during bridge startup and regions haven't changed since the host loaded them, the `hasEntityChanges` check may return false (no diff from Jazz state to Zustand empty state), short-circuiting texture resolution.

**Also:** The texture binary itself may not be pushed to Jazz if the host loaded textures from disk but didn't explicitly trigger a binary push for regions that were already on the map when the Jazz bridge started.

---

## Fix Strategy

### Fix 1: Force texture resolution on bridge startup for all regions
In `wireSubscriptions` (bridge.ts), after wiring region subscriptions, run a one-shot startup pass:

```ts
// After Jazz region subscription is set up:
setTimeout(() => {
  const localRegions = useRegionStore.getState().regions;
  const needsResolve = localRegions
    .filter(r => r.textureHash && !r.backgroundImage)
    .map(r => ({ id: r.id, hash: r.textureHash! }));
  if (needsResolve.length > 0) {
    console.log(`[jazz-bridge] 🎨 Startup: resolving ${needsResolve.length} region textures`);
    _resolveRegionTextures(needsResolve);
  }
}, 500); // Allow initial Jazz sync to complete first
```

### Fix 2: Always queue texture resolve in Jazz→Zustand subscriber (not just when hasEntityChanges)
Currently the subscriber skips `regionsNeedingTextureResolve.push` if `!_hasEntityChanges`. Change to always check if texture needs resolving regardless of other changes:

```ts
// For both changed and unchanged regions:
if (!existing.backgroundImage && existing.textureHash) {
  regionsNeedingTextureResolve.push({ id: existing.id, hash: existing.textureHash });
}
```
*(This is already partially done — verify it's hit on initial join)*

### Fix 3: Ensure texture binary push happens when a new client connects
In the host's `connectedUsers` subscriber (or JazzTransport `onPresenceSync`), when a new client connects, trigger `pushTexturesToJazz(sessionRoot)` to ensure all texture binaries are available in Jazz.

```ts
// In JazzTransport or bridge wireSubscriptions, when a new userId appears in connectedUsers:
onNewClientConnected(() => {
  pushTexturesToJazz(_sessionRoot).catch(err => {
    console.warn('[jazz-bridge] Failed to push textures on client connect:', err);
  });
});
```

---

## Files to Modify

- `src/lib/jazz/bridge.ts` — startup texture resolution pass, always-resolve logic in Jazz→Zustand subscriber
- `src/lib/net/transports/JazzTransport.ts` — trigger texture push on new client connection
- `src/lib/jazz/textureSync.ts` — verify `pullTextureFromJazz` handles initial null states

---

## Outstanding Questions for User Review

1. **Texture push timing:** Pushing all textures when any new client connects may be expensive for sessions with many regions. Should we limit this to textures where `imageHash` exists in Jazz but the binary is not yet confirmed present? (Jazz binary presence check)
2. **Map Object textures:** Do map objects with custom textures have the same issue? The fix should be consistent — apply to all entity types with `imageHash` fields.
3. **Token textures on join:** Are token textures (character art) also missing for late-joining clients? This would indicate the issue is systemic rather than region-specific.

---

## Verification
1. Host creates session, loads a map with textured regions
2. Client joins (late) → verify all regions show correct textures within 2–3 seconds of join
3. Host adds a new textured region after client is connected → verify client receives both geometry and texture
4. Test with a large texture (>500KB) — verify no timeout
