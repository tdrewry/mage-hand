

# WebSocket JSON Networking Migration

## Overview

Replace the Socket.IO-based networking path with a new WebSocket JSON protocol, using the `NetworkSession` client library already in the repo at `networking/client/`. This creates a clean networking module at `src/lib/net/`, updates the multiplayer store, rewires the SessionManager UI, and implements a minimal operation bridge to prove the round-trip loop.

The existing Socket.IO code (`socketClient.ts`, `syncManager.ts`, `sync-core/`) is **not deleted** -- it remains as a fallback. The new path runs in parallel and can be toggled.

---

## Step 1: Create the Networking Module (`src/lib/net/`)

### Files to create:

**`src/lib/net/NetManager.ts`** -- Singleton wrapper around `NetworkSession`

- Holds one `NetworkSession` instance
- Exposes: `connect(params)`, `disconnect()`, `isConnected`, `info`
- On `connected` event: updates `multiplayerStore` with sessionId, userId, roles, permissions, connectionStatus
- On `opBatch` event: forwards to OpBridge for application, persists `toSeq` to `localStorage` key `vtt.lastSeenSeq.<sessionCode>`
- On `rejected` / `error` / `disconnected` events: updates store with status and lastError
- On connect: reads `localStorage` for `lastSeenSeq` and passes it to `NetworkSession.connect()` for automatic catchup
- Exposes `proposeOp(op)` passthrough to `NetworkSession.proposeOp()`

**`src/lib/net/OpBridge.ts`** -- Translates between EngineOps and Zustand stores

- `applyRemoteOps(ops)`: iterates ops array, dispatches to store actions based on `op.kind`
- `emitLocalOp(op)`: calls `netManager.proposeOp(op)` (skipped when `isApplyingRemote` flag is true)
- Maintains `isApplyingRemote` boolean for echo prevention
- Initial op kinds supported:
  - `ping` -- logs to console, shows toast
  - `token.move` -- calls `useSessionStore.getState().updateTokenPosition(tokenId, x, y)`
  - `chat.post` -- shows toast with sender + message text
- Op kind registry pattern: a `Map<string, (data, userId) => void>` so new ops can be registered without modifying OpBridge internals

**`src/lib/net/index.ts`** -- Public API surface

- Exports singleton `netManager` instance of `NetManager`
- Re-exports `emitLocalOp` from OpBridge
- Re-exports types from `networking/contract/v1`

### Echo Prevention Pattern

```text
Local action (e.g. token drag)
  -> store.updateTokenPosition()   [state changes]
  -> emitLocalOp({ kind: 'token.move', ... })
     -> checks isApplyingRemote == false? yes -> proposeOp()

Remote opBatch arrives
  -> isApplyingRemote = true
  -> applyRemoteOps() -> store.updateTokenPosition()
  -> isApplyingRemote = false
  // emitLocalOp would be skipped if somehow triggered
```

---

## Step 2: Update the Multiplayer Store

**`src/stores/multiplayerStore.ts`** -- Modify existing store

- Remove the `import type { ConnectionStatus } from '@/lib/socketClient'` dependency
- Define `ConnectionStatus` locally: `'disconnected' | 'connecting' | 'connected' | 'error'`
- Add new fields:
  - `roles: string[]` (from server welcome)
  - `permissions: string[]` (from server welcome)
  - `lastError: string | null`
  - `sessionCode: string` (convenience, also in currentSession)
- Keep existing fields and actions for backward compatibility with old Socket.IO path
- Update `DEFAULT_SERVER_URL` from `http://localhost:3001` to `ws://localhost:3001`

---

## Step 3: Rewire the SessionManager UI

**`src/components/SessionManager.tsx`** -- Update to use `netManager`

- Import `netManager` from `src/lib/net/` instead of `syncManager`
- On "Create Session" / "Join Session": call `netManager.connect({ serverUrl, sessionCode, username, password })`
- The LAN server auto-creates sessions on first `hello`, so both create and join use the same `connect()` call with the session code
- On "Leave Session": call `netManager.disconnect()`
- Display: connectionStatus, sessionId, roles, permissions, lastError from `multiplayerStore`
- Add invite token field (optional, collapsed in Advanced Settings)
- URL input default changes to `ws://localhost:3001`

No changes needed to `MenuCard.tsx` -- it already opens `SessionManager` via a dialog.

---

## Step 4: Add a Demo / Debug Section

**`src/lib/net/demo.ts`** -- Helper functions for testing

- `sendPing(message?: string)`: emits `{ kind: 'ping', data: { message } }`
- `sendChat(text: string)`: emits `{ kind: 'chat.post', data: { text } }`
- `sendTokenMove(tokenId, x, y)`: emits `{ kind: 'token.move', data: { tokenId, x, y } }`

**SessionManager UI addition**: When connected, show a small "Debug" collapsible section with:
- "Send Ping" button
- A text input + "Send Chat" button
- These call the demo helpers

---

## Step 5: Wire Token Move to Prove the Loop

In `SimpleTabletop.tsx` (or wherever token drag-end is handled), after calling `updateTokenPosition()`:

- Call `emitLocalOp({ kind: 'token.move', data: { tokenId, x, y } })` if connected
- This is the minimal proof that local changes propagate to other clients

The `OpBridge` incoming handler for `token.move` calls `updateTokenPosition()` with `isApplyingRemote = true`, preventing echo.

---

## Step 6: Save Plan and Bump Version

- Save this plan to `Plans/websocket-networking-migration.md`
- Bump `src/lib/version.ts` from `0.4.46` to `0.4.47`

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/lib/net/NetManager.ts` |
| Create | `src/lib/net/OpBridge.ts` |
| Create | `src/lib/net/index.ts` |
| Create | `src/lib/net/demo.ts` |
| Create | `Plans/websocket-networking-migration.md` |
| Modify | `src/stores/multiplayerStore.ts` |
| Modify | `src/components/SessionManager.tsx` |
| Modify | `src/lib/version.ts` |

---

## What This Does NOT Do (Future Work)

- Does not remove Socket.IO code (old path remains as fallback)
- Does not implement full store patch sync via EngineOps (only `token.move` as proof)
- Does not implement presence events (server sends them, but we skip for now)
- Does not implement snapshot loading
- Does not wire fog, map, region, initiative, or light sync to the new protocol

---

## Definition of Done

With `networking/server-local` running at `ws://localhost:3001`:

1. Two browser tabs can connect to the same session code
2. Both see the connection status update to "Connected" with roles/permissions displayed
3. "Send Ping" in tab A shows a toast in tab B
4. Dragging a token in tab A moves it in tab B (and vice versa) without echo loops
5. Disconnecting and reconnecting uses persisted `lastSeenSeq` for catchup
6. All networking logic lives in `src/lib/net/` -- UI only imports from that module

