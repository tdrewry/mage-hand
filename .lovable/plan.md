

# Token Drag Network Coherence Fix

## Problem

When a remote user drags a token, the observing client's token ghost flashes or vanishes. Two root causes:

1. **Jazz inbound position sync fights ephemeral drag position.** The `_isPositionSuppressed()` check in the Jazz bridge only guards **locally** dragged tokens. On the **observer** client, the token is **remotely** dragged — Jazz subscription callbacks keep arriving with stale CRDT positions and trigger `setTokens()`, causing re-renders that momentarily override the `remoteDrags[token.id].pos` visual override in the renderer.

2. **Non-position "false positive" changes during drag trigger texture re-resolution.** The deep-compare loop in the Jazz inbound subscription detects `hasNonPosChange` (e.g., parsed `illuminationSources` or `extras` JSON instability) even when nothing meaningful changed, causing `tokensChanged = true` → `store.setTokens()` → full token array replacement → canvas re-render that resets visual state mid-drag.

Additionally, the **outbound** Zustand→Jazz subscription on the **dragger's** client pushes position changes into the CRDT at the throttle rate, causing the observer's Jazz subscription to fire repeatedly with intermediate positions — creating a double-update path (ephemeral + durable) for the same drag.

## Solution

### 1. Suppress inbound Jazz position for remotely-dragged tokens (observer side)

In `bridge.ts` Jazz→Zustand inbound subscription, extend `_isPositionSuppressed()` to also check `useRemoteDragStore.getState().drags[tokenId]`. If a token has an active remote drag entry, suppress inbound Jazz position updates for that token — same as we do for locally dragged tokens.

```
function _isPositionSuppressed(tokenId: string): boolean {
  return _localDragTokens.has(tokenId) 
    || _dragGraceTokens.has(tokenId)
    || !!useRemoteDragStore.getState().drags[tokenId];
}
```

### 2. Suppress outbound position push to Jazz during active drag (dragger side)

The existing fast-path bail-out (lines 2157-2175) already skips Jazz writes for position-only changes on dragged tokens. Verify this path is robust and also ensure that `tokenToJazzInit()` doesn't push position during active drag in the per-field update loop (lines 2240-2256). Add an explicit `isBeingDragged` guard that skips writing `x`/`y` fields to the Jazz CoMap during drag.

### 3. Stabilize non-position change detection to avoid false-positive re-renders

The JSON.stringify deep-compare in the inbound subscription (lines 2354-2367) can produce false positives from field ordering or floating-point serialization differences. Add a short-circuit: if a token has an active remote drag, skip non-critical metadata re-merge entirely (only process imageHash changes). This prevents unnecessary `setTokens()` calls during drag that cause canvas flicker.

### 4. Add remote drag grace period on observer side

When `token.drag.end` clears the remote drag entry, add a short suppression window (similar to the local 600ms grace) so that stale Jazz positions arriving in the lag window after drag commit don't cause snap-back on the observer.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/jazz/bridge.ts` | Import `useRemoteDragStore`. Extend `_isPositionSuppressed()` to check remote drags. Add remote-drag-aware guard in inbound token merge loop. Skip `x`/`y` field writes to Jazz CoMap during active local drag. Add post-remote-drag grace suppression. |
| `src/stores/remoteDragStore.ts` | Add `recentlyEndedDrags` map with timestamps + `isRecentlyEnded(tokenId)` helper for grace period. |
| `src/lib/net/ephemeral/tokenHandlers.ts` | On `token.drag.end`, populate `recentlyEndedDrags` with timestamp instead of immediately clearing. |
| `src/lib/version.ts` | Version bump. |
| `Plans/token-drag-coherence-fix.md` | Save this plan. |

## Impact on External Services

This change is purely client-side logic. No WebSocket server or Jazz service restart required. The ephemeral bus message shapes are unchanged.

## Technical Details

```text
DRAGGER CLIENT (local drag)          OBSERVER CLIENT (remote drag)
─────────────────────────            ─────────────────────────────
markTokenDragStart(id)               ephemeral: token.drag.begin
  → _localDragTokens.add(id)          → remoteDragStore.beginDrag(id)
  → suppresses outbound Jazz pos       → NEW: _isPositionSuppressed(id) = true
  → suppresses inbound Jazz pos        → suppresses inbound Jazz pos ✅

ephemeral: token.drag.update         ephemeral: token.drag.update
  → broadcast pos+path                  → remoteDragStore.updateDrag(id)
  → 10Hz position sync SKIPS id         → renderer uses remoteDrags[id].pos

markTokenDragEnd(id)                 ephemeral: token.drag.end
  → push final pos to Jazz              → remoteDragStore → grace period
  → grace period (600ms)                → NEW: suppress Jazz pos for 600ms
  → _localDragTokens.delete(id)         → then clear → Jazz pos accepted
```

