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

- [x] Update `src/lib/net/NetManager.ts` to detect ephemeral op kinds and route to `ephemeralBus.receive()`
- [x] Update server `eventHandlers.js` to add `handleEphemeral()` — broadcast without logging
- [x] Ensure ephemeral ops do not increment durable sequence counters (server broadcasts via separate `ephemeral` event)
- [x] Ensure ephemeral ops are excluded from catch-up / late-join replay (not persisted in session state)

---

## Phase 3 — Cursor & Presence Overlays (Minimal UI)

First visually testable ephemeral features per contract §3.4.

- [ ] Create `src/stores/cursorStore.ts` — Zustand store fed by TTLCache for remote cursors
- [ ] Wire `cursor.update` emit on mouse move in `SimpleTabletop.tsx` (15 Hz throttle, 500ms TTL)
- [ ] Render cursor dots overlay (userId + color) on canvas
- [ ] Wire `cursor.visibility` (DM toggle to show/hide own cursor)
- [ ] Wire `presence.viewingMap` — broadcast active mapId, display in ConnectedUsersPanel
- [ ] Wire `presence.activity` — broadcast current activity string

---

## Phase 4 — Token Ephemeral Ops

Extend existing drag preview with remaining token ephemeral ops.

- [ ] `token.handle.preview` — emit during rotate/scale handle drag, render remote handle ghost
- [ ] `token.hover` — emit on token mouseenter/leave, render hover highlight outline on remote clients
- [ ] `selection.preview` — emit selection rectangle/lasso polyline, render remote selection box outline
- [ ] `action.target.preview` — emit targeting reticle position from actionStore, render crosshair

---

## Phase 5 — Map, Region & Map Object Previews

- [ ] `map.dm.viewport` — DM broadcasts viewport { x, y, zoom } at 10 Hz; clients follow
- [ ] `map.ping` — click-to-ping with auto-expire circle (1s TTL)
- [ ] `map.focus` — GM forces all clients to pan to point
- [ ] `region.drag.update` — ghost position during region reposition (20 Hz, 400ms TTL)
- [ ] `region.handle.preview` — broadcast handle position during transform
- [ ] `mapObject.drag.update` — ghost position during reposition (20 Hz, 400ms TTL)
- [ ] `mapObject.handle.preview` — broadcast handle position during transform

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
