# Jazz Transport vs. Legacy Networking Audit

This document serves as an audit connecting the original networking goals defined in the `docs/Archive` with the new, optional Jazz CRDT transport implementation.

## 1. Ephemeral Networking
The `EPHEMERAL-NETWORKING-CONTRACT.md` and `NETWORKING-MATRIX.v1.md` defined a clear separation for high-frequency, lossy, low-latency updates (cursors, token drag previews, pings, hover states, selection boxes).

**Observations under Jazz:**
*   The legacy Socket.IO architecture handled ephemeral messages by bypassing the durable operational log and relying on TTLs and high-frequency volatile emits.
*   **Jazz Translation:** In the Jazz ecosystem, true ephemeral, lossy broadcasting isn't a primary CRDT primitive (CRDTs inherently keep history to merge). However, Jazz solves this through two mechanisms:
    1.  **`Account.profile.presence`**: Standard Jazz tools handle volatile local state like mouse cursors and active viewport identifiers by attaching them to the ephemeral presence object of the user.
    2.  **`co.feed`**: For high-volume log streams (like Chat logs or temporary roll indicators).
*   **Feature Gap:** If the old WebSocket server goes completely dark, features like `mapObject.drag.update` or `token.drag.update` (ghost dragging) need to be explicitly routed through a `JazzFeed` or the `presence` object to prevent ballooning the persistent `co.map` history for tokens with useless micro-movements. The current `bridge.ts` mitigates rubber-banding via `_localDragTokens`, but true ghost-broadcasting to peers requires intentional presence-sync mapping.

## 2. Durable Networking
The `Networking-Architecture.md` detailed a robust JSON-Patch system over WebSockets (`syncPatch` middleware and `SyncManager`). 

**Observations under Jazz:**
*   The new `bridge.ts` beautifully side-steps replacing the entire JSON-Patch system. By subscribing to the Zustand stores, the Jazz bridge acts as an alternative outbound conduit.
*   The bridging from Zustand primitive objects into `co.map()` and `co.list()` successfully maps the Durable Networking requirements (Token CRUD, Map Object CRUD, Region CRUD, Fog config) mapped out in the matrix.
*   **BLOB Sync Fallback:** The old architecture synced complex holistic states (like Initiative order) as whole blobs when JSON diffing got messy. The Jazz translation successfully adopted this via `JazzDOBlob`, avoiding difficult CRDT tree merging for highly associative arrays by just syncing the serialized JSON state.

## 3. Undo/Redo System Compatibility
The `UNDO_REDO_SYSTEM.md` defines a Command pattern (`UndoRedoManager`) that executes directly against the Zustand stores (e.g., `UpdateTokenCommand`, `AddRegionCommand`).

**Observations under Jazz & Socket:**
*   **100% Compatible and Working.** The Undo/Redo system operates at the highest level of abstraction—directly invoking the Zustand setter functions (`useSessionStore.getState().updateTokenPosition()`).
*   Because the undo/redo framework uses these standard mutation methods, **both** the legacy `syncPatch` (WebSocket) and the new `bridge.ts` (Jazz) will automatically intercept the state changes.
*   If a DM drops a token (creating it), then hits `Ctrl+Z` (undo), the `UndoRedoManager` invokes `removeToken`. The Jazz bridge will see this deletion in the Zustand store subscription and delete the associated `JazzToken` CoValue, propagating the undo to all clients seamlessly.
*   **No Conflicts:** The system explicitly avoids recording Remote/Network updates in the local `undoRedoManager.push()` stacks. This means a player cannot accidentally `Ctrl+Z` the movement of *another* player's token. The DM maintains their own local history tree of actions *they* initiated, which is the mathematically correct way to handle multi-user undo via CRDTs.

## Summary
The migration to Jazz covers nearly all features of the Durable network matrix seamlessly via Zustand bridging. The only architectural caution going forward is ensuring that high-frequency ephemeral "ghost" interactions (like hovering and dragging) are routed to Jazz Presence or Feeds rather than mutating CoMap properties, which would artificially bloat the CRDT sync history payload.
