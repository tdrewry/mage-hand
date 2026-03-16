# Jazz Token Drag Race Condition Fix

## Problem
Token movement over Jazz was erratic — tokens would snap back to pre-drag positions after being released. This didn't happen with OpBridge because durable ops are applied synchronously.

## Root Cause
In `markTokenDragEnd`, the token was removed from `_localDragTokens` **before** the final position was pushed to Jazz. This created a race window where:
1. Token removed from drag suppression set
2. Stale Jazz CRDT position (from before/during drag) arrives in inbound subscription
3. Stale position applied to Zustand → visible snap-back
4. Final position push arrives later but the damage is done (or causes another update)

## Solution (v0.7.71)

### 1. Push-before-unmark
`markTokenDragEnd` now pushes the final position to Jazz **before** removing the token from the suppression set, ensuring the authoritative position is committed first.

### 2. Post-drag grace period (600ms)
After drag end, the token moves from `_localDragTokens` to a `_dragGraceTokens` set for 600ms. During this window, inbound Jazz position updates are still suppressed, giving the final position time to round-trip through the Jazz CRDT.

### 3. Unified suppression check
A new `_isPositionSuppressed(tokenId)` helper checks both active drags and grace period tokens, used by the inbound Jazz→Zustand subscription.

## Files Changed
- `src/lib/jazz/bridge.ts` — Reordered push/unmark, added grace period, unified suppression check
- `src/lib/version.ts` — 0.7.71
