

# Fog of War: Viewport-Sized PixiJS Layer (Revert to Stable Architecture)

## Context

The fog system worked correctly before the networking changes. The recent fixes (removing the 10% threshold, adding resize-on-every-zoom) introduced a **flash** on every zoom step because `renderer.resize()` clears the WebGL buffer. The content-sized approach is inherently fragile — it requires three independent systems (PixiJS canvas size, Canvas2D size, CSS position) to agree on every frame.

The flash is the smoking gun: every zoom tick triggers `resizePostProcessing` → `pixiApp.renderer.resize()` → WebGL buffer cleared → one frame of transparent fog → map visible. This was masked before by the 10% threshold, which was itself hiding the alignment bug.

## Root Cause

Two coordinate strategies in conflict:
- **Main canvas**: viewport-sized, uses `ctx.translate(pan) + ctx.scale(zoom)` — never resizes on zoom
- **Fog canvas**: content-sized, resizes on zoom, CSS-positioned — requires sync between 3 systems

## Solution: Make fog layer viewport-sized

Match the main canvas strategy exactly. The PixiJS canvas and fog Canvas2D become viewport-sized, positioned at `top:0; left:0`, using `translate(pan) + scale(zoom)` for all drawing. No resize on zoom. No CSS repositioning. No `fogBounds` calculation.

## Changes

### 1. `postProcessingLayer.ts` — Viewport-sized canvas

- Remove `FIXED_PADDING` (600px → 50px edge padding for blur bleed)
- Remove `originX/Y`, `_contentW/H` tracking, `totalSize()`, `applyCanvasCSS()` complexity
- `initPostProcessing` takes viewport `width × height` only
- Canvas CSS: `position: absolute; top: 0; left: 0; pointer-events: none`
- Remove `repositionPostProcessing`, `panOffsetPostProcessing`, `resetPostProcessingOffset`, `setLastRenderTransform` — none needed
- `resizePostProcessing` takes viewport `width × height` — only called on window resize
- Keep blur filter, illumination filter, sprites

### 2. `fogPostProcessing.ts` — Same transform as main canvas

- Canvas size = viewport + small edge padding (50px each side for blur)
- `applyFogPostProcessing` transform: `ctx.translate(transform.x + EDGE_PAD, transform.y + EDGE_PAD); ctx.scale(zoom, zoom)` — mirrors main canvas exactly
- Remove `originX/Y` parameters entirely
- Remove CSS-offset fast path (`panOffsetPostProcessing` calls) — canvas never moves
- Keep throttle logic (MIN_UPDATE_INTERVAL, ZOOM_THROTTLE_INTERVAL)
- No resize on zoom — eliminates the flash

### 3. `usePostProcessing.ts` — Accept viewport dimensions only

- Remove `originX/Y` props
- Pass `canvasDimensions.width/height` (viewport size) directly
- Only resize when viewport (window) resizes — never on zoom/pan
- Remove `fogBounds` dependency

### 4. `SimpleTabletop.tsx` — Remove fogBounds

- Delete the `fogBounds` `useMemo` (lines 588-638)
- Pass `canvasDimensions.width/height` to `usePostProcessing` directly
- Remove `originX/originY` from `usePostProcessing` call
- Remove `originX/originY` from `applyEffects` call
- `applyPostProcessingEffects` call simplified — no origin params

### 5. `version.ts` — Bump to `0.7.139`

## Why this fixes both problems

1. **Alignment**: fog uses identical `translate+scale` as main canvas — pixel-aligned by definition
2. **Flash**: no `renderer.resize()` on zoom → no WebGL buffer clear → no flash
3. **Performance**: fewer operations per frame (no bounds calc, no CSS repositioning)

## Edge case: blur bleed at viewport edges

Light sources near screen edges may have blur clipped. A 50px constant padding on all sides handles this without the complexity of 600px content-tracking padding.

## External impact

No websocket/jazz changes. Pure client-side rendering refactor.

