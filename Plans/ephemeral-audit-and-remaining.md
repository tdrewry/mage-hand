# Ephemeral Network Audit & Remaining Tasks

## Current State Summary

All 7 phases of the ephemeral implementation are **DONE**. Priorities 1–5 have been implemented. The P5 stub emitters for `chat.typing`, `action.flash`, and `effect.placement.preview` were wired in v0.6.86. A full Chat UI was added in v0.6.87.

---

## What's Fully Wired (emitters + handlers + rendering)

| Op Kind | Emit | Receive | Render | Notes |
|---------|------|---------|--------|-------|
| `cursor.update` | ✅ | ✅ | ✅ (CursorOverlay) | Fully working |
| `cursor.visibility` | ✅ | ✅ | ✅ | DM toggle |
| `presence.viewingMap` | ✅ | ✅ | ✅ (ConnectedUsersPanel) | |
| `presence.activity` | ✅ | ✅ | ✅ (ConnectedUsersPanel) | |
| `token.hover` | ✅ | ✅ | ✅ (dashed rings) | |
| `selection.preview` | ✅ | ✅ | ✅ (rect overlay) | |
| `action.target.preview` | ✅ | ✅ | ✅ (crosshair) | |
| `map.dm.viewport` | ✅ | ✅ | ✅ (Follow DM) | |
| `map.ping` | ✅ | ✅ | ✅ (circle + label) | |
| `region.drag.update` | ✅ | ✅ | ✅ (ghost overlay) | |
| `mapObject.drag.update` | ✅ | ✅ | ✅ (ghost overlay) | |
| `fog.cursor.preview` | ✅ | ✅ | Partial | |
| `fog.reveal.preview` | ✅ | ✅ | ✅ (committed geometry) | |
| `role.handRaise` | ✅ | ✅ | ✅ (ConnectedUsersPanel) | |
| `dice.rolling` | ✅ | ✅ | ✅ | |
| `token.drag.begin/update/end` | ✅ | ✅ | ✅ (ghost token) | **Migrated to ephemeral pipeline (P1 ✅)** |
| `token.position.sync` | ✅ | ✅ | ✅ (sessionStore) | **10Hz delta sync (P2 ✅)** |
| `effect.aura.state` | ✅ | ✅ | ✅ | **Wired from tickAuras (P3 ✅)** |
| `action.queue.sync` | ✅ | ✅ | ✅ | DM queue hydration |
| `action.pending` | ✅ | ✅ | ✅ (ActionPendingOverlay) | **Player toast (P4b ✅)** |
| `action.resolved` | ✅ | ✅ | ✅ (ActionPendingOverlay) | **Player outcome feed (P4d ✅)** |
| `action.resolution.claim` | ✅ | ✅ | ✅ (actionPendingStore) | **Multi-DM lock (P4c ✅)** |

## Handlers Registered But NO Emitters ("emit TBD")

| Op Kind | Handler | Store | Emitter | Rendering |
|---------|---------|-------|---------|-----------|
| `token.handle.preview` | ✅ | ✅ | ❌ | ❌ |
| `region.handle.preview` | ✅ | ✅ | ❌ | ❌ |
| `mapObject.handle.preview` | ✅ | ✅ | ❌ | ❌ |
| `map.focus` | ✅ | ✅ | ❌ | ❌ |
| `chat.typing` | ✅ | ✅ | ✅ | **Wired in ChatCard input (P5 ✅ v0.6.86)** |
| `chat.message` | ✅ | ✅ | ✅ | **Wired in chatStore (v0.6.88)** |
| `initiative.drag.preview` | ✅ | ✅ | ✅ | **Wired in InitiativeTrackerCard (P6 ✅ v0.6.90)** |
| `initiative.hover` | ✅ | ✅ | ✅ | **Wired in InitiativeTrackerCard (P6 ✅ v0.6.90)** |
| `group.select.preview` | ✅ | ✅ | ❌ | ❌ |
| `group.drag.preview` | ✅ | ✅ | ❌ | ❌ |
| `asset.uploadProgress` | ✅ | ✅ | ❌ | ❌ |
| `effect.placement.preview` | ✅ | ✅ | ✅ | **Wired in effectStore (P5 ✅ v0.6.86)** |
| `action.flash` | ✅ | ✅ | ✅ | **Wired in commitAction (P5 ✅ v0.6.86)** |
| `action.inProgress` | ✅ | ✅ | ✅ | **Wired in actionStore phases (P6 ✅ v0.6.90)** |
| `mapObject.door.preview` | ✅ | ✅ | ❌ | ❌ |

---

## Completed Priorities

### ✅ Priority 1 — Token Drag Migration to Ephemeral (v0.6.80)

Migrated `token.drag.begin/update/end` from durable `emitLocalOp` to `ephemeralBus.emit`. Removed OpBridge drag handlers and moved them to `tokenHandlers.ts`.

