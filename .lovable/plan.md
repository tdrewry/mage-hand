

# Remove Ghost Preview System for Token Drags (v0.7.161)

## Problem
The screenshot shows lingering artifacts: a ghost circle labeled "unknown" appears at the host's drag origin. This comes from the `dragPreviewStore` — specifically the `updateDrag` auto-create path that sets `userId: "unknown"` when a `begin` message was missed. The entire ghost overlay system (start-position ghost, trail polyline, dashed distance line, username label) is now redundant because `token.drag.update` already calls `updateTokenPosition()`, so the real token sprite moves via the normal pipeline.

The local drag already renders its own ghost-at-origin and path trail via `drawDragGhostAndPath()` — there's no need for a parallel remote version.

## What to Remove

### 1. `drawRemoteDragPreviews` function (SimpleTabletop.tsx ~lines 4594-4656)
Delete the entire function. The real token sprite already renders at the drag position. The local `drawDragGhostAndPath` handles the origin ghost and path trail for the local dragger — remote clients don't need this decoration (they just see the token moving).

### 2. All calls to `drawRemoteDragPreviews` (SimpleTabletop.tsx)
Remove from both the main canvas draw (~line 4332) and the overlay canvas draw (~line 4445).

### 3. `remoteDragPreviews` subscription (SimpleTabletop.tsx ~line 423)
Remove `useDragPreviewStore` subscription and remove `remoteDragPreviews` from the ephemeral redraw `useEffect` dependency array (~line 1538).

### 4. `dragPreviewStore` usage in `tokenHandlers.ts`
- `token.drag.begin`: Remove `useDragPreviewStore.getState().beginDrag(...)` — just ignore, the token will move on updates
- `token.drag.update`: Remove `useDragPreviewStore.getState().updateDrag(...)` — keep only the `updateTokenPosition()` call
- `token.drag.end`: Remove `useDragPreviewStore.getState().endDrag(...)` — nothing to clean up
- `token.position.sync`: Remove the `activeDragPreviews` skip guard — since there's no preview store, position sync can apply normally (drag.update will still override with more recent positions)

### 5. `dragPreviewStore.ts` — delete file
No longer referenced anywhere after the above changes.

### 6. `dragOps.ts` — keep as-is
The emit functions (`emitDragBegin`, `emitDragUpdate`, `emitDragEnd`) are still needed — they send the ephemeral messages. Only the **receiving** side changes.

### 7. `canvasDrawHelpers.ts` — remove `drawRemoteDragPreviews` export
The helper version is imported but shadowed by the local version in SimpleTabletop. Remove the export.

### 8. `useDragPreviewStore` import cleanup
Remove import from `SimpleTabletop.tsx` and `tokenHandlers.ts`.

## What Stays
- **`emitDragBegin/Update/End`** — still emitted by the local dragger so remote clients receive position updates
- **`token.drag.update` handler** — still calls `updateTokenPosition()` to move the real sprite
- **`token.drag.begin/end` handlers** — can be simplified to no-ops or removed if we rely solely on `updateTokenPosition`
- **`drawDragGhostAndPath`** — the local-only ghost/path that the dragger sees (unrelated to remote previews)
- **`token.position.sync` skip for locally-dragged tokens** — `markDraggedForSync`/`unmarkDraggedForSync` in `tokenPositionSync.ts` still needed so the 10Hz broadcast excludes locally-dragged tokens

## Files to Change

| File | Change |
|------|--------|
| `src/stores/dragPreviewStore.ts` | Delete |
| `src/lib/net/ephemeral/tokenHandlers.ts` | Remove all `dragPreviewStore` calls; simplify handlers; remove activeDragPreviews guard from position.sync |
| `src/components/SimpleTabletop.tsx` | Remove `drawRemoteDragPreviews`, its calls, `remoteDragPreviews` subscription, import |
| `src/lib/canvasDrawHelpers.ts` | Remove `drawRemoteDragPreviews` export |
| `src/lib/version.ts` | Bump to `0.7.161` |
| `Plans/lifecycle-drag-preview.md` | Update documentation |

## Impact on External Services
None — all client-side changes. WebSocket server and Jazz unaffected.

