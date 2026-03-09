# Fog of War: Viewport-Sized PixiJS Layer (v0.7.139)

## Status: Implemented

## Problem
The PixiJS fog canvas was **content-sized** (sized to the bounding box of all regions with 600px padding, CSS-positioned), while the main rendering canvas was **viewport-sized** (fixed to the browser viewport with `translate+scale`). This mismatch caused:
1. **Alignment drift** on zoom — three systems (PixiJS canvas size, Canvas2D size, CSS position) had to agree every frame
2. **Flash on zoom** — every zoom tick triggered `renderer.resize()` which clears the WebGL buffer, showing one frame of transparent fog

## Solution
Made the PixiJS canvas and fog Canvas2D **viewport-sized**, matching the main canvas exactly:
- Canvas positioned at `top: -50px; left: -50px` (50px edge padding for blur bleed)
- Fog Canvas2D uses `ctx.translate(EDGE_PADDING + transform.x, EDGE_PADDING + transform.y); ctx.scale(zoom, zoom)` — same as main canvas
- No resize on zoom/pan — only on window resize
- Removed `fogBounds` calculation, `FIXED_PADDING` (600px), `originX/Y` tracking, CSS-offset fast-paths

## Files Changed
- `src/lib/postProcessingLayer.ts` — Viewport-sized canvas, removed content-tracking complexity
- `src/lib/fogPostProcessing.ts` — Same transform as main canvas, removed CSS fast-paths
- `src/hooks/usePostProcessing.ts` — Accepts viewport dimensions only, no origin props
- `src/components/SimpleTabletop.tsx` — Removed `fogBounds` useMemo, passes viewport dimensions directly
- `src/lib/version.ts` — Bumped to 0.7.139

## Why This Fixes Both Problems
1. **Alignment**: fog uses identical `translate+scale` as main canvas — pixel-aligned by definition
2. **Flash**: no `renderer.resize()` on zoom → no WebGL buffer clear → no flash
