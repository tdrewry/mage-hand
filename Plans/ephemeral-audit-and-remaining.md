# Ephemeral Network Audit & Remaining Tasks

## Current State Summary

All 7 phases of the ephemeral implementation are marked **DONE**. The infrastructure (EphemeralBus, TTLCache, ThrottleManager), handler registration, stores, and tests are complete. However, there's a significant gap between "handler registered" and "fully wired end-to-end."

---

## What's Actually Wired (emitters + handlers + rendering)

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
| `token.drag.begin/update/end` | ✅ | ✅ | ✅ (ghost token) | **Uses durable pipeline — needs migration** |

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
| `effect.aura.state` | ✅ | ✅ | Has helper fn | Not called from tickAuras |
| `action.flash` | ✅ | ✅ | ❌ | ❌ |
| `action.inProgress` | ✅ | ✅ | ❌ | ❌ |
| `action.queue.sync` | ✅ | ✅ | ❌ | ❌ |
| `mapObject.door.preview` | ✅ | ✅ | ❌ | ❌ |

---

## Critical Issue: Token Drag Uses Durable Pipeline

`dragOps.ts` calls `emitLocalOp()` which goes through the **durable** op pipeline (sequenced, acknowledged, logged). This is wrong for ephemeral drag previews. It should use `ephemeralBus.emit()` like all other ephemeral ops.

**Impact:** Token drags are persisted in op-log, inflate sequence numbers, and add unnecessary server load. On reconnect, stale drag ops may replay.

**Fix:** Rewrite `dragOps.ts` to use `ephemeralBus.emit()` and move the OpBridge handlers to `tokenHandlers.ts` ephemeral handlers.

---

## Priority 1 — Token Drag Migration to Ephemeral (Critical)

Migrate `token.drag.begin/update/end` from the durable `emitLocalOp` pipeline to `ephemeralBus.emit`. This fixes log pollution and aligns with the architecture.

**Files:**
- `src/lib/net/dragOps.ts` — replace `emitLocalOp` with `ephemeralBus.emit`
- `src/lib/net/OpBridge.ts` — remove the 3 drag handlers (they'll move to tokenHandlers)
- `src/lib/net/ephemeral/tokenHandlers.ts` — add inbound handlers for `token.drag.*` → `dragPreviewStore`

---

## Priority 2 — Frequency-Based Token Movement Sync (New Feature)

Add a **periodic position sync** so remote clients see token positions update in near-realtime even without explicit drag events. This covers cases like:
- Programmatic token movement (teleport, snap-to-grid adjustments)
- Multi-token group moves
- Any position change that bypasses the drag system

**Approach:** A new ephemeral op `token.position.sync` emitted at ~10 Hz that broadcasts changed token positions (delta-only — only tokens whose positions changed since last emit).

**New op kind:** `token.position.sync`
**Payload:** `{ positions: Array<{ tokenId: string; x: number; y: number }> }`
**Throttle:** 100ms (10 Hz)
**TTL:** 500ms

**Files:**
- `src/lib/net/ephemeral/types.ts` — add op kind and payload
- `src/lib/net/ephemeral/tokenHandlers.ts` — add handler that updates sessionStore positions (with echo guard)
- `src/components/SimpleTabletop.tsx` — add useEffect with interval that diffs token positions and emits changes

---

## Priority 3 — Effect Aura State Emission

Wire `emitAuraState()` (already exists in `effectHandlers.ts`) to be called from the aura tick loop in SimpleTabletop so remote clients receive aura updates.

**Files:**
- `src/components/SimpleTabletop.tsx` — call `emitAuraState()` after `tickAuras()` returns events

---

## Priority 4 — Action Resolution Coordination & Player Visibility

### Problem

Action Card resolution (attack rolls, damage, pass/fail, impact application) is **DM-only** work. Currently:
- The Action Card is visible to all roles — players could see and interact with resolution controls.
- No coordination exists to prevent multiple DMs from resolving the same action simultaneously.
- Players have no visual cue that a DM action resolution is pending.

### Requirements

1. **Action Card is DM-only.** Players MUST NOT see the resolution UI (impact buttons, hit/miss/half toggles, damage overrides, commit/cancel). The `ACTION_CARD` type must be added to `DM_ONLY_CARD_TYPES`.

2. **DM coordination for resolution.** When multiple DM sessions exist:
   - The action queue already syncs via `action.queue.sync` ephemeral op.
   - Only one DM should resolve at a time. Approach: **optimistic lock** — when a DM starts resolving a target (clicks hit/miss), broadcast a `action.resolution.claim` ephemeral op with the action ID and DM peer ID. Other DMs see a "Being resolved by [DM name]" indicator and their resolution controls are disabled for that action.
   - On commit/cancel, the claim is released and the updated queue syncs to all DMs.

3. **Player-facing visual cues for pending resolutions.** Players need to know something is happening without seeing DM-only data. Options (implement one or more):
   - **Line of intent / effect template overlay:** Already drawn for targeting — keep it visible during the resolve phase until commit/dismiss. The animated arcane line from caster to target or the effect shape stays rendered on the canvas.
   - **Toast / log entry:** A non-interactive toast or log line: *"[Caster] is resolving [Attack/Spell Name] against [Target(s)]..."* that auto-dismisses on commit.
   - **Token pulse effect:** Target tokens get a subtle pulsing ring (similar to hover rings) in a distinct color (amber/orange) indicating "pending resolution."
   - **Action history feed:** Players see committed (resolved) action results in a read-only history log — they see outcomes but not the resolution controls.

### Recommended Approach

- **Phase A:** Gate `ACTION_CARD` as DM-only (immediate, simple).
- **Phase B:** Add a lightweight `action.pending` ephemeral op that broadcasts `{ actionId, sourceName, attackName, targetNames[] }` to all peers. Player UI renders a toast or canvas overlay showing pending resolution. Auto-clears on commit/cancel.
- **Phase C:** Add `action.resolution.claim` ephemeral op for multi-DM coordination (only needed when multi-DM sessions are common).
- **Phase D:** Player-facing resolved action history — a read-only feed of committed action outcomes.

---

## Priority 5 — Remaining Stub Emitters (Lower Priority)

These have handlers+stores but no emitters. Wire them as the UI features mature:

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
P1: Token Drag → Ephemeral Migration
P2: Token Position Sync (10Hz)
P3: Aura State Emission
P4a: Gate ACTION_CARD as DM-only         ← done in this commit
P4b: action.pending ephemeral op + player toast/overlay
P4c: action.resolution.claim for multi-DM coordination
P4d: Player-facing resolved action history feed
P5: Remaining stub emitters (as needed)
```
