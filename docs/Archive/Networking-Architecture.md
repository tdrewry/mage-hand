# Networking Architecture — Deep Dive Reference

> Comprehensive technical reference for all sync patterns, transport adapters, RPC events, and data flows.

---

## Table of Contents

1. [Transport Layer](#1-transport-layer)
2. [JSON Patch Sync System (sync-core)](#2-json-patch-sync-system-sync-core)
3. [Store Sync Configuration](#3-store-sync-configuration)
4. [SyncManager](#4-syncmanager)
5. [RPC System](#5-rpc-system)
6. [Event Reference Table](#6-event-reference-table)
7. [Role-Based Permissions](#7-role-based-permissions)
8. [Data Flow Diagrams](#8-data-flow-diagrams)

---

## 1. Transport Layer

### SocketClient (`src/lib/socketClient.ts`)

The `SocketClient` class manages the raw Socket.IO connection lifecycle.

**Connection Statuses:**
```typescript
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
```

**Configuration:**
```typescript
interface SocketClientConfig {
  serverUrl: string;
  reconnectionAttempts?: number;    // default: 5
  reconnectionDelay?: number;       // default: 2000ms
  reconnectionDelayMax?: number;    // default: 30000ms
}
```

**Socket.IO Options:**
- Transports: `['websocket', 'polling']`
- Connection timeout: `10000ms`
- Auto-reconnection: enabled with configurable attempts/delays

**Connection Lifecycle:**
1. `constructor(config)` — stores config, does not connect
2. `connect()` — creates Socket.IO instance, returns Promise resolving on `connect` event
3. `disconnect()` — calls `socket.disconnect()`, nulls reference, status → `disconnected`

**Reconnection with Exponential Backoff:**
- On server-initiated disconnect, triggers manual reconnect
- Delay formula: `min(reconnectionDelay × 2^(attempt-1), reconnectionDelayMax)`
- Max attempts configurable (default 5)
- Built-in Socket.IO reconnection also active for transport-level reconnects

**Event Handler Registration:**
- `on(event, handler)` — stores handler in Map, also registers on socket if connected
- `off(event, handler?)` — removes specific handler or all handlers for event
- `registerPendingHandlers()` — called after `connect()` to register pre-registered handlers
- Event types are typed via `ServerEventName` and `ClientEventName` from `multiplayerEvents.ts`

**Status Callbacks:**
- `onStatusChange(callback)` — single callback, called on every status transition
- Used by `SyncManager` to update `multiplayerStore.connectionStatus`

---

## 2. JSON Patch Sync System (sync-core)

### Library Architecture

```
src/lib/sync-core/
├── index.ts           # Public API exports
├── types.ts           # TypeScript interfaces
├── middleware.ts       # createSyncPatch factory + createBroadcastFullState
├── deduplication.ts   # MessageDeduplication class
└── transports/
    ├── index.ts       # Transport exports
    ├── base.ts        # BaseTransport abstract class
    └── socketio.ts    # SocketIOTransport implementation
```

### Types (`types.ts`)

```typescript
// JSON Patch operation (re-exported from fast-json-patch)
type JsonPatchOperation = Operation; // { op: 'add'|'remove'|'replace'|'move'|'copy'|'test', path: string, value?: any }

// Payload sent over the wire
interface SyncPatchPayload {
  messageId: string;
  userId: string;
  channel: string;          // e.g. 'tokens', 'regions', 'maps'
  patches: JsonPatchOperation[];
  timestamp: number;
  targetUserId?: string;
}

// Per-store middleware configuration
interface SyncMiddlewareConfig {
  channel: string;
  enabled?: boolean;        // default: true
  throttleMs?: number;      // default: 0 (immediate)
  excludePaths?: string[];  // paths to skip syncing
  includePaths?: string[];  // if set, only sync these paths
  debug?: boolean;
}

// Transport adapter interface
interface TransportAdapter {
  send(payload: SyncPatchPayload): void;
  subscribe(channel: string, handler: (payload: SyncPatchPayload) => void): void;
  unsubscribe(channel: string): void;
  isConnected(): boolean;
  getUserId(): string | undefined;
}

// Deduplication adapter interface
interface DeduplicationAdapter {
  generateMessageId(userId: string): string;
  shouldProcess(messageId: string): boolean;
  markProcessed(messageId: string): void;
}
```

### `createSyncPatch` Middleware Factory (`middleware.ts`)

**Signature:**
```typescript
function createSyncPatch(options: {
  transport: TransportAdapter;
  deduplication?: DeduplicationAdapter;
}): <T>(config: SyncMiddlewareConfig) => (initializer: StateCreator<T>) => StateCreator<T>
```

**How it works:**

1. **Wraps `set()`**: The middleware replaces Zustand's `set` function with `syncSet`
2. **Captures diffs**: On every `syncSet` call:
   - Snapshots state before and after
   - Runs `fast-json-patch.compare(prevState, nextState)` to generate RFC 6902 patches
   - Filters patches through `includePaths`/`excludePaths`
3. **Sends patches**: Filtered patches are queued (if throttled) or sent immediately via `transport.send()`
4. **Prevents echo**: Sets `isApplyingRemote = true` during remote patch application, skipping broadcast

**Throttling:**
- When `throttleMs > 0`, patches accumulate in `pendingPatches[]`
- A `setTimeout` flushes them after the delay
- Multiple rapid `set()` calls batch into one network message

**Receiving remote patches:**
- Transport calls `handleRemotePatches(payload)` for the subscribed channel
- Deep clones current state, applies patches via `applyPatch()`, then calls `set(newState, true)` (replace mode)
- Updates `lastState` snapshot after application

### `createBroadcastFullState` (`middleware.ts`)

Generates patches from `compare({}, currentState)` to broadcast entire store state:
```typescript
function createBroadcastFullState(transport, deduplication) {
  return function broadcastFullState<T>(channel: string, state: T): void;
}
```

### BaseTransport (`transports/base.ts`)

Abstract class providing:
- `handlers: Map<string, PatchHandler[]>` — channel → handler subscriptions
- `deduplication?: DeduplicationAdapter` — optional dedup integration
- `currentUserId?: string` — for echo prevention
- `dispatchToHandlers(payload)`:
  1. Skip if `payload.userId === currentUserId` (echo prevention)
  2. Check `deduplication.shouldProcess()`, mark processed
  3. Call all handlers for `payload.channel`

### SocketIOTransport (`transports/socketio.ts`)

Extends `BaseTransport`:

**Event names (constants):**
```typescript
const DEFAULT_SEND_EVENT = 'sync:patch';
const DEFAULT_RECEIVE_EVENT = 'sync:patch_received';
```

**Key methods:**
- `setSocket(socket)` — stores socket, sets up listener for `sync:patch_received`
- `clearSocket()` — removes listener, nulls socket
- `send(payload)` — marks own message as processed (prevents echo), emits `sync:patch`
- `isConnected()` — returns `socket?.connected ?? false`

### MessageDeduplication (`deduplication.ts`)

Built-in TTL-based deduplication:

| Setting | Default |
|---------|---------|
| TTL | 5 minutes |
| Cleanup interval | 60 seconds |
| Max entries | 10,000 |
| ID format | `{userId}-{timestamp}-{counter}` |

- `shouldProcess(messageId)` → `!processedIds.has(messageId)`
- `markProcessed(messageId)` → stores with timestamp, evicts oldest if at capacity
- `cleanup()` — removes entries older than TTL

### Project Bindings (`src/lib/sync/index.ts`)

Bridges sync-core with project-specific dependencies:

```typescript
// Wraps messageIdManager singleton as DeduplicationAdapter
const projectDeduplication = {
  generateMessageId: (userId) => messageIdManager.generateMessageId(userId),
  shouldProcess: (messageId) => messageIdManager.shouldProcess(messageId),
  markProcessed: (messageId) => messageIdManager.markProcessed(messageId),
};

// Creates transport with project deduplication
const transport = createSocketIOTransport({ deduplication: projectDeduplication });

// Overrides getUserId to read from multiplayerStore
transport.getUserId = () => useMultiplayerStore.getState().currentUserId || undefined;

// Exports
export const patchTransport = transport;
export const syncPatch = createSyncPatchCore({ transport, deduplication: projectDeduplication });
export const broadcastFullState = createBroadcastFullStateCore(patchTransport, projectDeduplication);
```

---

## 3. Store Sync Configuration

### Stores with `syncPatch` Middleware

| Store | Channel | ThrottleMs | ExcludePaths | Persist Key |
|-------|---------|-----------|-------------|-------------|
| `useSessionStore` | `tokens` | `50` | `selectedTokenIds`, `viewportTransforms`, `currentPlayerId`, `tokens.*.imageUrl` | `vtt-session-storage` |
| `useRegionStore` | `regions` | — | `regions.*.backgroundImage` | `canvas-regions-store` |
| `useMapStore` | `maps` | — | `selectedMapId` | `map-store` |
| `useFogStore` | `fog` | — | `realtimeVisionDuringDrag`, `realtimeVisionThrottleMs`, `effectSettings` | `fog-of-war-store` |
| `useLightStore` | `lights` | — | — | `light-store` |
| `useInitiativeStore` | `initiative` | — | `isTrackerVisible`, `restrictMovement` | `vtt-initiative-storage` |

### Middleware Stack Order

All synced stores use the same pattern:
```
create → persist → syncPatch → storeCreator
```

Concrete example:
```typescript
const storeCreator: StateCreator<MyState> = (set, get) => ({ ... });
const withSyncPatch = syncPatch<MyState>({ channel: '...', ... })(storeCreator);
const useMyStore = create(persist(withSyncPatch, persistOptions));
```

### Stores NOT Using syncPatch

| Store | Sync Method | Reason |
|-------|------------|--------|
| `useRoleStore` | Manual `sync_role` event | Security-sensitive; permissions must be validated server-side |
| `useMultiplayerStore` | Not synced (local state) | Connection metadata, not game state |
| `useCardStore` | RPC (`card_opened`) | UI layout is per-client |
| `useUiModeStore` | RPC (`ui_mode_changed`) | Mode is set by DM command, not state diff |
| `useActionStore` | Not synced | Local action resolution |
| `useUndoRedoStore` | Not synced | Local undo/redo stack |
| Others | Not synced | Local UI/rendering state |

---

## 4. SyncManager (`src/lib/syncManager.ts`)

### Overview

Singleton class (`export const syncManager = new SyncManager()`) orchestrating all multiplayer coordination. ~1275 lines.

### Initialization Flow

```
1. syncManager.initialize(serverUrl)
   → new SocketClient({ serverUrl })
   → socketClient.onStatusChange(→ multiplayerStore.setConnectionStatus)
   → setupEventHandlers()

2. syncManager.connect()
   → socketClient.connect()
   → patchTransport.setSocket(socket)
   → Setup reconnection handler (re-sets patchTransport, auto-rejoins session)
```

### Session Lifecycle

| Method | Action |
|--------|--------|
| `createSession(username, password?)` | Emits `create_session` |
| `joinSession(code, username, password?)` | Emits `join_session` |
| `leaveSession()` | Emits `leave_session`, resets multiplayerStore |
| `disconnect()` | Clears patchTransport, disconnects socket, resets store |

### Event Handlers — Session

| Server Event | Handler | Action |
|-------------|---------|--------|
| `session_joined` / `session_created` | `handleSessionJoined` | Sets session info, userId, users; auto-broadcasts if DM with local state |
| `user_joined` | `handleUserJoined` | Adds user; DM auto-broadcasts full state to new player |
| `user_left` | `handleUserLeft` | Removes user |
| `session_error` | `handleSessionError` | Adds sync error |

### Event Handlers — Legacy State Sync

These handlers process events from the legacy (pre-syncPatch) sync system. They are **still active** and handle events that the server relays:

| Server Event | Handler | Dedup | Echo Check | Store Updated |
|-------------|---------|-------|------------|---------------|
| `token_updated` | `handleTokenUpdated` | ✅ | ✅ userId | `sessionStore` |
| `initiative_updated` | `handleInitiativeUpdated` | ✅ | ✅ userId | `initiativeStore` |
| `combat_state_changed` | `handleCombatStateChanged` | — | ✅ userId | `initiativeStore` |
| `map_updated` | `handleMapUpdated` | ✅ | ✅ userId | `mapStore` |
| `fog_updated` | `handleFogUpdated` | ✅ | ✅ userId | `fogStore` |
| `region_updated` | `handleRegionUpdated` | ✅ | ✅ userId | `regionStore` |
| `light_updated` | `handleLightUpdated` | ✅ | ✅ userId | `lightStore` |
| `role_updated` | `handleRoleUpdated` | ✅ | ✅ senderId | `multiplayerStore` (user roles) |

All handlers follow the same pattern:
1. Check `messageIdManager.shouldProcess(messageId)`
2. Check `userId === currentUserId` (skip own)
3. `messageIdManager.markProcessed(messageId)`
4. Apply state change

### Full State Sync

**`broadcastFullStateSync()`** — gathers state from all stores:
- Strips `imageUrl` from tokens (keeps `imageHash` for texture sync)
- Strips `backgroundImage` from regions (keeps `textureHash`)
- Emits `broadcast_full_state` with `FullStateSyncPayload`

**`handleFullStateSync(data)`** — applies incoming full state:
- Tokens: clears all, adds each from payload
- Initiative: sets order, starts combat if applicable
- Maps: replaces entire maps array
- Fog: applies fog settings
- Regions: sets regions array
- Lights: sets lights array
- Roles: sets roles array
- Players: sets connected users list

### Permission Checking

```typescript
checkPermission(action: string): boolean
```

Maps action strings to permission keys:
| Action | Permission Key |
|--------|---------------|
| `token.add` | `canCreateTokens` |
| `token.update` | `canControlOwnTokens` |
| `token.delete` | `canDeleteOwnTokens` |
| `initiative.manage` | `canManageInitiative` |
| `map.edit` | `canEditMap` |
| `fog.manage` | `canManageFog` |

---

## 5. RPC System

### Purpose

Remote Procedure Calls are **one-way commands** that don't carry state diffs. They trigger specific actions on target clients without JSON Patch diffing.

### RPC Events

| Client Emits | Server Broadcasts | Payload Type | Purpose |
|-------------|------------------|-------------|---------|
| `rpc_set_ui_mode` | `ui_mode_changed` | `SetUiModePayload` | Switch client(s) to DM or play mode |
| `rpc_open_card` | `card_opened` | `OpenCardPayload` | Open a UI panel on target client(s) |
| `rpc_sync_initiative_order` | `initiative_order_synced` | `SyncInitiativeOrderPayload` | Push initiative order after manual reorder |
| `rpc_request_full_state` | `full_state_requested` | `RequestFullStatePayload` | Player asks DM for full state |
| `rpc_broadcast_full_state` | `full_state_broadcasted` | `BroadcastFullStatePayload` | DM sends full state (targeted or broadcast) |

### Common Payload Fields

All RPC payloads include:
```typescript
{
  messageId: string;    // For deduplication
  senderId: string;     // Who sent this
  senderRoleIds: string[]; // Sender's roles (for permission checks)
  timestamp: number;    // When sent
  targetUserId?: string; // If set, only this user processes it
}
```

### RPC Payload Details

**`SetUiModePayload`:**
```typescript
{ mode: 'dm' | 'play', targetUserId?: string }
```

**`OpenCardPayload`:**
```typescript
{ cardType: string, targetUserId?: string }
```

**`SyncInitiativeOrderPayload`** (extends `BaseSyncPayload`):
```typescript
{ action: 'set_order', initiativeOrder: InitiativeEntry[] }
```

**`RequestFullStatePayload`:**
```typescript
{ /* only common fields */ }
```

**`BroadcastFullStatePayload`:**
```typescript
{ targetUserId?: string }
// Emitted alongside FullStateSyncPayload as: { payload, state }
```

### Handler Pattern

All RPC handlers follow:
1. Check `targetUserId` — skip if not for us
2. Check `messageIdManager.shouldProcess(messageId)` — skip duplicates
3. Check `senderId === currentUserId` — skip own
4. `messageIdManager.markProcessed(messageId)`
5. Apply the command

---

## 6. Event Reference Table

### Client → Server Events (`ClientEvents`)

| Constant | Event String | Payload Type |
|----------|-------------|-------------|
| `CREATE_SESSION` | `create_session` | `CreateSessionPayload` |
| `JOIN_SESSION` | `join_session` | `JoinSessionPayload` |
| `LEAVE_SESSION` | `leave_session` | — |
| `SYNC_TOKEN` | `sync_token` | `SyncTokenPayload` |
| `SYNC_INITIATIVE` | `sync_initiative` | `SyncInitiativePayload` |
| `SYNC_COMBAT` | `sync_combat` | `SyncCombatPayload` |
| `SYNC_FOG` | `sync_fog` | `SyncFogPayload` |
| `SYNC_ROLE` | `sync_role` | `SyncRolePayload` |
| `SYNC_MAP` | `sync_map` | `SyncMapPayload` |
| `SYNC_REGION` | `sync_region` | `SyncRegionPayload` |
| `SYNC_LIGHT` | `sync_light` | `SyncLightPayload` |
| `RPC_SET_UI_MODE` | `rpc_set_ui_mode` | `SetUiModePayload` |
| `RPC_OPEN_CARD` | `rpc_open_card` | `OpenCardPayload` |
| `RPC_SYNC_INITIATIVE_ORDER` | `rpc_sync_initiative_order` | `SyncInitiativeOrderPayload` |
| `RPC_REQUEST_FULL_STATE` | `rpc_request_full_state` | `RequestFullStatePayload` |
| `RPC_BROADCAST_FULL_STATE` | `rpc_broadcast_full_state` | `BroadcastFullStatePayload` |
| `REQUEST_FULL_SYNC` | `request_full_sync` | — |
| `KICK_USER` | `kick_user` | — |

**Additionally (from sync-core):**
| Event | Purpose |
|-------|---------|
| `sync:patch` | JSON Patch payload from syncPatch middleware |

### Server → Client Events (`ServerEvents`)

| Constant | Event String | Payload Type |
|----------|-------------|-------------|
| `SESSION_CREATED` | `session_created` | `SessionJoinedPayload` |
| `SESSION_JOINED` | `session_joined` | `SessionJoinedPayload` |
| `SESSION_LEFT` | `session_left` | — |
| `USER_JOINED` | `user_joined` | `UserJoinedPayload` |
| `USER_LEFT` | `user_left` | `UserLeftPayload` |
| `SESSION_ERROR` | `session_error` | `SessionErrorPayload` |
| `FULL_STATE_SYNC` | `full_state_sync` | `FullStateSyncPayload` |
| `TOKEN_UPDATED` | `token_updated` | `SyncTokenPayload` |
| `TOKEN_ADDED` | `token_added` | `TokenAddedPayload` |
| `TOKEN_REMOVED` | `token_removed` | `TokenRemovedPayload` |
| `INITIATIVE_UPDATED` | `initiative_updated` | `SyncInitiativePayload` |
| `COMBAT_STATE_CHANGED` | `combat_state_changed` | `CombatStateChangedPayload` |
| `TURN_CHANGED` | `turn_changed` | — |
| `FOG_UPDATED` | `fog_updated` | `SyncFogPayload` |
| `ROLE_ASSIGNED` | `role_assigned` | — |
| `MAP_UPDATED` | `map_updated` | `SyncMapPayload` |
| `REGION_UPDATED` | `region_updated` | `SyncRegionPayload` |
| `LIGHT_UPDATED` | `light_updated` | `SyncLightPayload` |
| `ROLE_UPDATED` | `role_updated` | `SyncRolePayload` |
| `UI_MODE_CHANGED` | `ui_mode_changed` | `SetUiModePayload` |
| `CARD_OPENED` | `card_opened` | `OpenCardPayload` |
| `INITIATIVE_ORDER_SYNCED` | `initiative_order_synced` | `SyncInitiativeOrderPayload` |
| `FULL_STATE_REQUESTED` | `full_state_requested` | `RequestFullStatePayload` |
| `FULL_STATE_BROADCASTED` | `full_state_broadcasted` | `{ payload: BroadcastFullStatePayload, state: FullStateSyncPayload }` |
| `USER_LIST_UPDATED` | `user_list_updated` | `UserListUpdatedPayload` |
| `USER_ROLE_CHANGED` | `user_role_changed` | `UserRoleChangedPayload` |

**Additionally (from sync-core):**
| Event | Purpose |
|-------|---------|
| `sync:patch_received` | JSON Patch payload relayed by server |

---

## 7. Role-Based Permissions

### Permission Keys

Defined in `Role.permissions` (`src/stores/roleStore.ts`):

```typescript
interface RolePermissions {
  // Token control
  canControlOwnTokens: boolean;
  canControlOtherTokens: boolean;
  
  // Vision & fog
  canSeeAllFog: boolean;
  canSeeFriendlyVision: boolean;
  canSeeHostileVision: boolean;
  
  // Token visibility
  canSeeOwnTokens: boolean;
  canSeeOtherTokens: boolean;
  canSeeHiddenTokens: boolean;
  
  // Token management
  canCreateTokens: boolean;
  canDeleteOwnTokens: boolean;
  canDeleteOtherTokens: boolean;
  
  // Role & hostility management
  canManageRoles: boolean;
  canAssignRoles: boolean;
  canAssignTokenRoles: boolean;
  canManageHostility: boolean;
  
  // Map & environment
  canEditMap: boolean;
  canManageFog: boolean;
  canManageInitiative: boolean;
}
```

### Default Roles

| Role | ID | All Permissions |
|------|-----|----------------|
| Dungeon Master | `dm` | All `true` |
| Player | `player` | `canControlOwnTokens`, `canSeeFriendlyVision`, `canSeeOwnTokens`, `canSeeOtherTokens`, `canDeleteOwnTokens` |

### Permission Helpers (`src/lib/rolePermissions.ts`)

```typescript
// Core check — player has permission if ANY of their roles grant it
hasPermission(player: Player, allRoles: Role[], permissionKey: keyof RolePermissions): boolean

// Token-specific checks
canControlToken(token: Token, player: Player, allRoles: Role[]): boolean
canSeeToken(token: Token, player: Player, allRoles: Role[]): boolean
canDeleteToken(token: Token, player: Player, allRoles: Role[]): boolean

// Relationship
getTokenRelationship(token, player, allRoles): 'friendly' | 'neutral' | 'hostile'
areRolesHostile(roleId1, roleId2, allRoles): boolean

// Convenience
canCreateTokens(player, allRoles): boolean
canManageRoles(player, allRoles): boolean
canAssignRoles(player, allRoles): boolean
canAssignTokenRoles(player, allRoles): boolean
canManageHostility(player, allRoles): boolean
canEditMap(player, allRoles): boolean
canManageFog(player, allRoles): boolean
canManageInitiative(player, allRoles): boolean
canSeeAllFog(player, allRoles): boolean
canSeeFriendlyVision(player, allRoles): boolean
canSeeHostileVision(player, allRoles): boolean
```

### How Permissions Gate Sync Operations

1. **SyncManager.checkPermission(action)** — maps action strings to permission keys, checks current player
2. **RPC handlers** — `handleFullStateRequested` checks `canManageFog` (proxy for DM) before responding
3. **roleStore** — not synced via syncPatch; uses manual `sync_role` event requiring `canAssignRoles`
4. **Client-side enforcement** — UI components check permissions to show/hide controls; sync is a second layer

---

## 8. Data Flow Diagrams

### Local State Change → Remote Clients (syncPatch)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT A (Local)                                                    │
│                                                                      │
│  store.addToken(token)                                               │
│       │                                                              │
│       ▼                                                              │
│  syncPatch middleware intercepts set()                                │
│       │                                                              │
│       ├─► compare(prevState, nextState) → JSON Patches               │
│       ├─► filterPatches(excludePaths) → filtered patches             │
│       ├─► queuePatches (if throttleMs > 0, batch in pendingPatches)  │
│       │                                                              │
│       ▼                                                              │
│  transport.send({                                                    │
│    messageId, userId, channel: 'tokens',                             │
│    patches: [{ op: 'add', path: '/tokens/-', value: {...} }]        │
│  })                                                                  │
│       │                                                              │
│       ▼                                                              │
│  socket.emit('sync:patch', payload)                                  │
│  deduplication.markProcessed(messageId) ← prevents echo             │
└──────┬───────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  SERVER (Relay)              │
│                              │
│  Receives 'sync:patch'      │
│  Broadcasts to all other    │
│  clients in session as      │
│  'sync:patch_received'      │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT B (Remote)                                                   │
│                                                                      │
│  socket.on('sync:patch_received', payload)                           │
│       │                                                              │
│       ▼                                                              │
│  BaseTransport.dispatchToHandlers(payload)                           │
│       ├─► Skip if payload.userId === currentUserId (echo)            │
│       ├─► deduplication.shouldProcess(messageId)                     │
│       ├─► deduplication.markProcessed(messageId)                     │
│       │                                                              │
│       ▼                                                              │
│  handleRemotePatches(payload)                                        │
│       ├─► isApplyingRemote = true                                    │
│       ├─► deepClone(currentState)                                    │
│       ├─► applyPatch(clonedState, patches)                           │
│       ├─► set(newState, true) ← replace mode                        │
│       └─► isApplyingRemote = false (prevents re-broadcast)           │
└──────────────────────────────────────────────────────────────────────┘
```

### Full State Sync on Session Join

```
┌──────────────┐     join_session     ┌──────────┐    user_joined    ┌──────────────┐
│  NEW PLAYER  │ ──────────────────►  │  SERVER  │ ───────────────►  │     DM       │
│  (Client B)  │                      │          │                   │  (Client A)  │
└──────────────┘                      └──────────┘                   └──────┬───────┘
       │                                    │                               │
       │         session_joined             │                               │
       │ ◄──────────────────────────────────┤                               │
       │  (sessionCode, userId, users)      │                               │
       │                                    │                               │
       │                                    │     broadcast_full_state      │
       │                                    │ ◄─────────────────────────────┤
       │                                    │  (FullStateSyncPayload)       │
       │                                    │                               │
       │         full_state_sync            │                               │
       │ ◄──────────────────────────────────┤                               │
       │                                    │                               │
       ▼                                    │                               │
  handleFullStateSync()                     │                               │
  ├─► Apply tokens                          │                               │
  ├─► Apply initiative                      │                               │
  ├─► Apply maps                            │                               │
  ├─► Apply fog                             │                               │
  ├─► Apply regions                         │                               │
  ├─► Apply lights                          │                               │
  └─► Apply roles                           │                               │
```

### RPC Command Flow

```
┌──────────────┐                      ┌──────────┐                   ┌──────────────┐
│     DM       │  rpc_set_ui_mode     │  SERVER  │  ui_mode_changed  │   PLAYER     │
│  (Client A)  │ ──────────────────►  │  (Relay) │ ───────────────►  │  (Client B)  │
└──────────────┘                      └──────────┘                   └──────┬───────┘
                                                                            │
  syncManager.rpcSetUiMode('play')                                          │
       │                                                                    │
       ▼                                                                    ▼
  1. Generate messageId                                             handleUiModeChanged()
  2. Build SetUiModePayload                                         1. Check targetUserId
  3. socket.emit('rpc_set_ui_mode', payload)                        2. Check deduplication
                                                                    3. Check not own msg
                                                                    4. Apply: uiModeStore
                                                                       .setModeFromRemote()
```
