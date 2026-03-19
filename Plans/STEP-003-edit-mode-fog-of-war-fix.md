# STEP-003 — DM Edit Mode: Disable Fog of War

## Overview

**Bug:** When a DM is in Edit Mode (`renderingMode === 'edit'`) with Fog of War enabled, fog computation runs and throws:
```
provider.tsx:97 Fog computation error: TypeError: paper.Path is not a constructor
    at computeFog (SimpleTabletop.tsx:2548:34)
```

**Correct behavior:** In Edit Mode, the DM's canvas **hides** the PixiJS fog-of-war layer and any post-processing effects (e.g. vignette, darken overlay). **Fog computation continues running** — connected players still receive the full fog-of-war experience in real time. The fog state is never cleared or invalidated; only the DM's local render visibility changes.

This is a **DM-only, local-only** change. It must not affect what any other client sees.

---

## Root Cause Analysis

Two separate issues:

### Issue 1: Fog renders in Edit Mode for the DM
Fog computation runs (correctly — players still need it). But the **PixiJS fog container / render layer** is not toggled off for the DM when Edit Mode is active.

**Fix:** When `renderingMode === 'edit'` (DM-side only), set the PixiJS fog layer to invisible:
```ts
// In the PixiJS render setup or useEffect that watches renderingMode:
if (fogLayer) {
  fogLayer.visible = renderingMode !== 'edit';  // DM in edit mode → hide layer
}
// Same for any post-processing containers (vignette, darken, blur pass):
if (postProcessingLayer) {
  postProcessingLayer.visible = renderingMode !== 'edit';
}
```
Fog computation (`computeFog`) continues to run unchanged — its output is still pushed to Jazz / ephemeral for players.

### Issue 2: `paper.Path is not a constructor`
When fog computation does run, `paper.Path` constructor fails. This indicates `paper.js` is not initialized, or the `paper` scope is not set up before `computeFog` is called. This may be an async initialization race or an import-order issue.

**Likely cause:** `paper.setup(canvas)` has not been called before `computeFog` runs, or the paper instance is a different scope than the one used in `computeFog`. Paper.js requires `paper.setup()` or `paper.install(window)` before using `paper.Path`.

**Fix:** 
1. Add a `paperReady` ref/flag that is set to `true` only after `paper.setup()` completes
2. Guard `computeFog` with `if (!paperReady.current) return;`
3. Investigate whether `paper` is imported as ESM module scope or global scope — ensure consistency

---

## Files to Modify

- `src/components/SimpleTabletop.tsx`
  - PixiJS fog layer / post-processing layer visibility toggle
  - Guards to NOT skip `computeFog` — it must still run for players
  - paper.js initialization (`paperReady` tracking)

---

## Proposed Changes

### Fix 1: Hide PixiJS fog and post-processing layers for DM in Edit Mode
```ts
// Wherever renderingMode is watched (useEffect):
useEffect(() => {
  if (!fogLayerRef.current) return;
  const isDMEditMode = renderingMode === 'edit';
  fogLayerRef.current.visible = !isDMEditMode;
  if (postProcessingLayerRef.current) {
    postProcessingLayerRef.current.visible = !isDMEditMode;
  }
  // NOTE: computeFog() is NOT suppressed — players still need it
}, [renderingMode]);
```

### Guard 2: paper.js initialization safety
```ts
const paperReadyRef = useRef(false);

// After paper.setup() call:
paperReadyRef.current = true;

// In computeFog:
function computeFog(...) {
  if (!paperReadyRef.current) {
    console.warn('[Fog] paper.js not ready, skipping fog computation');
    return;
  }
  // ... existing code
}
```

---

## Outstanding Questions for User Review

1. ~~**Fog visibility behavior in Edit Mode:**~~ ✅ **RESOLVED** — Hide the PixiJS fog layer and post-processing effects on the DM's canvas via `layer.visible = false`. Fog computation continues running so players still see fog. DM-local change only, no effect on other clients.

2. **Edit Mode indicator:** Should there be a visible indicator in Edit Mode that fog is hidden for the DM (so they don't forget what players are seeing)?

3. **paper.js error reproducibility:** Is the `paper.Path` error consistent (every time fog runs in edit mode) or intermittent? This affects whether it's a race condition or an import issue.

---

## Verification
1. Enable Fog of War on player clients, switch DM to Edit Mode → verify DM sees full map, players still see fog
2. Switch DM back to Play Mode → verify DM sees fog immediately (no recompute delay, layer just re-shows)
3. Hard refresh DM in Edit Mode → verify fog remains hidden, players unaffected
4. Fix paper.js error: switch to Play Mode with fog enabled → verify no console error
