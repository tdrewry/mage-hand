# Mage-Hand Network & Sync Policy

> **Version:** v0.7.418 · Last updated: 2026-03-20
> 
> This document codifies the architectural decisions governing real-time data sync,
> Jazz CRDT usage, WebRTC ephemeral communication, and performance budgets in Mage-Hand.
> All future feature work touching the sync layer must comply with this policy.

---

## 1. Transport Layers

Mage-Hand uses **two complementary transports** that serve distinct purposes:

| Layer | Technology | Purpose | Persistence |
|---|---|---|---|
| **Ephemeral** | WebRTC (peer-to-peer) | Real-time previews, pointer positions, drag previews, edit lifecycle signals | None — messages are lost on peer disconnect |
| **CRDT** | Jazz.tools CoValues | Authoritative state — regions, map objects, tokens, maps, settings | Persistent — synced via Jazz Durable Objects (DO) |

> [!IMPORTANT]
> These layers must **never be used interchangeably**. Ephemeral data must never be written
> to Jazz CoValues per-frame during live operations. Jazz CoValues must never be relied on
> for sub-100ms latency feedback.

---

## 2. Canvas Entity Sync Policy

### 2.1 Entity Categories

| Category | Examples | Realtime Preview | Commit Path |
|---|---|---|---|
| **Tokens** | Player tokens, NPC tokens | ✅ WebRTC drag.update | Jazz on mouseup via `markTokenDragEnd` |
| **Regions** | Map rooms, corridors, polygons | ⚠️ Gated (see §2.2) | Jazz on mouseup via `syncRegionsToJazz` |
| **Map Objects** | Walls, doors, annotations | ⚠️ Gated (see §2.2) | Jazz on mouseup via `syncMapObjectsToJazz` |
| **Effects / Templates** | Auras, placed effects | ❌ No live preview | Jazz on commit |
| **Lights / Illumination** | Light sources | ❌ No live preview | Jazz on commit |

### 2.2 Canvas Edit Subscription Lifecycle

Canvas entity transforms (drag, rotate, resize, property changes) use a **pause/resume** model
to prevent Jazz subscription callback flooding on observer clients.

**Protocol:**

```
Editor                          Observer Client
  │                                    │
  │── canvas.edit.begin (WebRTC) ──►  │  pause Jazz→Zustand subscriptions
  │                                    │  show "Pending..." UI
  │  [transform in progress]           │  buffer latest Jazz snapshots
  │                                    │
  │── canvas.edit.end (WebRTC) ────►  │  show "Loading..." UI
  │                                    │  apply buffered snapshot (one hydration pass)
  │                                    │  show idle UI
```

**Why this works:** instead of N×K individual Jazz CoValue.set() callbacks firing
sequentially on the client (N regions × K fields each), the client receives one
final CRDT snapshot and applies it in a single `runFromJazz` pass — exactly the
same behavior as joining a session from the landing page.

**Fallback:** if `canvas.edit.end` is never received (dropped WebRTC packet),
a 5-second auto-resume timer fires and sets `status = 'partial'`. The Network
Profiler shows a **⚠ Partial** badge in the Ephemeral WebRTC section.

### 2.3 Live Drag Preview Feature Flag

```typescript
// featureFlags.ts
export const FEATURE_CANVAS_DRAG_LIVE_PREVIEW = false;
```

When `false` (default and recommended):
- No per-frame Jazz writes for canvas entities during drag
- No sibling region `region.drag.update` broadcasts
- Only the primary region's drag preview is emitted (existing single-region path)
- Map objects and lights commit silently on mouseup

When `true` (requires action-owner guard not yet implemented):
- Sibling regions and map objects emit live drag positions at `CANVAS_DRAG_BROADCAST_FPS`
- Risk of feedback loops without the action-owner guard in place

### 2.4 FPS Budget

```typescript
// featureFlags.ts
export const CANVAS_DRAG_BROADCAST_FPS = 15; // ~67ms between frames
```

All canvas entity ephemeral broadcasts are throttled to this budget.
Tokens are exempt and use their own throttle.

---

## 3. Jazz CRDT Write Policy

### 3.1 Per-Kind Sync Throttle

```typescript
// featureFlags.ts
export const JAZZ_SYNC_THROTTLE_MS: Record<string, number> = {
  regions:          1,    // Near-immediate — drag commits land fast
  mapObjects:       12,   // ~1 frame
  effects:         200,   // Less time-critical
  illumination:    200,
  customTemplates: 500,
};
```

