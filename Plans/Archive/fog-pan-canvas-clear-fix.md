# Fog Disappearing During Pan Fix (v0.7.98)

## Problem
Fog of war completely disappeared when panning (dragging) the canvas.

## Root Cause
`fogBounds` useMemo depended on `transform` (including `transform.x/y` — pan).
Every mouse-move during pan changed `fogBounds`, which triggered the
`usePostProcessing` resize useEffect → `resizePostProcessing()` →
`pixiApp.renderer.resize()`. PixiJS `resize()` **clears the WebGL canvas**.

If the subsequent `applyFogPostProcessing` call hit the CSS fast-path (skipping
full Canvas 2D redraw + GPU render), the PixiJS canvas remained blank — fog gone.

## Fix
Changed `fogBounds` to depend only on `transform.zoom` (not `transform.x/y`).
World-space region bounds are projected at the current zoom with a generous
2000px pan margin so the canvas is large enough without needing resize during pan.
Pan repositioning is handled by the existing CSS-offset fast-path.

## Files Changed
| File | Change |
|------|--------|
| `src/components/SimpleTabletop.tsx` | `fogBounds` useMemo: removed `transform` dep, uses `transform.zoom` only + pan margin |
| `src/lib/version.ts` | 0.7.98 |

## Impact on External Services
None — client-side only.
