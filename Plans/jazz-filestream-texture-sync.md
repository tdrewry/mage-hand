# Jazz FileStream Texture Sync Plan

## Problem
Textures (token images, region backgrounds, effect templates) are stored in IndexedDB locally but **never synced** to other clients. The old Socket.IO relay was removed, and Jazz blob sync strips texture data URIs to stay under the 1MB transaction limit. Players see hash references but have no way to fetch the actual image data.

## Solution: Jazz FileStreams
Use Jazz's built-in `FileStream` CoValues to distribute binary texture data. FileStreams handle automatic chunking, progress tracking, and CRDT-based sync — no transaction size limits.

## Architecture

### Schema Changes (`src/lib/jazz/schema.ts`)
```ts
// A map of textureHash → FileStream reference
export const JazzTextureEntry = co.map({
  hash: z.string(),
  mimeType: z.string(),
  file: co.fileStream(),
});

export const JazzTextureList = co.list(JazzTextureEntry);

// Add to JazzSessionRoot:
export const JazzSessionRoot = co.map({
  sessionName: z.string(),
  tokens: JazzTokenList,
  maps: JazzMapList,
  blobs: JazzDOBlobList,
  textures: JazzTextureList,  // NEW
});
```

### Upload Flow (DM → Jazz)
1. When a texture is saved to IndexedDB (token image, region bg, effect texture), also check if a Jazz session is active.
2. If active, convert the data URI to a `Blob`, then call `co.fileStream().createFromBlob(blob, { owner: group })`.
3. Create a `JazzTextureEntry` with the hash + FileStream ref, push to `sessionRoot.textures`.
4. Deduplicate: skip upload if a texture with the same hash already exists in the list.

### Download Flow (Player ← Jazz)
1. On join (or when `sessionRoot.textures` subscription fires), iterate texture entries.
2. For each hash not already in the player's local IndexedDB:
   - Call `fileStream.toBlob()` to get the binary data
   - Convert to data URI, save to IndexedDB via `saveTextureByHash(hash, dataUrl)`
   - Populate the in-memory `localTextureCache`
3. Once textures are cached, trigger a re-render so images appear.

### Bridge Integration (`src/lib/jazz/bridge.ts`)
- Add a `pushTexturesToJazz()` function that scans all referenced hashes from tokens (imageHash), regions (backgroundImageHash), and effect templates (textureHash).
- Add a `pullTexturesFromJazz()` function that downloads missing FileStreams.
- Subscribe to `sessionRoot.textures` changes for live texture additions.

### Progress Tracking
- FileStream supports `onProgress` callback during upload
- Can show a `TextureDownloadProgress` indicator (component already exists) for players

## Key Benefits
- No 1MB limit — FileStreams chunk automatically
- Deduplication by hash — same texture referenced by multiple entities only uploaded once
- Progress tracking built-in
- Automatic CRDT sync — no custom relay needed

## Files to Change
1. `src/lib/jazz/schema.ts` — add JazzTextureEntry, JazzTextureList, update JazzSessionRoot
2. `src/lib/jazz/bridge.ts` — add texture push/pull functions, subscribe to texture list
3. `src/lib/jazz/session.ts` — call pushTexturesToJazz after initial state push
4. `src/lib/jazz/index.ts` — re-export new functions
5. `src/lib/textureSync.ts` — wire up Jazz upload on texture save (when session active)
6. `src/lib/version.ts` — bump version

## Phases
- **Phase 1**: Token image sync (imageHash → FileStream)
- **Phase 2**: Region background sync (backgroundImageHash)
- **Phase 3**: Effect template texture sync (textureHash)
- **Phase 4**: Progress UI for downloads
