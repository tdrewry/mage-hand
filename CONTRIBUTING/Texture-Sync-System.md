# Texture Synchronization System

This document describes how textures (images for tokens and regions) are synchronized across multiplayer clients.

## Architecture Overview

```
DM Client                      Server                      Player Clients
-----------                    ------                      --------------
   |                             |                              |
   |-- Compress texture -------->|                              |
   |-- Upload texture ---------->|                              |
   |   (hash, compressed dataUrl)|                              |
   |                             |-- Broadcast availability --->|
   |                             |   (hash, size)               |
   |                             |                              |
   |-- Set region.textureHash ---|-- JSON Patch sync ---------->|
   |                             |                              |
   |                             |<-- Request texture ----------|
   |                             |   (hash)                     |
   |                             |                              |
   |                             |-- Send texture data -------->|
   |                             |   (hash, dataUrl)            |
```

## Key Concepts

### Hash-Based Deduplication
- All textures are identified by a SHA-256 hash of their **original** content
- Same image used across multiple tokens/regions is stored only once
- Hash is a 16-character hex string (truncated SHA-256)

### Compression
- Textures are compressed before upload based on their usage size
- A 4000x4000 image used on a 200x200 region is resized to ~300x300
- Maximum dimension: 2048px
- Re-uploads happen if texture is later used at larger size
- Transparency is preserved (PNG for transparent, JPEG for opaque)

### Data Flow
1. **Local Storage**: Original textures are stored in IndexedDB
2. **Compression**: Textures are compressed based on usage dimensions before upload
3. **Sync**: Only the hash is synced via JSON Patch, not the actual image data
4. **On-Demand Loading**: Players request textures from server when they encounter unknown hashes

### State Properties
- **Region**: `textureHash` (synced) + `backgroundImage` (local in-memory)
- **Token**: `imageHash` (synced) + `imageUrl` (local in-memory)

## Files

### Client-Side
- `src/lib/textureStorage.ts` - Region texture IndexedDB storage
- `src/lib/tokenTextureStorage.ts` - Token texture IndexedDB storage
- `src/lib/textureSync.ts` - Socket.io texture upload/request with compression
- `src/lib/textureCompression.ts` - Canvas-based image resizing
- `src/hooks/useTextureLoader.ts` - Auto-loads textures for regions/tokens
- `src/components/TextureDownloadProgress.tsx` - Download progress UI

### Server-Side (MULTIPLAYER_SERVER_BUNDLE.txt)
- `sessionManager.js` - Texture storage in memory with session cleanup
- `eventHandlers.js` - `handleTextureUpload` and `handleTextureRequest`

## Socket Events

### Client → Server
- `texture:upload` - `{ hash, dataUrl, size, dimensions? }` - DM uploads a texture
- `texture:request` - `{ hash }` - Player requests a texture by hash

### Server → Client
- `texture:available` - `{ hash, size, uploadedBy }` - Notifies new texture available
- `texture:data` - `{ hash, dataUrl }` - Sends requested texture data
- `texture:not_found` - `{ hash }` - Texture not found on server

## Compression Details

### How It Works
1. When a texture is applied to a region/token, the usage dimensions are recorded
2. The texture is resized to fit the usage size + 50% padding
3. If the same texture is later used at a larger size, it's re-uploaded at higher resolution
4. Transparency detection determines output format (PNG vs JPEG)

### Size Calculation
```typescript
// Target = usage size * 1.5 (for flexibility)
// Capped at original size (no upscaling)
// Capped at 2048px max dimension
// Minimum 64px
```

### Benefits
- 4000x4000 image → 300x300 for small tokens = ~95% size reduction
- Reduces server memory usage
- Faster download for players
- Maintains quality at usage size

## Usage

### Applying a Texture (DM)
```typescript
import { saveRegionTexture } from '@/lib/textureStorage';
import { uploadTexture } from '@/lib/textureSync';

// 1. Save locally and get hash
const hash = await saveRegionTexture(regionId, dataUrl);

// 2. Upload to server with compression based on region size
await uploadTexture(hash, dataUrl, region.width, region.height);

// 3. Update state (textureHash will sync via JSON Patch)
updateRegion(regionId, {
  backgroundImage: dataUrl,
  textureHash: hash
});
```

### Auto-Loading (Players)
The `useTextureLoader` hook automatically:
1. Detects regions/tokens with `textureHash` but no image data
2. Checks local IndexedDB cache
3. Requests from server if not found locally
4. Updates state when loaded

## Limitations
- Textures stored in server memory (lost on server restart)
- Max texture size: 10MB (configurable in server)
- Players can only download textures after DM uploads them
- Compressed textures may lose quality if later displayed larger than upload size
