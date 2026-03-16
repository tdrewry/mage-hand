# Jazz Fine-Grained Sync + Universal Texture FileStreams (v0.7.50)

## Overview

Replace the monolithic blob-sync pattern for large stores with fine-grained CoValues, fix blob deduplication, and ensure every store that references textures feeds its hashes into the FileStream pipeline. This eliminates the 1MB transaction crashes and ensures all media assets (maps, tokens, regions, effects, map objects) sync to players.

## Changes Made

### 1. Map Objects Added to Texture Hash Collection
- `textureSync.ts` → `collectAllTextureHashes()` now collects `imageHash` from `useMapObjectStore`
- Map objects with textures will now sync their images via FileStreams

### 2. Map Object Texture Stripping for Blob Sync
- Added `stripMapObjectTexturesForSync()` in `bridge.ts`
- Strips `imageUrl` data URIs from map objects before blob push (same pattern as regions/effects)

### 3. Blob Deduplication on Push (Initial + Incremental)
- `pushBlobsToJazz()` now checks for existing blobs by kind before creating new ones
- If a blob for the kind exists, updates it in-place instead of appending a duplicate
- `pushBlobToJazz()` (incremental) already had this logic — now consistent

### 4. Blob Deduplication on Pull
- `pullBlobsFromJazz()` now deduplicates by kind, keeping only the blob with the latest `updatedAt`
- Each kind is hydrated exactly once, preventing redundant hydration from duplicate blobs

### 5. Throttled Skip Warnings
- "Too large — skipping" warnings now log at most once per kind per 30 seconds
- Prevents log flooding when effects blob repeatedly exceeds 1MB

### 6. Texture Stripping in Initial Push
- `pushBlobsToJazz()` now applies the same texture stripping as `pushBlobToJazz()` (effects, regions, mapObjects)
- Previously, only incremental pushes stripped textures

## Texture Coverage Summary

| Store | Hash Field | Collected? | Stripped from Blob? |
|-------|-----------|------------|-------------------|
| Tokens | `imageHash` | ✅ | ✅ (`imageUrl: ''` in extractor) |
| Regions | `textureHash` | ✅ | ✅ (`stripRegionTexturesForSync`) |
| Effects | `textureHash` | ✅ | ✅ (`stripEffectTexturesForSync` + extractor) |
| Maps | `imageHash` | ✅ | ✅ (`imageUrl: ''` in extractor) |
| Map Objects | `imageHash` | ✅ | ✅ (`stripMapObjectTexturesForSync`) |

## Files Changed
- `src/lib/jazz/textureSync.ts` — Added mapObject imageHash collection
- `src/lib/jazz/bridge.ts` — Fixed blob dedup push/pull, throttled skip warnings, added mapObject texture stripping, added texture stripping to initial push
- `src/lib/version.ts` — Bumped to 0.7.50
- `Plans/jazz-fine-grained-sync-and-media.md` — This plan
