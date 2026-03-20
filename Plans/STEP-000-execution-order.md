# Mage-Hand Work Plan — Execution Order Summary

## Overview

This document sequences all STEP plans in the recommended execution order, accounting for dependencies between systems.

> [!IMPORTANT]
> All feature work touching the real-time sync layer (Jazz CRDT, WebRTC ephemeral,
> canvas entity transforms) **must comply with [SYNC-POLICY.md](./SYNC-POLICY.md)**.
> Key constraints: no per-frame Jazz writes during drag, field-level diff before CoValue.set,
> canvas edit pause/resume lifecycle for observer clients, Jazz free-tier op budget.

---

## Completed Sync Work (v0.7.414 – v0.7.418)

The following were implemented outside the STEP plan sequence to resolve active
performance regressions on the Jazz free tier:

| Version | Change |
|---|---|
| v0.7.414 | `FEATURE_CANVAS_DRAG_LIVE_PREVIEW` flag (default off); `CANVAS_DRAG_BROADCAST_FPS` cap (15fps); removed double-emit bug on primary region drag |
| v0.7.415 | `JAZZ_SYNC_THROTTLE_MS` per-kind config in `featureFlags.ts`; `flushPendingSync(kind)` export in `bridge.ts`; flush called on mouseup to commit all positions atomically |
| v0.7.416 | `syncRegionsToJazz` field-level diff — only writes changed fields per region (~4x fewer Jazz ops for position-only drag) |
| v0.7.417 | Inbound Jazz→Zustand region subscription debounced — collapses N callback fires into one hydration pass |
| v0.7.418 | **Canvas edit subscription lifecycle**: `canvas.edit.begin/end` ephemeral events; observer clients pause subscriptions during host transforms and resume atomically; `CanvasEditStatusBar` UI (Pending/Loading/Partial); `SyncProfilerPanel` Partial badge; 5s auto-resume fallback |

---

## Execution Phases

### Phase 1 — Bug Fixes & Quick Wins
*No design dependencies. Each is independently shippable.*

> **Sync note:** STEP-001 adds bulk canvas entity actions (select-all, bulk property edit).
> Any bulk property writes must use `flushPendingSync` after the write batch and emit
> `canvas.edit.begin/end` around the operation. See SYNC-POLICY §2.2.

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 1 | [STEP-001](./STEP-001-bulk-canvas-entity-actions.md) — Bulk Canvas Entity Actions | Medium | High — completes the selection/edit system |
| 2 | [STEP-003](./STEP-003-edit-mode-fog-of-war-fix.md) — Edit Mode Fog of War Fix | Small | Medium — prevents DM workflow crashes |
| 3 | [STEP-006](./STEP-006-map-manager-nonfocused-bugs.md) — Map Manager Non-Focused Bugs | Small | Medium — restores expected multi-map behavior |
| 4 | [STEP-005](./STEP-005-standard-canvas-redraw.md) — Standard Canvas Redraw Command | Small | Medium — infrastructure + fixes map switch artifact |

### Phase 2 — Network & Sync Improvements
*Builds on stable canvas infrastructure from Phase 1.*

> **Sync note:** STEP-004 addresses region texture sync. Texture resolution runs outside
> `runFromJazz` (already implemented). Texture arrival must trigger `canvas.forceRedraw`
> or integrate with the `CanvasEditStatusBar` loading state. No new Jazz writes per-frame.

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 5 | [STEP-004](./STEP-004-region-texture-sync-late-join.md) — Region Texture Sync for Late Joins | Small | High — fixes client join UX |
| — | **Action-Owner Guard** *(unplanned, required before enabling live preview)* | Small | High — prevents feedback loop, enables `FEATURE_CANVAS_DRAG_LIVE_PREVIEW = true` |

### Phase 3 — Lighting System Unification
*Prerequisite for Item system (Phase 4).*

> **Sync note:** Lighting changes use `throttledPushFineGrained('illumination', ...)` at 200ms.
> No live preview for lights. Light edits are single-shot; no drag lifecycle needed.

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 6 | [STEP-002](./STEP-002-merge-lighting-models.md) — Merge Lighting Models | Medium | High — eliminates dual pipeline maintenance |

### Phase 4 — Token / Character Data Model
*Foundational schema used by Item (Phase 5) and Compendium (Phase 6).*

