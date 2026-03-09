# Zoom Fog Desync & Passive Wheel Listener Fix (v0.7.133 → v0.7.138)

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

### Fog Desync (v0.7.134 incomplete fix — Canvas2D/PixiJS size mismatch)
The v0.7.134 split of resize vs reposition in usePostProcessing used a >10% threshold for GPU resizes. But `applyFogPostProcessing` auto-resized Canvas2D canvases on every zoom tick (exact pixel match check). This caused the Canvas2D fog texture to be a different size than the PixiJS renderer, producing offset/clipping during zoom.

### Passive Wheel
React's `onWheel` handler is passive by default; `preventDefault()` is a no-op.

## Fixes

### 1. Removed quantizedZoom, use real zoom everywhere (v0.7.133)
fogBounds uses `transform.zoom` for correct origin/dimension calculation.

### 2. Split resize vs reposition in usePostProcessing (v0.7.134)
- **GPU resize** (expensive): only when width/height change by >10%
- **CSS reposition** (cheap): when only origin changes — `repositionPostProcessing()` updates CSS `left`/`top`

### 3. Removed Canvas2D auto-resize in applyFogPostProcessing (v0.7.136)
Canvas2D fog canvases are now managed exclusively by `usePostProcessing` (via `initFogCanvas`/`resizeFogCanvas`). The auto-resize check that compared exact pixel dimensions was removed — this keeps Canvas2D and PixiJS canvases in lockstep, preventing size mismatches during zoom.

### 4. Fog canvas origin tracking without reinit (v0.7.134)
`applyFogPostProcessing` no longer calls `initFogCanvas` when only origin changed — just updates tracking vars.

### 5. Native wheel listener with passive:false (v0.7.133)
Replaced React `onWheel` with native `addEventListener('wheel', ..., { passive: false })`.

## Files Changed
- `src/components/SimpleTabletop.tsx` — removed quantizedZoom, native wheel listener
- `src/hooks/usePostProcessing.ts` — resize vs reposition split
- `src/lib/postProcessingLayer.ts` — new `repositionPostProcessing()`
- `src/lib/fogPostProcessing.ts` — origin-only update without canvas reinit; removed auto-resize
- `src/lib/version.ts` — 0.7.136
