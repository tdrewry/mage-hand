# STEP-006 — Map Manager: Non-Focused Map Rendering Bugs

## Overview

Two distinct bugs in the Map Manager's non-focused map rendering:

### Bug 1: Dim/Blur > 0 Completely Hides Non-Focused Maps
Setting non-focused dim or blur to any value greater than 0 results in the non-focused map being completely invisible instead of visually dimmed/blurred. This is a CSS or canvas rendering parameter bug.

### Bug 2: Lock Non-Focused Selection Ignored for Tokens
The "lock non-focused selection" setting fails to prevent token selection on non-focused maps. If any selection attempt involves a token, the entire non-focused map's canvas entities (including non-token objects) become selectable alongside the token — clearly incorrect.

---

## Bug 1 Analysis: Dim/Blur Rendering

**Expected behavior:**
- `dim = 0` → non-focused map renders at full opacity
- `dim = 0.5` → non-focused map renders at 50% opacity  
- `dim = 1.0` → non-focused map is invisible
- `blur = 0` → no blur applied
- `blur = 5` → 5px gaussian blur applied

**Likely cause:** The dim value is being applied as `opacity = dim` instead of `opacity = 1 - dim`. Alternatively, the CSS `filter: blur()` or canvas `globalAlpha` is applied incorrectly — e.g., `globalAlpha = 0` (fully transparent) when dim > 0 because of an inverted condition.

**Investigation targets:**
- Search for where `nonFocusedDim` / `nonFocusedBlur` are read and applied
- Check if applied as `canvas.style.opacity = dim` (should be `1 - dim`)
- Check if `filter: blur(${blur}px)` is conditional on `blur > 0` (should be)

**Fix:** Correct the opacity/alpha calculation:
```ts
canvasElement.style.opacity = String(1 - nonFocusedDim);
canvasElement.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
```

---

## Bug 2 Analysis: Lock Non-Focused Selection + Token Selection

**Expected behavior:** When `lockNonFocusedSelection = true`, clicking on non-focused map entities should not add them to the selection — regardless of entity type.

**Bug:** Token selection bypasses the lock. When a token on a non-focused map is clicked, it is selected AND other canvas entities on that non-focused map become selectable alongside it.

**Likely cause:** The selection lock check is applied in a general entity hit-test path, but tokens may have a separate hit-test / click handler that doesn't respect the `lockNonFocusedSelection` flag. The "other entities selected alongside token" behavior suggests a group selection or bounding-box selection that fires after the token click.

**Investigation targets:**
- Find where token click/selection is handled vs. general entity click/selection
- Find where `lockNonFocusedSelection` is checked during hit testing
- Find if there's a "select all entities at point" logic that fires after token is selected

**Fix:**
1. Add `lockNonFocusedSelection` check to the token click/selection handler:
```ts
if (lockNonFocusedSelection && token.mapId !== activeFocusedMapId) {
  return; // Ignore selection on non-focused map
}
```
2. Ensure any post-click "expand selection to group" logic also checks map focus
3. If a token belongs to a group on a non-focused map, the entire group should be unselectable when locked

---

## Files to Modify

- `src/components/SimpleTabletop.tsx` — token click handler, entity hit-test, dim/blur application
- Wherever `nonFocusedDim`, `nonFocusedBlur`, `lockNonFocusedSelection` are read and applied
- Map data schema — add `nonFocusedDim` and `nonFocusedBlur` fields per map
- Map Manager widget — move dim/blur controls from global session panel into per-map settings

---

## Per-Map Dim/Blur Settings (New Requirement)

Currently `nonFocusedDim` and `nonFocusedBlur` are global session settings. They should become **per-map** properties, stored on the map entity itself:

```ts
interface MapEntry {
  // ... existing fields ...
  nonFocusedDim: number;   // 0.0–1.0, default 0.0
  nonFocusedBlur: number;  // px, default 0
}
```

When a map is non-focused, the renderer reads **that map's own** `nonFocusedDim`/`nonFocusedBlur` values rather than a global. This allows the DM to configure: "this dark dungeon map is heavily dimmed when not in focus; this outdoor map is only slightly dimmed."

The global session-level settings in the Map Manager widget are removed and replaced with per-map controls in the map's property panel.

---

## Outstanding Questions for User Review

1. ~~**Dim scale:**~~ ✅ **RESOLVED** — `dim = 1.0` means fully hidden (opacity 0). The current UI cap of 0.8 is a bug/oversight; default cap is raised to 1.0. Full range 0.0→1.0 is exposed. If the DM wants content to always be slightly visible they set the slider below max naturally.
2. **Blur interaction with dim:** When both dim AND blur are applied, should they compound (dimmed AND blurred) or should blur be primary? Compound is more natural.
3. **Lock non-focused — feedback:** When a user tries to click an entity on a locked non-focused map, should there be visual feedback (cursor change, brief flash) indicating it's locked?
4. **Lock non-focused — DM exception:** Should the DM be exempt from the lock? I.e., DM can always select non-focused map entities even when lock is enabled.

---

## Verification
1. Set non-focused dim = 0.3 on a specific map → verify only that map renders at 70% opacity; other non-focused maps unaffected
2. Set non-focused dim = 1.0 → verify map is fully invisible
3. Set non-focused blur = 5 → verify non-focused map appears blurred (not hidden)
4. Set dim = 0 → verify map is fully visible
5. Enable `lockNonFocusedSelection`, click a token on non-focused map → verify nothing is selected
6. Enable `lockNonFocusedSelection`, click a map object on non-focused map → verify nothing is selected
7. Disable lock, click token on non-focused map → verify token (only) is selected, not all entities
