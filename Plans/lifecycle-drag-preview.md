# Lifecycle-Based Drag/Placement Previews

## v0.7.155 → v0.7.156: Lifecycle semantics
Switched from TTL-based expiry to explicit lifecycle (begin/update/end). TTL set to 0 for lifecycle-managed ops.

## v0.7.160: Unified Drag Model

### Problem
Remote drag previews rendered as simplified colored circles via a parallel pipeline (`drawRemoteDragPreviews`), while the actual token sprite stayed frozen at its pre-drag position. The 10Hz `token.position.sync` skipped tokens with active drag previews, so the real sprite never moved during a remote drag.

### Solution
In `token.drag.update` handler, also call `updateTokenPosition()` so the real token sprite moves in the session store — exactly like a local drag.

## v0.7.161: Remove Ghost Preview System

### Problem
The ghost preview system (`dragPreviewStore` + `drawRemoteDragPreviews`) was entirely redundant after v0.7.160. It caused lingering artifacts — ghost circles labeled "unknown" from the auto-create path when `begin` messages were missed. Two rendering systems competed to draw the same token.

### Solution
Removed the entire ghost preview pipeline:
- Deleted `src/stores/dragPreviewStore.ts`
- Removed `drawRemoteDragPreviews` from both `SimpleTabletop.tsx` and `canvasDrawHelpers.ts`
- Simplified `tokenHandlers.ts`: `token.drag.update` only calls `updateTokenPosition()`, begin/end are no-ops
- Removed the `activeDragPreviews` skip guard from `token.position.sync` — no longer needed

### What Remains
- `emitDragBegin/Update/End` — still emitted by local dragger for remote position updates
- `token.drag.update` handler calls `updateTokenPosition()` to move real sprite
- `drawDragGhostAndPath` — local-only ghost/path the dragger sees (unrelated to remote previews)
- `markDraggedForSync/unmarkDraggedForSync` — still needed so 10Hz broadcast excludes locally-dragged tokens

### Changes
- `src/stores/dragPreviewStore.ts` — deleted
- `src/lib/net/ephemeral/tokenHandlers.ts` — removed all dragPreviewStore usage
- `src/components/SimpleTabletop.tsx` — removed drawRemoteDragPreviews, subscription, import
- `src/lib/canvasDrawHelpers.ts` — removed drawRemoteDragPreviews export
- `src/lib/version.ts` — bumped to 0.7.161

### Impact on External Services
None — all client-side rendering changes. WebSocket server and Jazz unaffected.
