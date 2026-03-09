# Zoom Performance: Fog Canvas Thrashing Fix

## Problem (v0.7.130)
Zooming via scroll wheel or keyboard caused:
1. Fog of war rendering offset/flicker
2. Multi-second lag/freeze before user could interact again

## Root Cause
`fogBounds` useMemo depended directly on `transform.zoom`. Every wheel tick (10% zoom change) produced new pixel dimensions for the fog canvas, triggering:
- `resizePostProcessing()` → `pixiApp.renderer.resize()` (clears WebGL canvas)
- `resizeFogCanvas()` (reallocates offscreen canvases)
- Full Canvas 2D redraw + GPU texture upload

This cascade happened on *every single scroll event*, causing massive GPU/CPU thrashing.

## Fix (v0.7.131)

### 1. Quantized Zoom for Bounds Calculation
Instead of using raw `transform.zoom`, fog bounds now use a **quantized zoom** that only changes at ~41% increments (power-of-√2 steps). This means the expensive canvas resize only happens when zooming past major thresholds, not on every wheel tick.

### 2. Increased Pan Margin
PAN_MARGIN increased from 2000px → 3000px to absorb the projection differences within a quantization bucket.

### 3. Increased Zoom Throttle
ZOOM_THROTTLE_INTERVAL increased from 33ms (~30fps) → 50ms (~20fps) to further reduce GPU pressure during rapid zoom sequences.

### Key Insight
The fog rendering transform (`applyFogPostProcessing`) still uses the *exact* `transform.zoom` for pixel-perfect rendering — only the *canvas sizing* uses the quantized value. This means fog renders correctly at any zoom level, but the expensive resize only happens at coarse intervals.
