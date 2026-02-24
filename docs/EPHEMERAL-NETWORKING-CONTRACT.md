Below is an **agent contract** you can hand to Lovable to build the **full Ephemeral networking layer** against your WS stack, using your **Networking Classification Matrix** as the source of truth.

* * * * *

Agent Contract: Ephemeral Networking Layer (WS) for VTT
=======================================================

0) Objective
------------

Implement the **Ephemeral networking layer** for the VTT over the existing **WebSocket + JSON** protocol and local room server, covering all Ephemeral interactions marked **planned** or **potential** in `NETWORKING-MATRIX.md`, while preserving the properties:

-   **High-frequency**

-   **Lossy**

-   **TTL-based (250--1000 ms)**

-   **Throttled (10--30 Hz)**

-   **Not included in snapshots**

-   **Not part of undo/redo or authoritative history**

-   **Safe to drop frames**

The durable layer already exists for: `chat.post`, `token.move`, `token.sync`. The token drag preview is already implemented. This work expands ephemeral to all remaining items in the matrix.

* * * * *

1) Scope of Work (Ephemeral Only)
---------------------------------

### Included (build now)

All Ephemeral actions in the matrix that are `planned` or `potential`, including (but not limited to):

**Tokens**

-   `token.handle.preview` (rotate/scale handle preview) --- planned

-   `token.hover` --- planned

-   `selection.preview` --- planned

-   `action.target.preview` --- planned (targeting reticle / actionStore mouse pos)

**Map & Camera**

-   `map.dm.viewport` --- planned

-   `region.drag.update` --- planned

-   `region.handle.preview` --- planned

-   `mapObject.drag.update` --- planned

-   `mapObject.handle.preview` --- planned

-   `map.ping`, `map.focus`, `cursor.update` --- potential

**Fog & Vision**

-   `fog.cursor.preview`, `fog.reveal.preview` --- potential

**Chat & Dice**

-   `chat.typing` --- potential

-   `dice.rolling` --- potential

**Initiative**

-   `initiative.drag.preview`, `initiative.hover` --- potential

**Groups**

-   `group.select.preview`, `group.drag.preview` --- potential

**Roles & Presence**

-   `role.handRaise`, `presence.activity` --- potential

**UI Mode & Presence**

-   `cursor.update`, `cursor.visibility`, `presence.viewingMap` --- planned/potential\
    Presence join/leave is already implemented; extend presence metadata only.

**Assets**

-   `asset.uploadProgress` --- potential

Reference: `NETWORKING-MATRIX.md` is the authoritative list of ephemeral features, op kinds, throttles, and TTLs.

### Explicitly excluded (do not implement in this task)

-   Any Durable message/op/log/snapshot changes

-   Any R2 asset upload pipeline

-   Any store patch sync (`sync.patch`) rebuild

-   Any permission enforcement beyond minimal "DM-only sends DM viewport / cursor visibility"

* * * * *

2) Definitions and Guarantees
-----------------------------

### 2.1 Ephemeral message semantics

Ephemeral messages must:

-   be broadcast to connected clients in the same session

-   not be recorded in op log segments

-   not be used for catch-up / late join replay

-   expire client-side using TTL if no updates occur

### 2.2 Ordering / reliability

-   Do **not** require strict ordering.

-   If an update is dropped, the next update should overwrite state.

-   Prefer "latest wins" per `(opKind, entityKey, userId)`.

### 2.3 Throttling

-   Implement per-opKind throttle defaults:

    -   20 Hz (50ms) for drag/handle preview

    -   10--15 Hz for cursors/viewport broadcasts

-   The matrix provides suggested values; implement those.

### 2.4 TTL

-   Implement per-opKind TTL defaults:

    -   400--500 ms for hover/cursor/drag previews

    -   1s for ping/laser pointer

    -   2s for chat typing

    -   3s for dice rolling

-   TTL must be enforced client-side even if server doesn't do it.

* * * * *

3) Deliverables
---------------

### 3.1 Protocol / Types

Add TS types for ephemeral ops (or message variants) so the client has:

-   union type `EphemeralOpKind`

-   payload typing per op kind (at least minimal fields required by the matrix)

