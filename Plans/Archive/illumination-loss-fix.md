# Intermittent Illumination Loss Fix (v0.7.99)

## Problems Fixed

### 1. Stale illumination color glow persists after sources removed
**Root cause**: `applyFogPostProcessing` only uploaded the illumination texture when
`illuminationData.sources.length > 0`. When sources became empty (e.g., during
cache rebuild from stale data), the OLD color glow texture remained on the GPU sprite.

**Fix**: Always clear and upload the illumination canvas, even when no sources exist.

### 2. Fog vanishes after PixiJS resize (e.g., zoom change)
**Root cause**: `resizePostProcessing` calls `pixiApp.renderer.resize()` which clears
the WebGL canvas. But `_lastRenderTransform` was not reset, so the CSS fast-path
in `applyFogPostProcessing` could still succeed on the next call, skipping the
full Canvas 2D redraw + GPU upload. Result: blank fog layer.

**Fix**: Reset `_lastRenderTransform` to `{0,0,0}` after resize, forcing the next
`applyFogPostProcessing` call to perform a full redraw (zoom-changed check fails,
CSS fast-path fails).

## Files Changed
| File | Change |
|------|--------|
| `src/lib/fogPostProcessing.ts` | Always clear+upload illumination texture |
| `src/lib/postProcessingLayer.ts` | Invalidate fast-path cache after resize |
| `src/lib/version.ts` | 0.7.99 |

## Impact on External Services
None — client-side rendering only.