**Files changed:**
- `src/lib/net/dragOps.ts` — now uses `ephemeralBus.emit`
- `src/lib/net/OpBridge.ts` — drag handlers removed
- `src/lib/net/ephemeral/tokenHandlers.ts` — drag handlers added

### ✅ Priority 2 — Frequency-Based Token Position Sync (v0.6.81)

Added `token.position.sync` ephemeral op at 10Hz (100ms interval). Emitter diffs current token positions against a snapshot and broadcasts only changed deltas. Handler applies remote positions to sessionStore with echo guard.

**Files created:**
- `src/lib/net/tokenPositionSync.ts` — `startPositionSync()` / `stopPositionSync()`

**Files changed:**
- `src/lib/net/ephemeral/types.ts` — new op kind, payload, config
- `src/lib/net/ephemeral/tokenHandlers.ts` — inbound handler
- `src/lib/net/ephemeral/index.ts` — re-export

### ✅ Priority 3 — Effect Aura State Emission (pre-existing)

`emitAuraState()` was already wired in `SimpleTabletop.tsx` after `tickAuras()` returns events. No changes needed.

### ✅ Priority 4 — Action Resolution Coordination & Player Visibility (v0.6.82)

**Phase A (v0.6.79):** `ACTION_CARD` added to `DM_ONLY_CARD_TYPES`.

**Phase B (v0.6.82):** `action.pending` ephemeral op. DM auto-broadcasts when entering resolve phase. Players see a floating overlay (`ActionPendingOverlay`) with caster/spell/target info.

**Phase C (v0.6.82):** `action.resolution.claim` ephemeral op. Optimistic lock for multi-DM coordination. Claims stored in `actionPendingStore`, auto-released on commit/cancel.

**Phase D (v0.6.82):** `action.resolved` ephemeral op. Players see resolved action outcomes (hit/miss, damage, type) in `ActionPendingOverlay` for 15 seconds.

**Files created:**
- `src/stores/actionPendingStore.ts` — pending, resolved, claim state
- `src/components/ActionPendingOverlay.tsx` — player-facing floating notifications

**Files changed:**
- `src/lib/net/ephemeral/types.ts` — 3 new op kinds + payloads + configs
- `src/lib/net/ephemeral/miscHandlers.ts` — inbound handlers
- `src/stores/actionStore.ts` — emission on confirmTargets, startEffectAction, commitAction, cancelAction
- `src/components/SimpleTabletop.tsx` — mounts ActionPendingOverlay

---

## ✅ Priority 5 — Stub Emitters (v0.6.86–v0.6.87)

The three core P5 stub emitters are now wired:

- **`chat.typing`** — emitted from `emitChatTyping()` helper, called on keypress in `ChatCardContent` input (v0.6.86). Full Chat UI with typing indicators added in v0.6.87.
- **`action.flash`** — emitted from `commitAction()` in `actionStore.ts` for each resolution flash (v0.6.86).
- **`effect.placement.preview`** — emitted from `updatePlacementPreview()` in `effectStore.ts` with templateId, origin, direction (v0.6.86).

**Files changed (v0.6.86):**
- `src/stores/actionStore.ts` — action.flash emission in commitAction
- `src/stores/effectStore.ts` — effect.placement.preview emission
- `src/lib/net/ephemeral/miscHandlers.ts` — emitChatTyping() helper
- `src/lib/net/ephemeral/effectHandlers.ts` — effect.placement.preview handler
- `src/lib/net/ephemeral/index.ts` — re-exports

**Files created (v0.6.87):**
- `src/stores/chatStore.ts` — Chat message + action entry store
- `src/components/cards/ChatCard.tsx` — Full chat UI with typing indicators

---

## Remaining Stub Emitters (Lower Priority)

These still have handlers + stores but no emitters. Wire as UI features mature:

- `mapObject.door.preview` — emit when toggling door open/close
- Handle previews (`token/region/mapObject.handle.preview`) — emit when rotate/scale handles are dragged
- Group ops — emit from group selection/drag
- `asset.uploadProgress` — emit during asset upload flows

---

## Implementation Order

```
P1: Token Drag → Ephemeral Migration       ✅ v0.6.80
P2: Token Position Sync (10Hz)             ✅ v0.6.81
P3: Aura State Emission                    ✅ (pre-existing)
P4a: Gate ACTION_CARD as DM-only           ✅ v0.6.79
P4b: action.pending ephemeral op           ✅ v0.6.82
P4c: action.resolution.claim               ✅ v0.6.82
P4d: Player-facing resolved history feed   ✅ v0.6.82
P5: Core stub emitters (chat/flash/effect) ✅ v0.6.86
P5+: Chat UI + menu buttons               ✅ v0.6.87
P6a: action.inProgress emitter             ✅ v0.6.90
P6b: initiative.drag/hover emitters        ✅ v0.6.90
P7: Remaining stub emitters                🔲 (as needed)
```
