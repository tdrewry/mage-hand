# Region Texture Sync Fix (v0.7.112)

## Problem
Region textures were not syncing to players. After tracing the full pipeline:

1. `pullRegionsFromJazz` (initial join) loaded regions with `textureHash` but never called `_resolveRegionTextures` to load textures from local IDB
2. `useTextureLoader` hook's fallback `requestTextureFromServer()` is a no-op stub (old Socket.IO system removed), so it silently fails and marks regions as "loaded" without textures
3. The Jazz FileStream pipeline (`_applyTextureToEntities`) is the only working network path but has timing dependencies with no retry

## Fix
Added `_resolveRegionTextures` call to `pullRegionsFromJazz` — the same pattern already used in the live subscription handler. This ensures textures already in IndexedDB are applied immediately during initial pull, and textures arriving later via FileStream are resolved by `_applyTextureToEntities`.

## Files Changed
- `src/lib/jazz/bridge.ts` — added texture resolution to initial region pull
- `src/lib/version.ts` — bumped to 0.7.112

## Impact
- **Jazz service**: No restart needed
- **WebSocket server**: No impact
