# Texture Request → Jazz FileStream Fallback (v0.7.114)

## Problem
`requestTexture()` in `src/lib/textureSync.ts` was a no-op stub from the old Socket.IO system — it only checked an in-memory Map, never reaching the network. When `useTextureLoader` called it for missing textures, it silently returned `null`.

## Fix
1. **`src/lib/textureSync.ts`** — `requestTexture()` now falls back to `requestTextureViaJazz()` (lazy-imported) when the local cache misses. This gives the `useTextureLoader` hook a working network retry path.

2. **`src/lib/jazz/textureSync.ts`** — Added:
   - `_cachedTextureList`: stored reference to the session's texture CoList (set during `pullTexturesFromJazz` and `subscribeToTextureChanges`)
   - `requestTextureViaJazz(hash)`: searches the cached texture list for a matching hash, downloads the FileStream with a 15s timeout, saves to IDB, and applies to entities
   - Cleanup resets the cached reference

## Files Changed
- `src/lib/textureSync.ts` — Jazz fallback in `requestTexture()`
- `src/lib/jazz/textureSync.ts` — `requestTextureViaJazz()` + cached texture list ref
- `src/lib/version.ts` — 0.7.114

## Impact
- **Jazz service**: No restart needed (read-only change)
- **WebSocket server**: No impact
