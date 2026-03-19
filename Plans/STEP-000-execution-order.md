# Mage-Hand Work Plan — Execution Order Summary

## Overview

This document sequences all STEP plans in the recommended execution order, accounting for dependencies between systems.

---

## Execution Phases

### Phase 1 — Bug Fixes & Quick Wins
*No design dependencies. Each is independently shippable.*

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 1 | [STEP-001](./STEP-001-bulk-canvas-entity-actions.md) — Bulk Canvas Entity Actions | Medium | High — completes the selection/edit system |
| 2 | [STEP-003](./STEP-003-edit-mode-fog-of-war-fix.md) — Edit Mode Fog of War Fix | Small | Medium — prevents DM workflow crashes |
| 3 | [STEP-006](./STEP-006-map-manager-nonfocused-bugs.md) — Map Manager Non-Focused Bugs | Small | Medium — restores expected multi-map behavior |
| 4 | [STEP-005](./STEP-005-standard-canvas-redraw.md) — Standard Canvas Redraw Command | Small | Medium — infrastructure + fixes map switch artifact |

### Phase 2 — Network & Sync Improvements
*Builds on stable canvas infrastructure from Phase 1.*

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 5 | [STEP-004](./STEP-004-region-texture-sync-late-join.md) — Region Texture Sync for Late Joins | Small | High — fixes client join UX |

### Phase 3 — Lighting System Unification
*Prerequisite for Item system (Phase 4).*

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 6 | [STEP-002](./STEP-002-merge-lighting-models.md) — Merge Lighting Models | Medium | High — eliminates dual pipeline maintenance |

### Phase 4 — Token / Character Data Model
*Foundational schema used by Item (Phase 5) and Compendium (Phase 6).*

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 7 | [STEP-009](./STEP-009-generic-token-character-sheet-schema.md) — Generic Token / Character Sheet Schema | Large | Very High — enables multi-system support, item sheets, monster import |

### Phase 5 — Item Canvas Entity System
*Depends on STEP-002 (unified lights) and STEP-009 (item schema).*

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 8 | [STEP-007](./STEP-007-item-canvas-entity-system.md) — Light Source → Item Entity System | Large | High — new entity type, loot/carry mechanics |

### Phase 6 — Compendium Sync & Monster Data
*Depends on STEP-009 schema (CharacterRef type).*

| Order | Plan | Effort | Impact |
|---|---|---|---|
| 9 | [STEP-008](./STEP-008-compendium-sync-strategy.md) — Compendium Sync Strategy | Large | High — enables multi-DM sessions, correct data isolation |

---

## Dependency Map

```
STEP-001 ──────────────────────────────────────────────────────── (standalone)
STEP-003 ──────────────────────────────────────────────────────── (standalone)
STEP-006 ──────────────────────────────────────────────────────── (standalone)
STEP-005 ──────────────────────────────────────────────────────── (standalone, needed by 007)
STEP-004 ──────────────────────────────────────────────────────── (standalone)
STEP-002 ──────────────────────────── needed by ──► STEP-007
STEP-009 ──────────────────────────── needed by ──► STEP-007
                                   └── needed by ──► STEP-008
STEP-007 ──────────────────────────────────────────────────────── (after 002 + 009)
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


---

## Effort Legend
| Effort | Estimated Scope |
|---|---|
| Small | 1–2 focused files, < 200 lines |
| Medium | 3–5 files, 200–500 lines |
| Large | Cross-system, 500+ lines, new stores/schemas |
