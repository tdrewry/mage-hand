# STEP-001 — Bulk Canvas Entity Actions

## Overview

When multiple Canvas Entities are selected the Bottom Navbar shows context-sensitive actions. Currently only tokens have a meaningful bulk action set. This plan defines **which bulk actions should exist per entity type** and implements the missing ones.

**Rule:** Same-type selections unlock type-specific bulk actions. Mixed-type selections expose only universal actions (Delete, Group).  
**Exception:** Token image bulk-assign supports multi-file upload to randomly distribute images across selected tokens.

---

## Current State

| Action | Tokens | Regions | Map Objects | Lights | Groups |
|---|---|---|---|---|---|
| Delete | ✅ | ✅ (now fixed) | ✅ | ✅ (now fixed) | ✅ |
| Group/Ungroup | ✅ | ✅ | ✅ | ✅ | ✅ |
| Color | ✅ | ❌ | ❌ | ❌ | — |
| Role assign | ✅ | — | — | — | — |
| Vision toggle | ✅ | — | — | — | — |
| Illumination | ✅ | — | — | ❌ | — |
| Elevation | ✅ | — | — | — | — |
| Rotation | ✅ | — | — | — | — |
| Statuses | ✅ | — | — | — | — |
| Initiative | ✅ | — | — | — | — |
| Image assign | ✅ (single) | — | ✅ (single) | — | — |
| Lock/Unlock | — | — | ❌ | — | ✅ |
| Opacity | — | ❌ | ❌ | ❌ | — |
| Visibility (hide) | ✅ | ❌ | ❌ | ❌ | — |

✅ = implemented | ❌ = missing, should add | — = not applicable

---

## Proposed Actions to Add

### All Canvas Entities (mixed selection)
None beyond delete and group — already implemented.

### Tokens (same-type selection)
- **Image Bulk Assign** — Open file picker supporting multi-select. Randomly distribute one file per token. If fewer files than tokens, cycle. Tokens with no file retain current image. (`handleBulkImageAssign`)
- All existing actions already implemented ✅

### Regions (same-type selection)
- **Fill Color** — Color picker to set `fillColor` on all selected regions
- **Opacity** — Slider 0–100% → `opacity` field
- **Visibility Toggle** — Show/hide (if regions support a hidden flag)
- **Type Change** — Dropdown to reassign region type (fog zone, water, trap, etc.)

### Map Objects (same-type selection)
- **Image Bulk Assign** — Same multi-file random assign as tokens
- **Opacity** — Slider → `opacity` field on MapObject
- **Lock/Unlock** — Toggle `locked` flag across all selected
- **Category Change** — Reassign category (column → debris, etc.)

### Lights (same-type selection)
- **Radius** — Slider to set uniform radius across all selected lights
- **Color** — Color picker → light color
- **Intensity** — Slider 0–1

### Groups (single group selected)
Existing Lock/Unlock/Ungroup/Export already implemented ✅

---

## Implementation Plan

### BottomNavbar.tsx Changes
1. Add `isHomogeneous(type)` helper — returns true if all selected entity IDs are of the given type and no other type is also selected
2. Add Region bulk action panel (conditional on `isHomogeneous('region') && selectedRegionIds.length > 0`)
3. Add Map Object bulk action panel (conditional on `isHomogeneous('mapObject')`)
4. Add Light bulk action panel (conditional on `isHomogeneous('light')`)
5. Add Token image bulk-assign button + file input handler

### Token Image Bulk Assign
```
<input type="file" multiple accept="image/*" />
→ shuffle files array
→ zip with selectedTokens
→ for each token: load blob → store in IndexedDB → update token.imageHash
→ push texture to Jazz after all tokens updated
```

### Store API Additions Needed
- `regionStore.updateMultipleRegions(ids, updates)` — add (mirrors `updateMultipleMapObjects`)
- `lightStore.updateMultipleLights(ids, updates)` — add

---

## Outstanding Questions for User Review

1. ~~**Token image bulk-assign randomization:**~~ ✅ **ALREADY IMPLEMENTED** — existing behavior is retained as-is.
2. **Opacity for regions:** Regions currently store opacity — does this control fill opacity, stroke opacity, or both?
3. **Region Visibility:** Do regions need an `isHidden` flag, or is opacity=0 sufficient for hide?
4. **Map Object Category Change bulk:** This seems risky (could change doors back to columns accidentally). Should this be limited or require a confirmation?
5. **Light color/radius in bulk:** Should lights snap to a common value (the first selected light's value) when the slider opens, or start at a neutral default?

---

## Verification
- Select 3 tokens → image bulk-assign with 2 files → verify random distribution
- Select 3 regions → change opacity → verify all update
- Select mixed (1 token + 1 region) → verify only universal actions show
- Select 2 lights → change radius → verify both update and re-render
