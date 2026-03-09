# Zoom Fog Desync & Passive Wheel Listener Fix (v0.7.133 → v0.7.134)

## Problems
1. Fog of war rendering desynced from the map during zoom (offset/drift)
2. Console error: "Unable to preventDefault inside passive event listener invocation"

## Root Causes

### Fog Desync (v0.7.131 regression)
The v0.7.131 fix introduced `quantizedZoom` for fog canvas sizing. `fogBounds` computed `originX`/`originY` using `quantizedZoom` while fog *rendering* used real `transform.zoom`, causing positional mismatch.

### Fog Desync (v0.7.133 incomplete fix)
Removing quantizedZoom exposed a second issue: every zoom tick changed fogBounds origin, which triggered either:
- `resizePostProcessing()` → `renderer.resize()` → WebGL canvas cleared (thrashing)
- `initFogCanvas()` (origin-change detection) → offscreen canvas reallocation (thrashing)

### Passive Wheel
React's `onWheel` handler is passive by default; `preventDefault()` is a no-op.

## Fixes (v0.7.134)

### 1. Removed quantizedZoom, use real zoom everywhere
fogBounds uses `transform.zoom` for correct origin/dimension calculation.

### 2. Split resize vs reposition in usePostProcessing
- **GPU resize** (expensive): only when width/height change by >10%
- **CSS reposition** (cheap): when only origin changes — new `repositionPostProcessing()` just updates CSS `left`/`top`

### 3. Fog canvas origin tracking without reinit
`applyFogPostProcessing` no longer calls `initFogCanvas` when only origin changed — just updates tracking vars.

### 4. Native wheel listener with passive:false
Replaced React `onWheel` with native `addEventListener('wheel', ..., { passive: false })`.

## Files Changed
- `src/components/SimpleTabletop.tsx` — removed quantizedZoom, native wheel listener
- `src/hooks/usePostProcessing.ts` — resize vs reposition split
- `src/lib/postProcessingLayer.ts` — new `repositionPostProcessing()`
- `src/lib/fogPostProcessing.ts` — origin-only update without canvas reinit
- `src/lib/version.ts` — 0.7.134
