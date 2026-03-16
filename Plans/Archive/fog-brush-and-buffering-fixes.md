# Fog Brush & Canvas Buffering Fixes

## Issue 1: Map revealed on refresh before fog paints
- On load, `fogMasksRef` is null until async fog computation completes
- The render check `if (isPlayMode && fogEnabled && !fogRevealAll && fogMasksRef.current)` silently skips fog rendering when masks are null
- **Fix**: When fog is enabled but masks aren't computed yet, render full black overlay instead of nothing

## Issue 2: Brush reticle not visible until mouse moves
- `fogBrushCursorRef` starts as null; ghost circle rendering requires it non-null
- Only set inside `handleMouseMove`, so toggling brush mode without moving mouse shows no cursor
- **Fix**: Also track cursor on `onMouseEnter` and when brush mode is toggled

## Issue 3: Painting doesn't update fog display until commit
- `stampFogBrushCircle` unions circles into `exploredAreaRef` but never invalidates `fogMasksRef`
- Fog masks only recompute after `commitFogBrush` on mouseUp
- **Fix**: Poll `fogMasksRef = null` + `redrawCanvas()` during painting at an interval proportional to brush radius. Also invalidate on mouseUp.
