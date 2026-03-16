# Unified Texture Storage Service

## Problem
`textureStorage.ts` and `tokenTextureStorage.ts` are near-identical modules sharing the same IDB database (`canvas-textures-db`) and `textures` object store. Having two modules creates:
- Redundant code and import aliasing everywhere
- Confusion about which module to call for hash-based lookups
- Dual-save patterns in textureSync.ts

## Solution
Merge both into a single `textureStorage.ts` that provides:
- **Hash-level API** (shared): `saveTextureByHash`, `loadTextureByHash`, `hashImageData`, `getCachedTexture`, `clearAllTextures`, `getAllTextures`, `clearUnusedTextures`
- **Entity mapping API**: `saveEntityTexture(entityId, dataUrl, mappingStore)`, `loadEntityTexture(entityId, mappingStore)`, etc.
- Backward-compat re-exports: `saveRegionTexture`, `saveTokenTexture`, `loadRegionTexture`, `loadTokenTexture`, etc.
- `saveVariantTexture` (token-specific, refCount increment)

## Mapping Stores (unchanged in IDB)
- `region-mappings` — regionId → hash
- `token-mappings` — tokenId → hash

## Files to Update
1. `src/lib/textureStorage.ts` — add token functions from tokenTextureStorage
2. `src/lib/tokenTextureStorage.ts` — DELETE, replace with re-export shim or remove
3. `src/lib/jazz/textureSync.ts` — single import
4. `src/lib/jazz/bridge.ts` — single import for `_resolveTokenTextures`
5. `src/components/TokenContextMenu.tsx` — import from textureStorage
6. `src/hooks/useTextureLoader.ts` — single import
7. `src/lib/projectSerializer.ts` — single import
8. `src/lib/groupSerializer.ts` — single import
9. `src/lib/net/ephemeral/miscHandlers.ts` — single import
10. `src/components/StorageManagerModal.tsx` — may already be fine

## Strategy
- Keep `tokenTextureStorage.ts` as a thin re-export shim to avoid breaking anything
- Add all token-specific functions to `textureStorage.ts`
- Update direct imports in high-traffic files
