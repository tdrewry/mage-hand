

# Jazz Fine-Grained Sync + Universal Texture FileStreams

## Overview

Replace the monolithic blob-sync pattern for large stores with fine-grained CoValues, fix blob deduplication, and ensure every store that references textures feeds its hashes into the FileStream pipeline. This eliminates the 1MB transaction crashes and ensures all media assets (maps, tokens, regions, effects, map objects) sync to players.

## Current State

- **Blob sync**: All 16 DO kinds serialized as single JSON strings in `JazzDOBlob`. Effects blob hits 2.8MB and never syncs.
- **Texture FileStream**: `textureSync.ts` collects hashes from tokens, regions, effects, and maps — but **not map objects** (which also have `imageHash`).
- **Blob dedup**: `pushBlobsToJazz()` always appends new blobs. Over reconnects, duplicates accumulate (48 blobs for 16 kinds). `pullBlobsFromJazz()` hydrates all of them.
- **Stripping**: Effects and regions strip data URIs before push, but the effects DO extractor also strips — double work, and the bridge strip runs on already-stripped data for initial push.

## Plan

### 1. Add Map Objects to Texture Hash Collection

In `textureSync.ts` → `collectAllTextureHashes()`, add:

```typescript
// Map Objects
for (const obj of useMapObjectStore.getState().mapObjects) {
  if (obj.imageHash) hashes.add(obj.imageHash);
}
```

This is currently missing. Map objects with textures will never sync their images.

### 2. Fix Blob Deduplication on Push

In `pushBlobsToJazz()` (the initial full-push called at session creation), check for existing blobs by kind before creating new ones. Currently it always creates and appends:

```typescript
// Before: always creates new blob
const blob = JazzDOBlobSchema.create({...}, group);
sessionRoot.blobs.$jazz.push(blob);

// After: find existing first, update if present
const idx = findBlobIndex(kind);
if (idx >= 0) {
  const existing = blobs[idx];
  existing.$jazz.set("state", json);
  existing.$jazz.set("updatedAt", new Date().toISOString());
} else {
  // create and push new
}
```

### 3. Fix Blob Deduplication on Pull

In `pullBlobsFromJazz()`, deduplicate by kind — keep only the blob with the latest `updatedAt`:

```typescript
const latestByKind = new Map<string, { state: string; updatedAt: string }>();
for (let i = 0; i < len; i++) {
  const blob = blobs[i];
  if (!blob?.kind || !blob?.state) continue;
  const existing = latestByKind.get(blob.kind);
  if (!existing || blob.updatedAt > existing.updatedAt) {
    latestByKind.set(blob.kind, blob);
  }
}
// Hydrate each kind exactly once
for (const [kind, blob] of latestByKind) {
  pullBlobFromJazz(kind, blob.state);
}
```

### 4. Throttle "Too Large" Skip Warnings

Add a cooldown map so the "too large — skipping" warning logs at most once per kind per 30 seconds:

```typescript
const _lastSkipWarn = new Map<string, number>();

// In pushBlobToJazz, before the warn:
const now = Date.now();
if (!_lastSkipWarn.has(kind) || now - _lastSkipWarn.get(kind)! > 30000) {
  console.warn(`...`);
  _lastSkipWarn.set(kind, now);
}
```

### 5. Strip Map Object Textures for Blob Sync

Add `stripMapObjectTexturesForSync()` — same pattern as regions. Map objects can have `imageUrl` data URIs:

```typescript
function stripMapObjectTexturesForSync(state: any): any {
  if (!state) return state;
  if (Array.isArray(state)) {
    return state.map((obj: any) => {
      if (!obj?.imageUrl || obj.imageUrl.length < 200) return obj;
      return { ...obj, imageUrl: '' };
    });
  }
  return state;
}
```

Wire it in `pushBlobToJazz` for `kind === 'mapObjects'`.

### 6. Ensure Map Extractor Preserves imageHash

The maps DO extractor currently strips `imageUrl` (correct) but we need to verify `imageHash` is preserved. Looking at the code: `useMapStore.getState().maps.map(m => ({ ...m, imageUrl: '' }))` — this spreads `imageHash` through, so it's already correct.

### 7. Save Plan File

Save to `Plans/jazz-fine-grained-sync-and-media.md`.

### 8. Version Bump

Bump `APP_VERSION` to `0.7.50`.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/jazz/textureSync.ts` | Add mapObject imageHash collection |
| `src/lib/jazz/bridge.ts` | Fix blob dedup on push/pull, throttle skip warnings, add mapObject texture stripping |
| `src/lib/version.ts` | Bump to 0.7.50 |
| `Plans/jazz-fine-grained-sync-and-media.md` | Save plan |

## Texture Coverage Summary After This Change

| Store | Hash Field | Collected? | Stripped from Blob? |
|-------|-----------|------------|-------------------|
| Tokens | `imageHash` | Yes | Yes (`imageUrl: ''` in extractor) |
| Regions | `textureHash` | Yes | Yes (`stripRegionTexturesForSync`) |
| Effects | `textureHash` | Yes | Yes (`stripEffectTexturesForSync` + extractor) |
| Maps | `imageHash` | Yes | Yes (`imageUrl: ''` in extractor) |
| Map Objects | `imageHash` | **Adding** | **Adding** (`stripMapObjectTexturesForSync`) |

