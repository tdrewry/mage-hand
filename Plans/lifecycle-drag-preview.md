# Lifecycle-Based Drag/Placement Previews

## v0.7.155 → v0.7.156: Lifecycle semantics
Switched from TTL-based expiry to explicit lifecycle (begin/update/end). TTL set to 0 for lifecycle-managed ops.

## v0.7.160: Unified Drag Model

### Problem
Remote drag previews rendered as simplified colored circles via a parallel pipeline (`drawRemoteDragPreviews`), while the actual token sprite stayed frozen at its pre-drag position. The 10Hz `token.position.sync` skipped tokens with active drag previews, so the real sprite never moved during a remote drag.

### Solution
In `token.drag.update` handler, also call `updateTokenPosition()` so the real token sprite moves in the session store — exactly like a local drag. The normal render pipeline draws the full token (texture, name, auras, status rings) at the drag position.

Simplified `drawRemoteDragPreviews` to only render supplementary decoration:
- Ghost circle at **start** position (origin marker)
- Movement trail polyline
- Dashed distance line from start → current
- Username label

Removed the redundant ghost circle and border ring at the current drag position — the real token sprite is already there.

### Changes
- `src/lib/net/ephemeral/tokenHandlers.ts` — `token.drag.update` handler now calls `updateTokenPosition()`
- `src/components/SimpleTabletop.tsx` — removed current-position ghost circle/ring from `drawRemoteDragPreviews`
- `src/lib/version.ts` — bumped to 0.7.160

### Impact on External Services
None — all client-side rendering changes. WebSocket server and Jazz unaffected.
