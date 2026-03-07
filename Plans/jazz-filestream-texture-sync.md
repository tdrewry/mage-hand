# Jazz FileStream Texture Sync Plan (v0.7.45)

## Problem
Textures (token images, region backgrounds, effect templates) are stored in IndexedDB locally but **never synced** to other clients. The old Socket.IO relay was removed, and Jazz blob sync strips texture data URIs to stay under the 1MB transaction limit. Players see hash references but have no way to fetch the actual image data.

## Solution: Jazz FileStreams
Use Jazz's built-in `FileStream` CoValues to distribute binary texture data. FileStreams handle automatic chunking, progress tracking, and CRDT-based sync — no transaction size limits.

## Implementation (v0.7.45)

### Schema (`src/lib/jazz/schema.ts`)
- Added `JazzTextureEntry` CoMap: `{ hash, mimeType, fileStreamId }`
- Added `JazzTextureList` CoList
- Updated `JazzSessionRoot` to include `textures: JazzTextureList`
- Updated `createSessionRoot()` to initialize empty textures list

### Texture Sync Module (`src/lib/jazz/textureSync.ts`) — NEW
- `collectAllTextureHashes()` — scans all stores (tokens, regions, effects, maps) for referenced texture hashes
- `pushTexturesToJazz()` — loads data URIs from IndexedDB → converts to Blob → uploads as FileStream → registers in session root textures list. Deduplicates by hash.
- `pullTexturesFromJazz()` — iterates texture entries → downloads FileStream as Blob → converts to data URI → saves to IndexedDB. Shows progress via `TextureDownloadProgress` component.
- `subscribeToTextureChanges()` — live subscription for new textures added during session
- `cleanupTextureSync()` — teardown

### Session Lifecycle (`src/lib/jazz/session.ts`)
- `createJazzSession()` — calls `pushTexturesToJazz()` after state push (async, non-blocking)
- `joinJazzSession()` — calls `pullTexturesFromJazz()` after state pull (async, non-blocking)
- `leaveJazzSession()` — calls `cleanupTextureSync()`
- Retry path also pulls textures on successful retry

### Bridge (`src/lib/jazz/bridge.ts`)
- `startBridge()` — dynamically imports and starts texture change subscription

### Progress UI
- Existing `TextureDownloadProgress` component is already wired with `notifyTextureDownloadStart/Complete/Error` — no changes needed.

## Coverage
- **Phase 1**: Token images (`imageHash`)
- **Phase 2**: Region backgrounds (`textureHash`)
- **Phase 3**: Effect template textures (`textureHash`)
- **Phase 4**: Map images (`imageHash`)
- **Progress UI**: Uses existing `TextureDownloadProgress` component

## Files Changed
- `src/lib/jazz/schema.ts` — JazzTextureEntry, JazzTextureList, updated JazzSessionRoot
- `src/lib/jazz/textureSync.ts` — NEW: all texture push/pull/subscribe logic
- `src/lib/jazz/session.ts` — wired texture sync into create/join/leave/retry
- `src/lib/jazz/bridge.ts` — texture subscription in startBridge
- `src/lib/jazz/index.ts` — re-exports
- `src/lib/version.ts` — bumped to 0.7.45
