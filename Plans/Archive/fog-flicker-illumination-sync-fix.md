# Fog Flicker & Illumination Sync Fix (v0.7.96 → v0.7.97)

## Problems Fixed

### 1. Fog flickers on/off during map pan (with illumination)
**Root cause**: Line 4084 `const illuminationSources = [...illuminationSourcesCacheRef.current]` 
created a NEW array every frame via spread, breaking the identity check in `applyFogPostProcessing`
(`illuminationData?.sources === _lastIlluminationSources`). This meant the CSS-offset fast-path 
was never used when illumination existed, causing PixiJS canvas misalignment during pan.

**Fix**: Use `illuminationSourcesCacheRef.current` directly instead of spreading. Only create a 
new array when drag preview sources need to be appended.

### 2. Bridge fired fog:force-refresh on EVERY token sync (v0.7.96 regression)
**Root cause**: The v0.7.96 fix dispatched `fog:force-refresh` whenever `tokensChanged` was true,
including position-only syncs from drag operations. This caused constant fog recomputation during
normal multiplayer use.

**Fix**: Track `illuminationChanged` separately by deep-comparing `illuminationSources` arrays.
Only dispatch `fog:force-refresh` when illumination parameters actually change — not on position
or other property updates.

### 3. Soft refresh was too aggressive (v0.7.96 regression)
**Root cause**: Even "soft" refreshes cleared ALL per-token visibility caches, Paper.js geometry,
and `prevTokenPositionsRef`, then triggered `setFogRefreshTick` which forced a full fog 
recomputation cycle. This was nearly as expensive as a hard refresh.

**Fix**: Soft refresh now ONLY invalidates `illuminationSourcesCacheRef` and calls `redrawCanvas()`.
No visibility cache clearing, no Paper.js cleanup, no fogRefreshTick bump. Each client renders
fog locally based on its own illumination data — the soft refresh just ensures the illumination
cache is rebuilt with the latest token settings on the next render frame.

### 4. Host loses illumination when player connects
**Root cause**: The `fog:force-refresh` handler nulled `fogMasksRef.current`, causing the safety 
full-black rectangle to render during recomputation.

**Fix**: Soft refreshes never null fog masks (addressed by making soft refresh minimal).

### 5. Missing Action Card button
**Fix**: Added a Zap icon button to the VerticalToolbar's play mode section.

## Architecture Principle
Fog geometry sync is ONLY for explored regions (`serializedExploredAreasPerMap`). Illumination
syncs settings only (via Jazz token `illuminationSources` field) — each client instance renders
fog of war independently based on its hardware capabilities.

## Files Changed
| File | Change |
|------|--------|
| `src/components/SimpleTabletop.tsx` | Minimal soft refresh (cache invalidation + redraw only) |
| `src/lib/jazz/bridge.ts` | Track `illuminationChanged` separately; gate fog refresh |
| `src/components/VerticalToolbar.tsx` | Action Card button (v0.7.96) |
| `src/lib/version.ts` | Bumped to 0.7.97 |

## Impact on External Services
None — all changes are client-side. No WebSocket server or Jazz service changes needed.
