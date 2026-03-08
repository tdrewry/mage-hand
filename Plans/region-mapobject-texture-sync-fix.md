# Region & MapObject Texture Sync Fix (v0.7.106)

## Problem
When a DM assigns a texture to a region, the texture is immediately removed. The Jazz bridge's inbound region subscription was overwriting `backgroundImage` with `""` (the Jazz-side default) on every sync tick, stripping the locally-loaded texture data. Same issue affected map objects (`imageUrl`).

Tokens already had this fix — they explicitly preserve `imageUrl: existing.imageUrl` during inbound merges.

## Root Cause
In `bridge.ts`, the inbound Jazz → Zustand subscriptions for regions and map objects called:
```typescript
store.updateRegion(jr.regionId, incoming);  // incoming.backgroundImage === ""
store.updateMapObject(jmo.objectId, incoming); // incoming.imageUrl === ""
```
This wiped the local in-memory texture data URL loaded from IndexedDB.

## Fix

### 1. Preserve local texture data on inbound updates
- **Regions**: `store.updateRegion(id, { ...incoming, backgroundImage: existing.backgroundImage })`
- **MapObjects**: `store.updateMapObject(id, { ...incoming, imageUrl: existing.imageUrl })`

### 2. Add async texture resolution for regions & map objects
Added `_resolveRegionTextures()` and `_resolveMapObjectTextures()` — matching the existing `_resolveTokenTextures()` pattern. When inbound entities arrive with a hash but no local image, these resolve from IndexedDB asynchronously.

### 3. Add outbound texture push triggers
When a region's `textureHash` or map object's `imageHash` changes outbound, trigger `pushTexturesToJazz()` to upload the binary via FileStream — matching the existing token behavior.

## Files Changed
- `src/lib/jazz/bridge.ts` — all fixes
- `src/lib/version.ts` — bumped to 0.7.106
