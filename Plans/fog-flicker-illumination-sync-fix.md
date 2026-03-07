# Fog Flicker & Illumination Sync Fix (v0.7.96)

## Problems Fixed

### 1. Fog flickers on/off during map pan (with illumination)
**Root cause**: Line 4084 `const illuminationSources = [...illuminationSourcesCacheRef.current]` 
created a NEW array every frame via spread, breaking the identity check in `applyFogPostProcessing`
(`illuminationData?.sources === _lastIlluminationSources`). This meant the CSS-offset fast-path 
was never used when illumination existed, causing PixiJS canvas misalignment during pan.

**Fix**: Use `illuminationSourcesCacheRef.current` directly instead of spreading. Only create a 
new array when drag preview sources need to be appended.

### 2. Host loses illumination when player connects
**Root cause**: The `fog:force-refresh` handler nulled `fogMasksRef.current`, causing the safety 
full-black rectangle to render (line 3960) during recomputation. When Jazz auto-sync triggered 
a fog refresh on player join, this flashed the entire map black.

**Fix**: Introduced "soft" fog refresh mode (`{ detail: { soft: true } }`). Soft refreshes 
keep existing fog masks and don't hide/show the PixiJS layer, preventing any visual disruption.
Hard refreshes (geometry changes) still null masks as before.

### 3. Illumination changes not syncing until token moved
**Root cause**: When illumination changes arrived via Jazz, `store.setTokens()` fired but the 
fog useEffect's debounced recomputation sometimes didn't fully propagate to the illumination 
cache rebuild. No explicit fog refresh was dispatched.

**Fix**: After `store.setTokens()` in the Jazz → Zustand token subscription, dispatch a soft 
`fog:force-refresh` event. This explicitly invalidates the illumination cache and triggers fog 
recomputation without the black flash.

### 4. Missing Action Card button
**Fix**: Added a Zap icon button to the VerticalToolbar's play mode section to open/toggle 
the Action Card without needing an active action.

## Files Changed
| File | Change |
|------|--------|
| `src/components/SimpleTabletop.tsx` | Fix 1 (identity-preserving cache), Fix 2 (soft refresh) |
| `src/lib/jazz/bridge.ts` | Fix 3 (dispatch fog:force-refresh on token sync) |
| `src/components/VerticalToolbar.tsx` | Fix 4 (Action Card button) |
| `src/lib/version.ts` | Bumped to 0.7.96 |

## Impact on External Services
None — all changes are client-side. No WebSocket server or Jazz service changes needed.
