# Texture Synchronization System

This document describes how textures (images for tokens and regions) are synchronized across multiplayer clients.

## Architecture Overview

```
DM Client                      Server                      Player Clients
-----------                    ------                      --------------
   |                             |                              |
   |-- Upload texture ---------->|                              |
   |   (hash, dataUrl)           |                              |
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
- All textures are identified by a SHA-256 hash of their content
- Same image used across multiple tokens/regions is stored only once
- Hash is a 16-character hex string (truncated SHA-256)

### Data Flow
1. **Local Storage**: Textures are stored in IndexedDB (not localStorage due to size limits)
2. **Sync**: Only the hash is synced via JSON Patch, not the actual image data
3. **On-Demand Loading**: Players request textures from server when they encounter unknown hashes

### State Properties
- **Region**: `textureHash` (synced) + `backgroundImage` (local in-memory)
- **Token**: `imageHash` (synced) + `imageUrl` (local in-memory)

## Files

### Client-Side
- `src/lib/textureStorage.ts` - Region texture IndexedDB storage
- `src/lib/tokenTextureStorage.ts` - Token texture IndexedDB storage
- `src/lib/textureSync.ts` - Socket.io texture upload/request
- `src/hooks/useTextureLoader.ts` - Auto-loads textures for regions/tokens
- `src/components/TextureDownloadProgress.tsx` - Download progress UI

### Server-Side (MULTIPLAYER_SERVER_BUNDLE.txt)
- `sessionManager.js` - Texture storage in memory with session cleanup
- `eventHandlers.js` - `handleTextureUpload` and `handleTextureRequest`

## Socket Events

### Client → Server
- `texture:upload` - `{ hash, dataUrl, size }` - DM uploads a texture
- `texture:request` - `{ hash }` - Player requests a texture by hash

### Server → Client
- `texture:available` - `{ hash, size, uploadedBy }` - Notifies new texture available
- `texture:data` - `{ hash, dataUrl }` - Sends requested texture data
- `texture:not_found` - `{ hash }` - Texture not found on server

## Usage

### Applying a Texture (DM)
```typescript
import { saveRegionTexture } from '@/lib/textureStorage';
import { uploadTexture } from '@/lib/textureSync';

// 1. Save locally and get hash
const hash = await saveRegionTexture(regionId, dataUrl);

// 2. Upload to server for sync
await uploadTexture(hash, dataUrl);

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
