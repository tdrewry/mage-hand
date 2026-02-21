

# Create Networking Architecture Documentation

## Overview
Create two documentation files in the `docs/` directory capturing the complete networking architecture for reference by the secondary networking agent and future development.

## Files to Create

### 1. `docs/Project-Architecture-for-Network-Agent.md`
The architecture briefing previously provided in chat, saved as a permanent reference. Contents:
- Framework and UI stack (React 18, TypeScript, Vite, Tailwind, Paper.js)
- State management overview (Zustand stores, list of all stores with sync status)
- Sync/Networking API summary (syncPatch middleware, transport layer, manual sync, RPC)
- Key method names and patterns
- Server architecture (Node.js + Socket.IO relay)
- History system overview

### 2. `docs/Networking-Architecture.md`
A comprehensive deep-dive reference document covering:

**Section 1 - Transport Layer**
- `SocketClient` class (src/lib/socketClient.ts): connection lifecycle, reconnection with exponential backoff, event handler registration, status callbacks
- Connection statuses: disconnected, connecting, connected, error, reconnecting
- Socket.IO config: websocket+polling transports, 10s timeout, configurable reconnection attempts/delays

**Section 2 - JSON Patch Sync System (sync-core)**
- Library architecture: types.ts, middleware.ts, deduplication.ts, transports/
- `createSyncPatch` middleware factory: wraps Zustand `set()`, generates RFC 6902 patches via `fast-json-patch.compare()`, filters by include/exclude paths, throttles with configurable delay, sends via TransportAdapter
- `BaseTransport` abstract class: channel subscription map, deduplication integration, userId-based echo prevention
- `SocketIOTransport`: sends on `sync:patch`, listens on `sync:patch_received`, marks own messages processed
- `MessageDeduplication`: TTL-based (5 min), cleanup every 60s, max 10k entries, format `{userId}-{timestamp}-{random}`
- Project bindings (src/lib/sync/index.ts): wraps sync-core with `messageIdManager` singleton and `multiplayerStore.currentUserId`

**Section 3 - Store Sync Configuration**
Table of all Zustand stores with their sync channel, throttle, excluded paths, and middleware stack (persist + syncPatch). Stores:
- sessionStore: channel `session`, 50ms throttle, excludes selectedTokenIds/currentPlayerId
- regionStore: channel `regions`
- mapStore: channel `maps`
- fogStore: channel `fog`
- lightStore: channel `lights`
- initiativeStore: channel `initiative`
- roleStore: NOT synced via syncPatch (security-sensitive, manual sync via `sync_role`)
- multiplayerStore, cardStore, actionStore, uiModeStore, etc.: local only or RPC-driven

**Section 4 - SyncManager (src/lib/syncManager.ts)**
- Singleton class orchestrating all multiplayer coordination
- Initialization flow: create SocketClient -> setup event handlers -> connect -> set patchTransport socket
- Session lifecycle: createSession, joinSession, leaveSession, disconnect
- Legacy event handlers (still active): token_updated, initiative_updated, combat_state_changed, map_updated, fog_updated, region_updated, light_updated, role_updated
- Full state sync: broadcastFullStateSync gathers all stores, strips large data URIs, emits `broadcast_full_state`
- handleFullStateSync: applies tokens, initiative, maps, regions, fog, lights, roles from payload
- Permission checking via `hasPermission()` from rolePermissions.ts

**Section 5 - RPC System**
- Purpose: one-way commands that don't carry state diffs
- Events and payloads:
  - `rpc_set_ui_mode` -> `ui_mode_changed`: SetUiModePayload (mode, targetUserId)
  - `rpc_open_card` -> `card_opened`: OpenCardPayload (cardType, targetUserId)
  - `rpc_sync_initiative_order` -> `initiative_order_synced`: SyncInitiativeOrderPayload (initiativeOrder[])
  - `rpc_request_full_state` -> `full_state_requested`: RequestFullStatePayload
  - `rpc_broadcast_full_state` -> `full_state_broadcasted`: BroadcastFullStatePayload + FullStateSyncPayload
- All RPCs include messageId, senderId, senderRoleIds, timestamp
- All handlers check deduplication and ignore own messages

**Section 6 - Event Reference Table**
Complete listing of all client->server and server->client event names from `multiplayerEvents.ts`

**Section 7 - Role-Based Permissions**
- Permission keys used for sync authorization
- `hasPermission()`, `canControlToken()`, `canSeeToken()` helpers
- How permissions gate sync operations

**Section 8 - Data Flow Diagrams**
ASCII diagrams showing:
- Local state change -> syncPatch middleware -> transport -> server -> other clients
- Full state sync flow on session join
- RPC command flow

## Technical Details

- Both files will be Markdown
- Version bump to follow in src/lib/version.ts (patch increment)
- No code changes beyond file creation and version bump

