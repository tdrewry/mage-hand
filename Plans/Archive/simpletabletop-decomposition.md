# SimpleTabletop.tsx Decomposition Plan

## Current State
- **10,773 lines** — the largest file in the codebase by far
- Monolithic component combining rendering, input handling, fog computation, UI, and state management

## Decomposition Phases

### Phase 1: Pure Utility Extraction (This PR) ✅
Extract functions that take all dependencies as parameters (zero closure coupling).

| Module | Functions Extracted | Lines Saved |
|--------|-------------------|-------------|
| `src/lib/canvasDrawHelpers.ts` | `drawTokenLabel`, `drawGhostToken`, `drawDirectionArrow`, `drawOffScreenIndicator`, `drawTargetingLineHelper`, `drawMapPings`, `drawRemoteDragPreviews`, `drawRemoteTokenHovers`, `drawRemoteSelectionPreviews`, `drawRemoteActionTargets` | ~550 |
| `src/lib/gridOccupancy.ts` | `isPointInRegion`, `calculateTokenHexOccupancy`, `calculateTokenSquareOccupancy` | ~250 |
| `src/lib/canvasHitTest.ts` | `getResizeHandle`, `isOverRotationHandle`, `isOverGroupRotationHandle`, `getMapObjectScaleHandle`, `isOverMapObjectRotationHandle` | ~150 |
| `src/lib/wallDecorationRenderer.ts` | `drawDecorativeEdgesToContext`, `drawAmbientOcclusion`, `createWallTexturePattern` | ~350 |

**Total Phase 1: ~1300 lines extracted**

### Phase 2: Region Rendering (Future)
Extract region drawing functions with a shared `RenderContext` type.
- `drawRegion`, `drawPathRegion`, `drawRectangleRegion`
- `drawRegionBackground`, `drawRegionGrid`
- `drawSquareGrid`, `drawHexGrid`
- `drawHighlightedGrids`, `drawPathHandles`, `drawResizeHandles`

### Phase 3: Token Rendering (Future)
- `drawToken`, `drawTokenToContext`
- `drawAllTokensToContext` (the token visibility/fog loop)

### Phase 4: Input Handling (Future)
Split mouse/keyboard handlers into custom hooks:
- `useCanvasMouseHandlers` — handleMouseDown, handleMouseMove, handleMouseUp
- `useCanvasKeyboardHandlers` — keyboard zoom, pan, shortcuts
- `useMarqueeSelection` — marquee selection logic

### Phase 5: Fog Computation (Future)
- Move the large fog `useEffect` into `useFogComputation` hook
- Move fog brush logic into `useFogBrush` hook

## Architecture Notes
- Functions extracted in Phase 1 receive `zoom` (or full `transform`) as a parameter instead of reading from closure
- Future phases will use a `RenderContext` interface to bundle shared state
- All extractions maintain the same rendering behavior — no functional changes
