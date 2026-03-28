# Token Drag Network Coherence Fix

## Problem
When a remote user drags a token, the observing client's token ghost flashes or vanishes due to:
1. Jazz inbound position sync fighting ephemeral drag position on observers
2. Non-position false-positive changes during drag triggering texture re-resolution
3. Double-update path (ephemeral + durable) from dragger's outbound Jazz position writes

## Solution (v0.7.618)

### 1. Extended `_isPositionSuppressed()` to check remote drags
Now checks `useRemoteDragStore.getState().isRemoteDragSuppressed(tokenId)` so observer clients suppress stale Jazz position updates during remote drags.

### 2. Suppressed outbound x/y writes to Jazz during active local drag
Added `isBeingDragged` guard in the per-field CoMap update loop to skip `x`/`y` fields, preventing intermediate positions from being pushed to Jazz during drag.

### 3. Stabilized non-position change detection during remote drag
During active remote drag, inbound metadata merge only processes `imageHash` changes — all other metadata is deferred to avoid false-positive `setTokens()` calls from JSON instability.

### 4. Remote drag grace period on observer side
`remoteDragStore.endDrag()` now moves tokens to a `recentlyEndedDrags` map for 600ms before fully clearing suppression, matching the local drag grace period behavior.

## Files Changed
- `src/lib/jazz/bridge.ts` — Import remoteDragStore, extend suppression, guard outbound x/y, stabilize inbound metadata
- `src/stores/remoteDragStore.ts` — Added `recentlyEndedDrags`, `isRemoteDragSuppressed()`, grace period in `endDrag()`
- `src/lib/version.ts` — 0.7.618
- `Plans/token-drag-coherence-fix.md` — This plan

## Impact on External Services
None — purely client-side logic changes. No server restart required.