> **Sync note:** Token schema changes go through the existing token Jazz path (`JazzToken`).
> Token drags remain exempt from canvas edit lifecycle gating — they use `markTokenDragStart/End`.

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 7 | [STEP-009](./STEP-009-generic-token-character-sheet-schema.md) — Generic Token / Character Sheet Schema | Large | Very High — enables multi-system support, item sheets, monster import |

### Phase 5 — Item Canvas Entity System
*Depends on STEP-002 (unified lights) and STEP-009 (item schema).*

> **Sync note:** `CanvasItem` is a new Jazz entity type. Its sync path must follow the
> canvas entity policy: no per-frame writes during drag, field-level diff on commit,
> `canvas.edit.begin/end` lifecycle events. Add `items` kind to `JAZZ_SYNC_THROTTLE_MS`.

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 8 | [STEP-007](./STEP-007-item-canvas-entity-system.md) — Light Source → Item Entity System | Large | High — new entity type, loot/carry mechanics |

### Phase 6 — Compendium Sync & Monster Data
*Depends on STEP-009 schema (CharacterRef type).*

> **Sync note:** Compendium data is read-heavy and write-rare. Blob sync at 1Hz is
> appropriate. Multi-DM compendium writes must use action-owner guard (SYNC-POLICY §4).

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 9 | [STEP-008](./STEP-008-compendium-sync-strategy.md) — Compendium Sync Strategy | Large | High — enables multi-DM sessions, correct data isolation |

---

## Dependency Map

```
SYNC-POLICY ────────────────── governs all phases below
STEP-001 ──────────────────────────────────────────────────────── (standalone, requires sync §2.2)
STEP-003 ──────────────────────────────────────────────────────── (standalone)
STEP-006 ──────────────────────────────────────────────────────── (standalone)
STEP-005 ──────────────────────────────────────────────────────── (standalone, needed by 007)
STEP-004 ──────────────────────────────────────────────────────── (standalone, requires sync §2.3)
Action-Owner Guard ─────────── unlocks FEATURE_CANVAS_DRAG_LIVE_PREVIEW = true
STEP-002 ──────────────────────────── needed by ──► STEP-007
STEP-009 ──────────────────────────── needed by ──► STEP-007
                                   └── needed by ──► STEP-008
STEP-007 ──────────────────────────────────────────────────────── (after 002 + 009, requires sync §2.2)
STEP-008 ──────────────────────────────────────────────────────── (after 009)
```

---

## Open Questions — All Resolved ✅

| # | Question | Decision |
|---|---|---|
| 1 | Action Formula Language | Peggy DSL + AST interpreter. DM-role client evaluates; multi-DM claim protocol; cards as first-class RNG source; full roll audit trail. |
| 2 | Light Source → Item migration | No backward compat needed (app never shipped). `lightStore` deleted outright, replaced by `itemStore` / `CanvasItem`. |
| 3 | Features vs. Traits | Merged into single `features[]` array. `EntityFeature` gains `featureType: 'feature' \| 'trait'` and `source?: string`. |
| 4 | Bulk Token Image Randomization | Already implemented — existing behavior retained. |
| 5 | Edit Mode Fog Visibility | Hide PixiJS fog layer + post-processing on DM canvas only (`layer.visible = false`). Fog computation continues for players. |
| 6 | Non-Focused Dim Max | `dim = 1.0` = fully invisible. UI cap raised from 0.8 → 1.0. Dim/blur become per-map settings (not global). |
| 7 | Canvas Entity Sync Model | Pause/resume via `canvas.edit.begin/end` ephemeral. No per-frame Jazz writes. Field-level diff. See SYNC-POLICY.md. |
| 8 | Jazz Free Tier Budget | Per-kind throttle + field diff + flush on commit + subscription lifecycle. Live preview gated behind feature flag until action-owner guard implemented. |

---

## Effort Legend
| Effort | Estimated Scope |
|---|---|
| Small | 1–2 focused files, < 200 lines |
| Medium | 3–5 files, 200–500 lines |
| Large | Cross-system, 500+ lines, new stores/schemas |

---

## Effort Legend
| Effort | Estimated Scope |
|---|---|
| Small | 1–2 focused files, < 200 lines |
| Medium | 3–5 files, 200–500 lines |
| Large | Cross-system, 500+ lines, new stores/schemas |
