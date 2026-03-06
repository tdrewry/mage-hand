# Jazz Bridge Destructive Hydration Fix

## Problem
When a DM creates a Jazz session, the bridge's inbound Jazz→Zustand subscriptions can fire with empty/stale data before Jazz has fully propagated the DM's pushed state. This causes:
1. `pullTokensFromJazz` removes all local tokens first, then adds from Jazz — if Jazz list is empty, everything is wiped
2. Blob hydration replaces populated stores with empty deserialized state
3. The canvas appears blank even though tokens still exist in the initiative panel (different data path)

## Root Cause
Jazz CRDT propagation is async. After `pushAllToJazz()` + `startBridge()`, the inbound subscription fires before the push has round-tripped through Jazz, delivering empty lists that overwrite the DM's populated stores.

## Solution (v0.7.42)

### 1. Creator-awareness flag
- `startBridge(root, isCreator)` now accepts an `isCreator` boolean
- Creator = session host (DM), who is the source of truth for initial state
- The creator's local tokens are never removed by inbound Jazz sync (Jazz may not have propagated yet)

### 2. Empty-state hydration guards (creator-only, v0.7.43)
- Guards now **only apply to the creator/DM** — joiners always accept Jazz inbound data
- `pullTokensFromJazz`: Skips if Jazz has 0 tokens but local has >0 (creator only)
- `pullBlobFromJazz`: Skips if inbound blob state is empty but local has data (creator only)
- Live token subscription: Same empty guard + creator won't have tokens removed
- **Joiners**: Jazz is the source of truth; stale localStorage data is correctly overwritten

### 3. `isEmptyState()` heuristic
Checks if a state value is null, empty array, or an object with only empty/falsy values — used to detect destructive hydration attempts.

## Files Changed
- `src/lib/jazz/bridge.ts` — Added `_isCreator` flag, `isEmptyState()`, guards on all inbound paths
- `src/lib/jazz/session.ts` — Pass `isCreator=true` for create, `false` for join
- `src/lib/version.ts` — 0.7.42