These values control the trailing-edge debounce in `throttledPushFineGrained()` in `bridge.ts`.
Tuning guidance:
- Keep `regions` and `mapObjects` ≤ 16ms so drag-drop commits are atomic
- Higher values for rarely-changed kinds reduce DO operation count

### 3.2 Field-Level Diff

`syncRegionsToJazz` and `syncMapObjectsToJazz` diff at the **field level** before writing.
Only fields that changed between previous and current state are written via `CoValue.set()`.

For a position-only drag commit on 8 regions:
- **Before:** ~160 Jazz ops (8 regions × ~20 fields)
- **After:** ~40 Jazz ops (8 regions × ~5 changed fields: x, y, width, height, pathPointsJson)

### 3.3 Flush on Commit

`flushPendingSync(kind)` should be called after any batch Zustand write (e.g., mouseup)
to bypass the throttle timer and immediately fire `syncRegionsToJazz` / `syncMapObjectsToJazz`.

```typescript
// SimpleTabletop.tsx — mouseup path
flushPendingSync('regions');
flushPendingSync('mapObjects');
emitCanvasEditEnd(ownerId);   // must come AFTER flushPendingSync
```

### 3.4 Jazz Free Tier Constraints

Mage-Hand targets the **Jazz.tools free tier**. Every Jazz CoValue.set() call counts as
a DO operation. The policy to stay within budget:

| Rule | Rationale |
|---|---|
| No per-frame Jazz writes during drag | Drag at 60fps × N regions × K fields = thousands of ops/minute |
| Field-level diff before any CoValue.set | Avoids writing unchanged fields (e.g. color, gridType during position-only moves) |
| Inbound subscription debounce on clients | Prevents re-processing the same snapshot N×K times |
| Canvas edit pause/resume lifecycle | Eliminates all intermediate-state ops on observer clients |
| Blob sync throttle at 1Hz (`BLOB_THROTTLE_MS`) | Prevents rapid JSON blob re-serialization |

---

## 4. Action Owner Guard (Pending)

> [!WARNING]
> `FEATURE_CANVAS_DRAG_LIVE_PREVIEW` must remain `false` until the action-owner guard
> is implemented. Without it, observer clients can write received drag positions back
> into Jazz, creating a feedback loop.

**Planned behavior:**
- Any Jazz CoValue write for canvas entities must be gated on `_isCreator` OR
  `currentPlayerId === eventOwnerId`
- Observer clients (non-DM or non-owning DM) must ignore position writes that
  originate from their own subscription callback

This applies to all multi-DM scenarios where two DMs could be editing simultaneously.

---

## 5. Inbound Subscription Rules

### On Observer Clients:
1. **During canvas.edit.begin → canvas.edit.end window:** buffer latest snapshot, do not apply
2. **On canvas.edit.end:** apply buffered snapshot once (one hydration pass)
3. **All other times:** apply incoming Jazz mutations after `JAZZ_SYNC_THROTTLE_MS[kind]` debounce
4. **On `_fromJazz` flag:** skip outbound sync to prevent echo (existing behavior)

### On Editor Client (host):
1. `_fromJazz` flag prevents echo during hydration
2. Creator startup grace (`STARTUP_GRACE_MS`) suppresses inbound during initial propagation
3. Canvas edit events are emitted outbound only — editors do not process their own `canvas.edit.begin`

---

## 6. UI Feedback for Sync State

| Status | Trigger | UI | Location |
|---|---|---|---|
| `pending` | `canvas.edit.begin` received | ⏳ Pending... (amber pill) | Top-left canvas overlay |
| `loading` | `canvas.edit.end` received, hydrating | ⬇ Loading... + bar (blue pill) | Top-left canvas overlay |
| `idle` | Hydration complete | Hidden | — |
| `partial` | Auto-resume after 5s timeout | ⚠ Partial (rose pill) | Top-left + Network Profiler badge |

Component: `CanvasEditStatusBar.tsx`
Store: `useCanvasEditStatusStore.ts`

---

## 7. What is NOT Covered by This Policy

These entity types use their own established patterns and are **excluded** from canvas
edit lifecycle gating:

| Entity | Pattern | Reason |
|---|---|---|
| **Tokens** | `markTokenDragStart/End` + per-frame `token.drag.update` | Already correct; separate Jazz path |
| **Effect templates** | Blob sync at 1Hz | Rarely edited collaboratively |
| **Chat messages** | Direct Jazz push | Append-only, no conflict risk |
| **Fog of war** | DM-local compute, no Jazz sync | Per-client rendering |

---

*Reference implementations: `bridge.ts` (Jazz sync), `mapHandlers.ts` (ephemeral),
`featureFlags.ts` (configuration), `SimpleTabletop.tsx` (emit callsites).*
