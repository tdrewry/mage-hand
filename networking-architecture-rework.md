The app uses Zustand stores under `src/stores/` and currently expects a Socket.IO relay-style networking approach with a SyncManager/Transport abstraction.

We are switching to a **new WebSocket JSON protocol** using an existing client networking library already in the repo at:

-   `networking/client/index.ts` (public entrypoint)

-   `networking/client/NetworkSession.ts` (session + batching + catchup)

-   `networking/contract/v1.ts` (message + `EngineOp` types)

A separate LAN server exists at `networking/server-local` and runs at:

-   `ws://<host-ip>:3001` (LAN/dev)\
    Later we will support hosted `wss://...`.

### Primary Goals

1.  Add a **modular networking adapter** layer so the app can connect/disconnect to the new server without coupling networking into UI or store logic.

2.  Add a **Connect panel** that collects server URL, session code, username, optional invite token, optional password, and connects via WebSocket.

3.  Wire the network to the application's state changes using a clear pattern consistent with the existing architecture:

    -   Local state changes emit ops (or patches) -> network

    -   Remote batches apply to Zustand stores (or engine) without echo loops

### Constraints

-   JSON only (no msgpack).

-   Do not introduce Socket.IO client code for the new path.

-   Keep all networking logic in `src/lib/net/` (or similar). UI only calls into that module.

-   Preserve current Zustand store structure. Avoid refactoring the whole app.

-   Implement a "future-proof" shape similar to the target app's "TransportAdapter + SyncManager" layering, but using `NetworkSession` underneath.

### Step-by-step work to implement

#### A) Create a Networking Module

Create `src/lib/net/NetManager.ts` (or `src/lib/net/index.ts`) that:

-   encapsulates a single `NetworkSession` instance

-   exposes methods:

    -   `connect({ serverUrl, sessionCode, username, inviteToken?, password? })`

    -   `disconnect()`

    -   `isConnected()`

-   stores current connection state and last error string

-   subscribes to `NetworkSession` events:

    -   `connected` -> store sessionId, roles, permissions

    -   `opBatch` -> forward remote operations into an "apply" function

    -   `rejected`, `error`, `disconnected` -> update state + surface message

Persist last seen op seq per session:

-   localStorage key: `vtt.lastSeenSeq.<sessionCode>`

-   on each `opBatch`, update stored `toSeq`

-   on connect, pass `lastSeenSeq` into `NetworkSession.connect`

#### B) Create a Multiplayer Zustand Store (client-only metadata)

Create `src/stores/multiplayerStore.ts` (or update existing one) that tracks:

-   connectionStatus: `disconnected | connecting | connected | error`

-   serverUrl, sessionCode, username

-   sessionId, userId

-   roles: string[]

-   permissions: string[]

-   lastError?: string

NetManager should update this store.

#### C) Add a UI Connect Panel

Add a UI component `src/components/MultiplayerPanel.tsx` and mount it somewhere visible (toolbar / settings panel).\
Fields:

-   Server URL (default `ws://localhost:3001`)

-   Session Code

-   Username

-   Invite Token (optional)

-   Password (optional; `dm` for DM on LAN server)\
    Buttons:

-   Connect

-   Disconnect

Show:

-   connectionStatus

-   sessionId

-   roles + permissions (simple list is fine)

-   latest error message if any

Make URL normalization consistent with `networking/client/url.ts` by using the networking library's URL normalization or calling it directly.

#### D) Define an Operation Bridge (minimal, not a refactor)

We need to connect network to actual game changes. Implement a thin adapter in `src/lib/net/OpBridge.ts`:

-   **Outgoing:** Whenever the app performs a local game action that should sync (token moved, fog edited, map changed, etc.), generate an `EngineOp` and call `net.proposeOp(op)`.

-   **Incoming:** When `opBatch` arrives, apply each op in-order to the app's state.

Do NOT build a full JSON patch sync system right now. Just implement a minimal op set sufficient to prove the loop.

Start with at least these ops:

1.  `ping` (debug)

2.  `token.move` (tokenId, x, y)

3.  `chat.post` (text)

If the app already has a centralized action dispatcher, hook there; otherwise create a small `emitLocalOp(op)` function that the UI can call to demonstrate.

#### E) Prevent echo loops

Follow a pattern like the target system's "isApplyingRemote" flag:

-   When applying remote ops, set a boolean `isApplyingRemote = true`, apply store changes, then set back to false.

-   Outgoing op generation must skip when `isApplyingRemote` is true.

#### F) Add a Basic Integration Example

Add `src/lib/net/demo.ts` or a small dev-only button in the UI:

-   "Send Ping" -> sends an EngineOp `{ kind: 'ping', data: { message: 'hello' } }`\
    When another client receives it, log it and show a toast.

### Definition of Done

-   With `networking/server-local` running, two browser tabs can:

    -   connect to the same sessionCode

    -   see each other connect/disconnect state

    -   send and receive at least: ping, chat.post, token.move

-   Reconnect uses persisted lastSeenSeq and catches up via opBatch

-   Networking code is isolated to `src/lib/net/` + a small multiplayer store

### Notes

This VTT uses Zustand stores and has patterns like:

-   some stores synced automatically (in the reference design) and some are local-only\
    We are not rebuilding that whole system yet, but keep the architecture compatible so future work can map:

-   store patch sync -> EngineOp stream

-   RPC commands -> dedicated EngineOp kinds