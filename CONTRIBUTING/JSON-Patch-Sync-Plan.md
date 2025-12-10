# JSON Patch Sync Middleware Implementation

## Status: Phase 2 Complete (Store Migration)

## Overview
Zustand middleware that automatically captures state changes, generates JSON Patches (RFC 6902), and synchronizes them via Socket.io. Provides Yjs-like developer experience (automatic sync) with deterministic conflict resolution.

## Files Created

### Core Infrastructure (`src/lib/sync/`)
- `types.ts` - Type definitions (JsonPatchOperation, SyncPatchPayload, SyncMiddlewareConfig, TransportAdapter)
- `patchTransport.ts` - Socket.io transport adapter (sends/receives patches, deduplication)
- `syncPatchMiddleware.ts` - Zustand middleware factory (wraps set(), generates patches, applies remote patches)
- `index.ts` - Barrel export

### Dependencies Added
- `fast-json-patch` - RFC 6902 compliant JSON Patch library

## Usage

```typescript
import { create } from 'zustand';
import { syncPatch } from '@/lib/sync';

// Wrap store with syncPatch middleware
export const useTokenStore = create(
  syncPatch({ 
    channel: 'tokens',
    throttleMs: 50,  // Optional: throttle high-frequency updates
    debug: true      // Optional: enable debug logging
  })((set, get) => ({
    tokens: [],
    addToken: (token) => set((state) => ({ 
      tokens: [...state.tokens, token] 
    })),
    // Sync happens automatically via middleware!
  }))
);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channel` | string | required | Channel name for routing (e.g., 'tokens') |
| `enabled` | boolean | true | Enable/disable sync |
| `throttleMs` | number | 0 | Throttle delay for high-frequency updates |
| `excludePaths` | string[] | [] | Paths to exclude from sync |
| `includePaths` | string[] | undefined | Only sync these paths (if set) |
| `debug` | boolean | false | Enable debug logging |

## Server Events

- **Outbound**: `sync:patch` - Send patches to server
- **Inbound**: `sync:patch_received` - Receive patches from other clients

## Next Steps

### Phase 2: Store Migration ✅ COMPLETE
Migrated stores:
1. [x] `sessionStore.ts` (tokens) - channel: 'tokens', throttle: 50ms
2. [x] `regionStore.ts` (regions) - channel: 'regions'
3. [x] `mapStore.ts` (maps) - channel: 'maps'
4. [x] `fogStore.ts` (fog settings) - channel: 'fog'
5. [x] `lightStore.ts` (lights) - channel: 'lights'
6. [x] `initiativeStore.ts` (combat) - channel: 'initiative'
7. [ ] `roleStore.ts` (permissions) - skipped (security-sensitive)

### Phase 3: Server Updates
- [ ] Add `sync:patch` handler to multiplayer server
- [ ] Broadcast patches to session members

### Phase 4: Cleanup
- [ ] Remove type-specific sync methods from syncManager
- [ ] Remove dead event handlers

## Integration with syncManager

The `patchTransport` needs to be initialized with the socket reference after connection:

```typescript
// In syncManager.ts after socket connects:
import { patchTransport } from '@/lib/sync';

// After socket connects:
patchTransport.setSocket(this.socketClient.getSocket());

// On disconnect:
patchTransport.clearSocket();
```
