# Ephemeral Network Audit & Remaining Tasks

## Current State Summary

All 7 phases of the ephemeral implementation are **DONE**. Priorities 1–4 have been implemented. The remaining work (P5) consists of stub emitters that should be wired as their corresponding UI features mature.

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
| `chat.typing` | ✅ | ✅ | ❌ | ❌ |
| `initiative.drag.preview` | ✅ | ✅ | ❌ | ❌ |
| `initiative.hover` | ✅ | ✅ | ❌ | ❌ |
| `group.select.preview` | ✅ | ✅ | ❌ | ❌ |
| `group.drag.preview` | ✅ | ✅ | ❌ | ❌ |
| `asset.uploadProgress` | ✅ | ✅ | ❌ | ❌ |
| `effect.placement.preview` | ✅ | stub | ❌ | ❌ |
| `action.flash` | ✅ | ✅ | ❌ | ❌ |
| `action.inProgress` | ✅ | ✅ | ❌ | ❌ |
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

## Priority 5 — Remaining Stub Emitters (Lower Priority)

These have handlers + stores but no emitters. Wire them as the UI features mature:

- `chat.typing` — emit from chat input in NetworkDemoCard or future chat UI
- `action.flash` / `action.inProgress` — emit from action resolution system
- `effect.placement.preview` — emit during effect placement mode
- `mapObject.door.preview` — emit when toggling door open/close
- Handle previews (`token/region/mapObject.handle.preview`) — emit when rotate/scale handles are dragged
- Initiative ops — emit from InitiativePanel drag/hover
- Group ops — emit from group selection/drag

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
P5: Remaining stub emitters                🔲 (as needed)
```
