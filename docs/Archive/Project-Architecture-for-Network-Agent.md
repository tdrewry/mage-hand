# Project Architecture Briefing for Network Agent

> Reference document for the secondary networking agent. Captures the full stack, state management, sync APIs, and server architecture.

## Framework & UI Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| Styling | Tailwind CSS + Radix UI (shadcn/ui) |
| Canvas Renderer | Paper.js (2D vector graphics on `<canvas>`) |
| State Management | Zustand (v5) — all stores in `src/stores/` |
| Networking | Socket.IO client (`socket.io-client` v4.8) |

## State Management Overview

All application state lives in Zustand stores. Stores fall into three categories:

### Synced via `syncPatch` Middleware (automatic JSON Patch sync)

| Store | File | Sync Channel | Throttle | Excluded Paths |
|-------|------|--------------|----------|----------------|
| `useSessionStore` | `sessionStore.ts` | `tokens` | 50ms | `selectedTokenIds`, `viewportTransforms`, `currentPlayerId`, `tokens.*.imageUrl` |
| `useRegionStore` | `regionStore.ts` | `regions` | — | `regions.*.backgroundImage` |
| `useMapStore` | `mapStore.ts` | `maps` | — | `selectedMapId` |
| `useFogStore` | `fogStore.ts` | `fog` | — | `realtimeVisionDuringDrag`, `realtimeVisionThrottleMs`, `effectSettings` |
| `useLightStore` | `lightStore.ts` | `lights` | — | — |
| `useInitiativeStore` | `initiativeStore.ts` | `initiative` | — | `isTrackerVisible`, `restrictMovement` |

### Manually Synced (security-sensitive or special)

| Store | File | Sync Method |
|-------|------|-------------|
| `useRoleStore` | `roleStore.ts` | Manual via `sync_role` event (not syncPatch — permissions are security-sensitive) |

### Local Only (not synced)

| Store | File | Purpose |
|-------|------|---------|
| `useMultiplayerStore` | `multiplayerStore.ts` | Connection state, session info, connected users |
| `useCardStore` | `cardStore.ts` | UI card/panel visibility and positions |
| `useActionStore` | `actionStore.ts` | Action resolution system (attacks, saves) |
| `useUiModeStore` | `uiModeStore.ts` | DM/play mode (synced via RPC, not patches) |
| `useUndoRedoStore` | `undoRedoStore.ts` | Undo/redo stack |
| `useDungeonStore` | `dungeonStore.ts` | Dungeon import data |
| `useGroupStore` | `groupStore.ts` | Token grouping |
| `useCreatureStore` | `creatureStore.ts` | Creature library |
| `useDiceStore` | `diceStore.ts` | Dice roller state |
| `useIlluminationStore` | `illuminationStore.ts` | Illumination rendering settings |
| `useMapObjectStore` | `mapObjectStore.ts` | Map object overlays |
| `useHatchingStore` | `hatchingStore.ts` | Dyson hatching shader |

## Sync / Networking API Summary

### 1. JSON Patch Middleware (`syncPatch`)

The primary sync mechanism. Wraps Zustand's `set()` function to automatically:

1. Capture state before and after each `set()` call
2. Generate RFC 6902 JSON Patch operations via `fast-json-patch.compare()`
3. Filter patches by `includePaths`/`excludePaths`
4. Send patches via the `TransportAdapter` (Socket.IO)

**Usage pattern:**
```typescript
const withSyncPatch = syncPatch<MyStore>({ 
  channel: 'myChannel',
  throttleMs: 50,
  excludePaths: ['localOnlyField'],
})(storeCreator);

const useMyStore = create(persist(withSyncPatch, persistOptions));
```

Any call to `set()` inside the store automatically generates and broadcasts patches. No manual sync calls needed.

### 2. Transport Layer

- **`SocketClient`** (`src/lib/socketClient.ts`): Connection lifecycle, reconnection, event routing
- **`SocketIOTransport`** (`src/lib/sync-core/transports/socketio.ts`): Sends on `sync:patch`, listens on `sync:patch_received`
- **`patchTransport`** (`src/lib/sync/index.ts`): Project-configured transport singleton

### 3. Manual Sync via SyncManager

Legacy event-based sync still active for some operations:
- `sync_role` — role assignments
- `broadcast_full_state` — full state broadcast on join/reconnect

### 4. RPC (Remote Procedure Calls)

One-way commands that don't carry state diffs:

| Client Event | Server Event | Purpose |
|-------------|-------------|---------|
| `rpc_set_ui_mode` | `ui_mode_changed` | DM switches players to play/DM mode |
| `rpc_open_card` | `card_opened` | Open a UI card on target client |
| `rpc_sync_initiative_order` | `initiative_order_synced` | Sync initiative reordering |
| `rpc_request_full_state` | `full_state_requested` | Player requests full sync from DM |
| `rpc_broadcast_full_state` | `full_state_broadcasted` | DM broadcasts full state |

## Key Method Names & Patterns

### Making Local State Changes
```typescript
// Any set() call auto-syncs via syncPatch:
useSessionStore.getState().addToken(token);
useSessionStore.getState().updateTokenPosition(id, x, y);
useMapStore.getState().addMap(mapData);
useRegionStore.getState().updateRegion(id, updates);
```

### Manual Sync Operations
```typescript
import { syncManager } from '@/lib/syncManager';

syncManager.broadcastFullStateSync();    // Broadcast all state
syncManager.syncRoleAssign(userId, roleIds); // Sync role assignment
syncManager.rpcSetUiMode('play');        // RPC: switch mode
syncManager.rpcOpenCard('initiative');   // RPC: open card
syncManager.rpcRequestFullState();       // RPC: request sync from DM
```

### Transport Management
```typescript
import { patchTransport } from '@/lib/sync';

patchTransport.setSocket(socket);   // After connection
patchTransport.clearSocket();       // On disconnect
```

## Server Architecture

- **Runtime**: Node.js
- **Protocol**: Socket.IO (WebSocket + polling fallback)
- **Role**: Pure relay server — no game logic, no state storage
- **Server code**: `SERVER_BUNDLE/` directory (reference only, runs externally)
- **Key behaviors**:
  - Relays `sync:patch` events to all other clients in the session
  - Manages session creation/joining with optional passwords
  - Tracks connected users per session
  - Broadcasts user join/leave events

## History System

- **Project Snapshots**: `src/lib/sessionHistory.ts` — saves/loads full project state
- **Action History**: `actionStore.ts` — logs `ActionHistoryEntry` items (attacks, saves)
- **Undo/Redo**: `src/lib/undoRedoManager.ts` + `undoRedoStore.ts` — command-based undo stack
- **Potential**: History entries could enable multiplayer replay in the future