-   shared metadata envelope fields: `userId`, `clientId`, `ts`

Do not introduce msgpack; JSON only.

### 3.2 Client runtime: Ephemeral subsystem

Create a module (example path):

-   `src/net/ephemeral/`

With:

1.  **EphemeralBus**: a registry keyed by `opKind` that can publish/receive ephemeral events.

2.  **ThrottleManager**: per-key throttling (key includes entity id / token id / user id).

3.  **TTLCache**: stores last event state and expires automatically.

**Key requirement:** each incoming ephemeral event updates a local ephemeral "overlay" store (e.g., `dragPreviewStore`, `cursorStore`, etc.) without touching durable stores.

### 3.3 Server runtime: broadcast-only ephemeral

Update the WS room server logic so it can:

-   accept ephemeral messages/op kinds

-   broadcast to room

-   avoid storing them in durable log

If you need a clean separation, implement:

-   `handleEphemeralMessage(msg)` separate from durable op handling.

### 3.4 UI wiring (minimal)

Add minimal wiring in the client so that at least these are visually testable:

-   Cursor update display (simple dot)

-   Ping display (simple circle)

-   Token hover highlight indicator (outline)

-   Selection rectangle preview (box outline)

No need for polished UI; functional is enough.

* * * * *

4) Implementation Guidance (how to structure it)
------------------------------------------------

### 4.1 Naming

Use the op kinds exactly as listed in the matrix:

-   `token.hover`, `cursor.update`, etc.

### 4.2 Message format

Ephemeral messages should be one of:

-   an `EngineOp` with `kind` set to the ephemeral op kind, and payload in `data`\
    OR

-   a dedicated `ephemeral` envelope message type

Prefer using `EngineOp` for consistency with existing WS plumbing, but ensure ephemeral ops are routed to the ephemeral handler and **not logged**.

### 4.3 Entity keys (for "latest wins")

For each op kind, define a key strategy:

-   cursor: `(userId)`

-   token.hover: `(userId)` or `(tokenId)` depending on UX; choose **(userId)** so each user has one hover target.

-   selection.preview: `(userId)`

-   region.drag.update: `(regionId)`

-   map.dm.viewport: `(session)` but DM-only

### 4.4 DM-only sends

Enforce on client:

-   only DM clients can emit:

    -   `map.dm.viewport`

    -   `cursor.visibility`

Server may optionally validate using `roles/permissions` from welcome payload if available.

* * * * *

5) Test Plan (must be implemented)
----------------------------------

Create automated/integration tests similar to your existing ping/chat/token tests, covering:

1.  **Ephemeral broadcast**

-   Client A sends `cursor.update`; Client B receives and updates overlay state.

1.  **Throttle**

-   Spam cursor updates; verify outbound send rate <= configured Hz.

1.  **TTL expiry**

-   Send one hover update; verify it disappears after TTL with no refresh.

1.  **No replay on late join**

-   Client A sends cursor updates; Client B connects later; verify no cursor state appears until B receives a new event.

1.  **No durable log pollution**

-   Verify ephemeral events do not increase durable op sequence counters / catch-up batches.

* * * * *

6) Definition of Done
---------------------

-   All Ephemeral items in `NETWORKING-MATRIX.md` that are marked `planned` or `potential` have:

    -   a typed payload definition

    -   a client emitter hook (even if feature UI is stubbed)

    -   a client receiver hook updating an ephemeral overlay store

    -   TTL + throttle implemented per the matrix guidance

-   Server broadcasts ephemeral messages and does not persist them

-   Tests exist and pass for throttle, TTL, late join non-replay, and "no durable pollution"

Reference: the feature list and required semantics are in `NETWORKING-MATRIX.md`.

* * * * *

7) Work Notes / Guardrails
--------------------------

-   Do not reintroduce Socket.IO code or abstractions.

-   Do not implement R2.

-   Do not implement snapshot loading.

-   Keep the ephemeral subsystem modular so it can later run both on LAN server and Durable Objects.

* * * * *

If you want, I can also provide a **"starter file tree + skeleton interfaces"** that Lovable can directly create (EphemeralBus, TTLCache, throttle utils, and a minimal cursor store), so it doesn't improvise structure.