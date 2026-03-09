# Zoom Fog Desync & Passive Wheel Listener Fix (v0.7.133)

## Problems
1. Fog of war rendering desynced from the map during zoom (offset/drift)
2. Console error: "Unable to preventDefault inside passive event listener invocation"

## Root Causes

### Fog Desync
The v0.7.131 fix introduced `quantizedZoom` — a coarsely-bucketed zoom value used for fog canvas sizing. However, `fogBounds` computed `originX`/`originY` using `quantizedZoom` while the fog *rendering* (`applyFogPostProcessing`) used the real `transform.zoom`. This mismatch caused the fog overlay to be positioned incorrectly relative to the map content whenever `quantizedZoom !== transform.zoom`.

### Passive Wheel
React's `onWheel` handler is registered as a passive event listener by default (React 17+). Calling `e.preventDefault()` inside a passive listener is a no-op and logs a warning.

## Fixes

### 1. Removed quantizedZoom, added resize throttling
- `fogBounds` now uses the real `transform.zoom` for all calculations (origin + dimensions), ensuring pixel-perfect alignment
- To prevent the GPU thrashing that quantizedZoom was solving, `usePostProcessing` now only calls `resizePostProcessing`/`resizeFogCanvas` when dimensions change by >10% or origin shifts by >200px
- PAN_MARGIN restored to 2000px (was inflated to 3000px to compensate for quantization error)

### 2. Native wheel listener with passive:false
- Replaced React `onWheel={handleWheel}` with a native `addEventListener('wheel', ..., { passive: false })` via useEffect
- This allows `preventDefault()` to work correctly, stopping page scroll during canvas zoom

## Files Changed
- `src/components/SimpleTabletop.tsx` — removed quantizedZoom, native wheel listener
- `src/hooks/usePostProcessing.ts` — resize throttling
- `src/lib/version.ts` — 0.7.133

## Impact on External Services
None — client-side rendering changes only.
