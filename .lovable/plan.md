
# Fix: Fog of War Cleanup on Mode Transition to Play

## Problem

The screenshot shows fog of war being "brutalized" — stale illumination halos and visibility polygons from the edit-mode session appear in play mode. This happens because:

1. When the DM drags or rotates regions/map objects/walls in edit mode, all visibility polygon caches and PixiJS textures still hold geometry computed at the **pre-edit** positions.
2. The fog computation `useEffect` does eventually re-run, but it has an early-exit guard (`canSkipPolygonComputation`) that may fire if the dependency hashes look identical at the React level (since the region/map-object stores committed their changes atomically before the mode switch).
3. The PixiJS layer retains the **previous frame's fog texture and illumination overlay** until `applyFogPostProcessing` produces a new one. If the re-computation is skipped or throttled, that old frame is what the player sees.

## Solution

Add a dedicated `useEffect` that watches `renderingMode`. When it detects a transition **to `'play'`**, it performs a synchronous full reset of all caches and the PixiJS post-processing layer, then schedules an immediate fog recompute.

### What the effect does

```text
renderingMode changes → 'play'
  │
  ├─ 1. notifyObstaclesChanged()          — rebuilds combinedSegmentsRef
  ├─ 2. tokenVisibilityCacheRef.clear()   — forces all polygons recomputed
  ├─ 3. prevTokenPositionsRef.clear()     — no stale position deltas
  ├─ 4. prevTokenIlluminationRef.clear()  — no stale illumination hashes
  ├─ 5. clearVisibilityCache()            — clears global Paper.js visibility cache
  ├─ 6. fogMasksRef.current = null        — forces new mask generation
  ├─ 7. setPostProcessingVisible(false)   — hides PixiJS layer for one frame
  └─ 8. requestAnimationFrame → setPostProcessingVisible(true) + redrawCanvas()
                                          — forces fresh GPU render
```

Steps 7 and 8 are the critical GPU layer reset. Hiding then immediately re-showing the PixiJS canvas forces it to blit a fresh frame after the fog computation has run. Without this, the PixiJS layer can display stale texture data even after the fog canvas has been updated.

## Files Changed

### `src/components/SimpleTabletop.tsx`

**Add a `useRef` to track previous mode** (near the other `useRef` declarations, ~line 448):

```ts
const prevRenderingModeRef = useRef<string>(renderingMode);
```

**Add a new `useEffect` for mode transition cleanup** (after the existing `useEffect` that handles map object changes, around line 1100):

```ts
// Cleanup fog state when switching from edit → play mode
useEffect(() => {
  const wasEdit = prevRenderingModeRef.current === 'edit' || prevRenderingModeRef.current === 'dm';
  const isNowPlay = renderingMode === 'play';
  prevRenderingModeRef.current = renderingMode;

  if (!wasEdit || !isNowPlay) return;

  console.log('[Fog] Mode transition edit→play: flushing all visibility caches');

  // 1. Rebuild combined wall+obstacle segments from fresh state
  if (wallGeometryRef.current) {
    const mapObjectSegments = mapObjectsToSegments(mapObjects);
    combinedSegmentsRef.current = [
      ...wallGeometryRef.current.wallSegments,
      ...mapObjectSegments,
      ...importedWallSegments,
    ];
  }

  // 2. Notify light system that obstacle geometry has changed
  notifyObstaclesChanged();

  // 3. Clear all per-token visibility caches
  tokenVisibilityCacheRef.current.forEach((cached) => {
    if (cached?.visionPath?.remove) cached.visionPath.remove();
  });
  tokenVisibilityCacheRef.current.clear();
  prevTokenPositionsRef.current.clear();
  prevTokenIlluminationRef.current?.clear?.();

  // 4. Clear global Paper.js / visibility-polygon cache
  clearVisibilityCache();

  // 5. Null out the fog mask so fog computation cannot use the stale masks
  fogMasksRef.current = null;

  // 6. Reset PixiJS post-processing layer for a clean frame
  if (isPostProcessingReadyRef.current) {
    setPostProcessingVisible(false);
    requestAnimationFrame(() => {
      setPostProcessingVisible(true);
      redrawCanvas();
    });
  } else {
    redrawCanvas();
  }
}, [renderingMode]);
```

The dependency array intentionally only contains `renderingMode`. The inner logic reads other refs and state directly — this avoids re-triggering on every fog-related state change while still firing exactly once per mode transition.

### `src/lib/version.ts`

Increment `APP_VERSION` from `'0.3.3'` to `'0.3.4'`.

## Technical Notes

- `prevRenderingModeRef` correctly handles `'dm'` as well as `'edit'` since the mode string in `dungeonStore` uses `'dm'`/`'play'`, but the toolbar switches between those two strings. The ref comparison is `!== 'play'` → `=== 'play'`, so any non-play → play transition triggers the flush.
- The `setPostProcessingVisible` import is already present in `usePostProcessing.ts` and re-exported from `postProcessingLayer.ts`. It must be imported into `SimpleTabletop.tsx` directly for this effect (or called through the hook's returned interface). Currently the hook does not expose a `resetLayer` method — the cleanest approach is to import `setPostProcessingVisible` from `'../lib/postProcessingLayer'` directly at the top of `SimpleTabletop.tsx`, which is where all other `postProcessingLayer` calls already reside.
- The `requestAnimationFrame` gap between hide and show gives React's render cycle (and the fog `useEffect`) one tick to run with `fogMasksRef.current === null`, forcing a full recompute before the PixiJS layer is shown again.
