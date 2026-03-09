

# Unified Drag Model: Remote Tokens Use Local Rendering Path (v0.7.160)

## The Insight

Locally, token drag works flawlessly because:
1. `token.drag.begin` → sets `isDraggingToken`, `draggedTokenId`, `dragStartPos`
2. `token.drag.update` → calls `updateTokenPosition()` — the token **actually moves** in the session store
3. The standard `redrawCanvas()` draws the token at its new position naturally
4. `drawDragGhostAndPath()` draws the ghost at `dragStartPos` and the path via `dragPathRef`
5. `token.drag.end` → clears state, token stays at final position

The remote ghost preview system is a **parallel rendering pipeline** — it maintains its own `dragPreviewStore`, its own draw function (`drawRemoteDragPreviews`), and fights with the main render loop. This is the source of flickering: two systems competing to render the same token.

## The Fix

On `token.drag.begin` from a remote user, instead of writing to `dragPreviewStore`, **just call `updateTokenPosition()`** on every `token.drag.update`. The token moves in the session store like a local drag. On `token.drag.end`, the final authoritative position arrives via durable sync.

The ghost/path overlay for remote drags stays in `dragPreviewStore` since the local client doesn't have `isDraggingToken` set — but we simplify `drawRemoteDragPreviews` to only draw the ghost-at-start and path trail (the token itself is already rendered at its current position by the normal token renderer).

Wait — that's actually what it already does. The issue is that `token.position.sync` (the 10Hz broadcast) **also** updates token positions, and it **skips** tokens with active drag previews. So the token doesn't move during drag on remote clients — only the ghost circle moves. The actual token sprite stays at the start position until `drag.end` when `position.sync` resumes.

Let me re-examine...

Actually, looking at the `token.drag.update` handler (tokenHandlers.ts line 62-64), it only calls `useDragPreviewStore.getState().updateDrag()` — it does **not** call `updateTokenPosition()`. And `token.position.sync` (line 78-83) skips tokens with active drag previews. So during a remote drag, the token sprite stays frozen at its pre-drag position, and only the ghost circles in `drawRemoteDragPreviews` show movement.

**The fix**: In the `token.drag.update` handler, also call `sessionStore.updateTokenPosition()` so the actual token sprite moves in real-time, exactly like a local drag. The ghost overlay (start position marker + path trail) continues to render from `dragPreviewStore` as supplementary decoration.

This means the token renders via the normal pipeline (with its texture, name, auras, etc.) at the drag position, rather than as a simplified colored circle.

## Changes

### 1. `src/lib/net/ephemeral/tokenHandlers.ts`
- In `token.drag.update` handler, after calling `updateDrag()`, also call `useSessionStore.getState().updateTokenPosition(data.tokenId, data.pos.x, data.pos.y)`
- This makes the real token sprite follow the remote drag in real-time

### 2. `src/components/SimpleTabletop.tsx` — simplify `drawRemoteDragPreviews`
- Remove the "ghost circle at current drag position" and "border ring on current position" rendering (lines 4643-4656) — the real token sprite is already there
- Keep: ghost circle at **start** position (origin marker), movement trail polyline, dashed distance line, username label
- This eliminates the duplicate rendering that causes flicker

### 3. `src/lib/version.ts` → `0.7.160`

### 4. `Plans/lifecycle-drag-preview.md` — update with this strategy

## What This Achieves
- Remote drags look identical to local drags — full token sprite with texture, name, status rings
- No parallel rendering pipeline fighting the main render loop
- Ghost-at-origin + path trail still shows where the drag started and the route taken
- Zero new state management — reuses `updateTokenPosition` which already triggers `redrawCanvas` via the `tokens` useEffect

## Impact on External Services
None — all client-side rendering changes. WebSocket server and Jazz unaffected.

