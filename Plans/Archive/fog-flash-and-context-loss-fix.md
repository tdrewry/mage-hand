# Fog Flash During Pan/Drag & WebGL Context Loss Fix

## Problem 1: Fog flashes during drag/pan
**Root cause**: The `illuminationSources` array is recreated inside `redrawCanvas` every frame, so the identity check `illuminationData?.sources === _lastIlluminationSources` is **always false** when illumination exists. This means the CSS-offset fast-path is never used. When the full redraw is throttled (16ms), the PixiJS fog canvas stays at its old position while the main canvas redraws at the new transform — causing a visible flash.

**Fix**: In `fogPostProcessing.ts`, when a full redraw is throttled, still apply `panOffsetPostProcessing()` as a CSS-offset fallback so the fog canvas stays aligned with the main canvas even when a full texture re-render is skipped.

## Problem 2: Map texture fails after tab switch
**Root cause**: Switching browser tabs can trigger WebGL context loss. The PixiJS renderer becomes non-functional, and existing textures are invalidated. Without explicit context loss/restore handlers, the fog layer silently breaks.

**Fix**: In `postProcessingLayer.ts`:
- Added `webglcontextlost` handler that calls `preventDefault()` (to allow restoration) and suspends rendering
- Added `webglcontextrestored` handler that destroys stale texture references so the next render cycle recreates them from the current Canvas 2D sources
- Clean up event listeners during `cleanupPostProcessing()`

## Files Changed
- `src/lib/fogPostProcessing.ts` — CSS-offset fallback in throttle path
- `src/lib/postProcessingLayer.ts` — WebGL context loss/restore handlers
- `src/lib/version.ts` — bumped to 0.5.3
