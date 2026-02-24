# Ephemeral Networking Layer — Implementation Phases

> Tracks progress across sessions. Source of truth: `docs/EPHEMERAL-NETWORKING-CONTRACT.md` + `docs/NETWORKING-MATRIX.md`

---

## Phase 1 — Core Infrastructure ✅ DONE

- [x] `src/lib/net/ephemeral/types.ts` — `EphemeralOpKind` union, `EphemeralPayloadMap`, `EPHEMERAL_OP_CONFIG` (throttle + TTL per op)
- [x] `src/lib/net/ephemeral/TTLCache.ts` — Generic TTL cache with auto-expiry and `onChange` callbacks
- [x] `src/lib/net/ephemeral/ThrottleManager.ts` — Per-key outbound throttling with trailing-edge execution
- [x] `src/lib/net/ephemeral/EphemeralBus.ts` — Central hub: `emit()` with throttling + DM gating, `receive()` with echo prevention + TTL storage
- [x] `src/lib/net/ephemeral/index.ts` — Public API barrel export
- [x] Wired `ephemeralBus` into `src/lib/net/index.ts` and connected to `netManager.proposeOp`

---

## Phase 2 — OpBridge Integration & Server Routing ✅ DONE

Route incoming ephemeral ops through `EphemeralBus.receive()` instead of durable handlers.

- [x] Update `src/lib/net/NetManager.ts` to detect ephemeral op kinds in `opBatch` and route to `ephemeralBus.receive()` (safety-net filter)
- [x] Update server `eventHandlers.js` to add `handleEphemeral()` — broadcast without logging
- [x] Ensure ephemeral ops do not increment durable sequence counters (server broadcasts via separate `ephemeral` event)
- [x] Ensure ephemeral ops are excluded from catch-up / late-join replay (not persisted in session state)

### Phase 2b — Dedicated Ephemeral Channel ✅ DONE

Full end-to-end dedicated transport so ephemeral ops never touch the durable pipeline.

- [x] Add `EphemeralPayload` type and `"ephemeral"` message to `ClientToServerMessage` and `ServerToClientMessage` in `networking/contract/v1.ts`
- [x] Add `NetworkSession.sendEphemeral(kind, data)` — sends immediately, no batching or sequencing
- [x] Handle inbound `"ephemeral"` server messages in `NetworkSession` — emit new `ephemeral` event
- [x] Add `"ephemeral"` case in `roomServer.ts` — broadcast to all other clients, no logging/seq/opLog
- [x] Add `NetManager.sendEphemeral()` and wire inbound `ephemeral` event to `EphemeralBus.receive()`
- [x] Rewire `EphemeralBus.setSendFn` to use `netManager.sendEphemeral()` instead of `netManager.proposeOp()`
- [x] Update `SERVER_BUNDLE/eventHandlers.js.txt` and `index.js.txt` with Socket.IO `handleEphemeral` (legacy server)

---

## Phase 3 — Cursor & Presence Overlays (Minimal UI) ✅ DONE

First visually testable ephemeral features per contract §3.4.

- [x] Create `src/stores/cursorStore.ts` — Zustand store fed by TTLCache for remote cursors
- [x] Wire `cursor.update` emit on mouse move in `SimpleTabletop.tsx` (~15 Hz throttle via EphemeralBus, 500ms TTL)
- [x] Render cursor dots overlay (`CursorOverlay.tsx`) — colored dot + username label, world→screen transform
- [x] Create `src/lib/net/ephemeral/cursorHandlers.ts` — registers `cursor.update` and `cursor.visibility` handlers + TTL expiry cleanup
- [x] Wire `cursor.visibility` handler (DM toggle to show/hide cursors globally)
- [x] Create `src/stores/presenceStore.ts` — Zustand store for viewingMap + activity per user
- [x] Create `src/lib/net/ephemeral/presenceHandlers.ts` — registers handlers + TTL expiry cleanup
- [x] Wire `presence.viewingMap` — emit on selectedMapId change, display map name in ConnectedUsersPanel
- [x] Wire `presence.activity` — handler registered, display activity string in ConnectedUsersPanel
- [x] Refactor `EphemeralBus.onCacheChange` to support multiple listeners (array-based)

---

## Phase 4 — Token Ephemeral Ops ✅ DONE

Extend existing drag preview with remaining token ephemeral ops.

- [x] `token.hover` — emit on token mouseenter/leave, handler + store in `tokenEphemeralStore`
- [x] `token.handle.preview` — handler + store wired (emit from handle drag TBD when handle UI exists)
- [x] `selection.preview` — emit selection rectangle during marquee drag, clear on mouseUp
- [x] `action.target.preview` — emit targeting reticle position during action targeting mode
- [x] Created `src/stores/tokenEphemeralStore.ts` — Zustand store for all 4 token ephemeral overlays
- [x] Created `src/lib/net/ephemeral/tokenHandlers.ts` — registers handlers + TTL expiry cleanup

---

## Phase 5 — Map, Region & Map Object Previews ✅ DONE

- [x] `map.dm.viewport` — DM broadcasts viewport { x, y, zoom } on every pan/zoom; handler + store
- [x] `map.ping` — handler + store wired (emit from UI TBD — e.g. Ctrl+click)
- [x] `map.focus` — handler + store wired (emit from DM UI TBD)
- [x] `region.drag.update` — emit during region drag, handler updates `mapEphemeralStore`
- [x] `mapObject.drag.update` — emit during map object drag, handler updates `mapEphemeralStore`
- [x] `region.handle.preview` — handler ready (emit TBD when handle drag exists)
- [x] `mapObject.handle.preview` — handler ready (emit TBD when handle drag exists)
- [x] Created `src/stores/mapEphemeralStore.ts` — Zustand store for DM viewport, pings, focus, region/mapObject drags
- [x] Created `src/lib/net/ephemeral/mapHandlers.ts` — registers handlers + TTL expiry cleanup

---

## Phase 6 — Fog, Dice, Initiative, Groups, Roles

Lower-priority ephemeral ops.

- [ ] `fog.cursor.preview` — broadcast fog brush position + radius
- [ ] `fog.reveal.preview` — broadcast intended reveal area shape
- [ ] `chat.typing` — typing indicator (2s TTL)
- [ ] `dice.rolling` — "user is rolling" spinner (3s TTL)
- [ ] `initiative.drag.preview` — reorder drag preview
- [ ] `initiative.hover` — current-turn hover highlight (500ms TTL)
- [ ] `group.select.preview` — selected group highlight
- [ ] `group.drag.preview` — ghost positions for group members
- [ ] `role.handRaise` — player requests GM attention (30s auto-expire)
- [ ] `asset.uploadProgress` — upload percentage broadcast (1s TTL)

---

## Phase 7 — Tests

Per contract §5.

- [ ] **Ephemeral broadcast**: Client A sends `cursor.update`, Client B receives and updates overlay
- [ ] **Throttle**: Spam cursor updates, verify outbound rate ≤ configured Hz
- [ ] **TTL expiry**: Send one hover update, verify it disappears after TTL
- [ ] **No replay on late join**: Late-joining client sees no stale ephemeral state
- [ ] **No durable log pollution**: Ephemeral events don't affect durable op sequences

---

## Definition of Done (from contract §6)

All `planned` and `potential` ephemeral items in `NETWORKING-MATRIX.md` have:
- A typed payload definition ✅ (Phase 1)
- A client emitter hook (even if feature UI is stubbed)
- A client receiver hook updating an ephemeral overlay store
- TTL + throttle implemented per matrix guidance ✅ (Phase 1 config)
- Server broadcasts ephemeral messages without persisting them
- Tests exist and pass
