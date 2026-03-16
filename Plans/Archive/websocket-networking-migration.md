# WebSocket JSON Networking Migration

## Overview

Replace the Socket.IO-based networking path with a new WebSocket JSON protocol, using the `NetworkSession` client library already in the repo at `networking/client/`. This creates a clean networking module at `src/lib/net/`, updates the multiplayer store, rewires the SessionManager UI, and implements a minimal operation bridge to prove the round-trip loop.

The existing Socket.IO code (`socketClient.ts`, `syncManager.ts`, `sync-core/`) is **not deleted** -- it remains as a fallback. The new path runs in parallel and can be toggled.

---

## Step 1: Create the Networking Module (`src/lib/net/`)

### Files created:

- **`src/lib/net/NetManager.ts`** -- Singleton wrapper around `NetworkSession`
- **`src/lib/net/OpBridge.ts`** -- Translates between EngineOps and Zustand stores with echo prevention
- **`src/lib/net/index.ts`** -- Public API surface
- **`src/lib/net/demo.ts`** -- Helper functions for testing

### Echo Prevention Pattern

```
Local action -> store update -> emitLocalOp() -> proposeOp()
Remote opBatch -> isApplyingRemote=true -> store update -> isApplyingRemote=false
```

## Step 2: Updated Multiplayer Store

- Removed `socketClient` dependency
- Added `roles`, `permissions`, `lastError` fields
- Changed default URL to `ws://localhost:3001`
- Defined `ConnectionStatus` locally

## Step 3: Rewired SessionManager UI

- Uses `netManager` from `src/lib/net/`
- Both create/join use same `netManager.connect()` call
- Shows roles, permissions, lastError
- Added invite token field in Advanced Settings
- Added Debug Tools collapsible with Send Ping and Chat

## Step 4: Demo/Debug

- `sendPing()`, `sendChat()`, `sendTokenMove()` in `src/lib/net/demo.ts`
- Debug section in SessionManager UI

## Step 5: Token Move (Future)

Wire `emitLocalOp({ kind: 'token.move', ... })` in SimpleTabletop.tsx after token drag-end.

## Definition of Done

1. Two browser tabs can connect to the same session code
2. Both see connection status with roles/permissions
3. Send Ping / Chat works cross-tab
4. Token move syncs without echo loops
5. Reconnect uses persisted lastSeenSeq
6. All networking logic in `src/lib/net/`
