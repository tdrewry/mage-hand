

# Fog of War Zoom Misalignment — Root Cause Analysis & Fix Plan

## Root Cause

The main canvas and the PixiJS fog canvas use **two fundamentally different coordinate strategies**, and they only align correctly at one specific zoom level.

**Main canvas** (SimpleTabletop.tsx line ~3170):
```
ctx.translate(transform.x, transform.y)
ctx.scale(transform.zoom, transform.zoom)
```
This is a simple viewport-sized canvas. Pan and zoom are applied purely via the 2D context transform. The canvas element itself never moves or resizes — it's always the size of the viewport.

**PixiJS fog canvas** (postProcessingLayer.ts):
- The canvas is sized to cover the **content bounding box** (all regions projected at current zoom) plus `FIXED_PADDING`.
- It's positioned via CSS `top`/`left` at `originX - FIXED_PADDING`, `originY - FIXED_PADDING`.
- The fog Canvas2D draws content using: `translate(FIXED_PADDING - originX + transform.x, FIXED_PADDING - originY + transform.y)` then `scale(zoom)`.

The `fogBounds` computation (SimpleTabletop.tsx line ~588) projects world-space region bounds into screen space at `transform.zoom` — but **excludes `transform.x`/`transform.y` (pan)** by design (to avoid resize-on-pan). The `originX`/`originY` values are derived from the zoom-projected bounds, not the actual pan position.

**The problem**: When zoom changes, `fogBounds` recalculates new `width`, `height`, `originX`, `originY`. But the `usePostProcessing` hook's resize effect has a **>10% dimension change threshold** before it actually resizes the PixiJS renderer and fog canvases. When zoom changes are small (e.g., individual scroll ticks), the dimensions might not cross this threshold, so:

1. The **fog Canvas2D** (`applyFogPostProcessing`) draws at the new transform with new `originX/originY` values
2. The **PixiJS renderer** is still at its old size from the last significant resize
3. The **fog Canvas2D dimensions** (set by `initFogCanvas`/`resizeFogCanvas`) are also stale — they were last set during the >10% resize
4. So the fog content is drawn into a canvas whose pixel dimensions don't match what the PixiJS renderer expects

The `repositionPostProcessing` call in `applyFogPostProcessing` updates the CSS position, but the **Canvas2D fog canvas is a different size than the PixiJS renderer expects**, causing the texture to stretch/shift incorrectly.

In short: the fog Canvas2D, the PixiJS renderer, and the CSS positioning must all agree on dimensions and origin, but the 10% threshold causes them to disagree during incremental zoom.

## Fix

Remove the >10% resize threshold for the PixiJS layer. Instead, always resize both the PixiJS renderer and the fog Canvas2D whenever `fogBounds` changes. To avoid the performance cost of resizing on every frame, the throttling should happen at the `fogBounds` computation level (which already only changes when `transform.zoom` changes, not on pan).

### Changes

**1. `usePostProcessing.ts` — Always resize when dimensions or origin change**

Remove the 10% threshold logic. When `width`, `height`, `originX`, or `originY` change (which only happens on zoom or region changes, never pan), always call `resizePostProcessing` and `resizeFogCanvas`. This is safe because `fogBounds` is already `useMemo`'d on `transform.zoom` (not `transform.x`/`y`), so it won't trigger on every pan frame.

**2. `fogPostProcessing.ts` — Remove stale origin tracking**

The `_lastOriginX`/`_lastOriginY` tracking in `applyFogPostProcessing` that avoids `initFogCanvas` calls is now unnecessary since the hook handles all resizing. Clean up to remove confusion.

**3. `SimpleTabletop.tsx` — No changes needed**

The `fogBounds` `useMemo` already correctly depends only on `transform.zoom` (not pan), so removing the threshold won't cause pan-triggered resizes.

### Why this is safe performance-wise

- `fogBounds` only recomputes when `transform.zoom`, `regions`, or `canvasDimensions` change
- During a scroll-wheel zoom, `transform.zoom` changes ~10-20 times per second
- The existing `ZOOM_THROTTLE_INTERVAL` (50ms / ~20fps) in `applyFogPostProcessing` already throttles the Canvas2D redraw + GPU upload
- The actual expensive operation (PixiJS `renderer.resize`) happens once per zoom tick, not per frame — this is acceptable

### Version bump
Increment to `0.7.138` in `src/lib/version.ts`.

### External impact
No external services affected (no websocket/jazz changes).

