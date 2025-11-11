Excellent! Thank you for the detailed answers. Now I have a clear picture of what needs to be built. Let me examine the current codebase structure to create a comprehensive multiplayer architecture plan.

Perfect! Now I have a complete understanding of your architecture. Let me create a comprehensive multiplayer implementation plan using Socket.io.

# Multiplayer Implementation Plan - Socket.io Architecture

## Overview

Implement real-time multiplayer functionality using a self-hosted Socket.io server. The client will maintain local state via Zustand stores and sync changes through Socket.io events. No database required - all state lives in memory on the server and is persisted via client-side export/import.

---

## Architecture Diagram

graph TB

    subgraph "Client A (DM)"

        CA[React App]

        CS1[Zustand Stores]

        SM1[Sync Manager]

        SIO1[Socket.io Client]

    end

    subgraph "Client B (Player)"

        CB[React App]

        CS2[Zustand Stores]

        SM2[Sync Manager]

        SIO2[Socket.io Client]

    end

    subgraph "Socket.io Server"

        SS[Socket.io Server]

        SR[Session Registry]

        SM[Session Manager]

    end

    CA --> CS1

    CS1 --> SM1

    SM1 --> SIO1

    SIO1 <-->|WebSocket| SS

    CB --> CS2

    CS2 --> SM2

    SM2 --> SIO2

    SIO2 <-->|WebSocket| SS

    SS --> SR

    SS --> SM

    style SS fill:#4f46e5,color:#fff

    style SR fill:#7c3aed,color:#fff

    style SM fill:#7c3aed,color:#fff

---

## Phase 1: Core Infrastructure

### 1.1 Create Sync Manager (`src/lib/syncManager.ts`)

**Purpose**: Central hub for coordinating state synchronization between local stores and Socket.io

**Key Responsibilities**:

- Connect/disconnect from Socket.io server

- Subscribe to store changes

- Emit changes to server

- Apply incoming changes from server

- Handle conflict resolution (last-write-wins with timestamp)

- Manage sync state (connected/disconnected/syncing)

**Core Features**:

```typescript

interface SyncManager {

  // Connection management

  connect(sessionCode: string, password?: string, username?: string): Promise

  disconnect(): void

  // State synchronization

  syncState(storeType: string, action: string, payload: any): void

  applyRemoteChange(storeType: string, action: string, payload: any): void

  // Session management

  getCurrentSession(): SessionInfo | null

  getConnectedUsers(): User[]

  // Permissions

  canPerformAction(action: string): boolean

}

```

### 1.2 Create Socket.io Client Wrapper (`src/lib/socketClient.ts`)

**Purpose**: Thin wrapper around Socket.io client with reconnection logic

**Features**:

- Auto-reconnection with exponential backoff

- Connection state management

- Event type definitions

- Error handling and logging

### 1.3 Create Multiplayer Store (`src/stores/multiplayerStore.ts`)

**Purpose**: Manage multiplayer-specific state

**State**:

```typescript

interface MultiplayerState {

  // Connection

  isConnected: boolean

  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'

  serverUrl: string

  // Session

  currentSession: SessionInfo | null

  connectedUsers: User[]

  // User

  currentUser: User | null

  // Sync

  isSyncing: boolean

  lastSyncTimestamp: number

  syncErrors: string[]

  // Actions

  setServerUrl(url: string): void

  connect(sessionCode: string, password?: string, username?: string): Promise

  disconnect(): void

  updateUserList(users: User[]): void

}

```

---

## Phase 2: Store Integration

### 2.1 Add Sync Hooks to Existing Stores

**Modify**: 

- `sessionStore.ts` - tokens, players, visibility settings

- `initiativeStore.ts` - initiative order, combat state, turn tracking

- `mapStore.ts` - map changes (if needed)

- `fogStore.ts` - fog reveals (data only, clients render)

- `roleStore.ts` - role assignments

**Pattern**: Add middleware to detect changes and call `syncManager.syncState()`

**Example for sessionStore.ts**:

```typescript

// Add after each action that modifies state

const syncableUpdateTokenPosition = (tokenId: string, x: number, y: number) => {

  set((state) => ({

    tokens: state.tokens.map((token) =>

      token.id === tokenId ? { ...token, x, y } : token

    ),

  }));

  // Sync to server

  syncManager.syncState('session', 'updateTokenPosition', { tokenId, x, y });

};

```

### 2.2 Create Sync Middleware

**Purpose**: Automatic sync decorator for store actions

**File**: `src/lib/syncMiddleware.ts`

**Usage**:

```typescript

const withSync = (storeType: string, actionName: string) => {

  return (fn: Function) => {

    return (...args: any[]) => {

      const result = fn(...args);

      syncManager.syncState(storeType, actionName, args);

      return result;

    };

  };

};

```

---

## Phase 3: Session Management

### 3.1 Session Join Flow

sequenceDiagram

    participant Client

    participant Server

    participant Session

    Client->>Server: join_session(code, password?, username?)

    Server->>Server: Validate session code

    Server->>Server: Check password (if set)

    Server->>Session: Add user to session

    Server->>Client: session_joined(sessionInfo, users)

    Server->>Session: Broadcast user_joined(newUser)

    Session->>Client: Receive user_joined

    Server->>Client: full_state_sync(completeState)

    Client->>Client: Load state into stores

### 3.2 Session Component (`src/components/SessionManager.tsx`)

**Purpose**: UI for creating/joining sessions

**Features**:

- Session code generator (6-character alphanumeric)

- Optional password input

- Username input (with stored preference)

- Copy session code to clipboard

- Show connection status

- List of connected users

- Server URL configuration (localStorage)

### 3.3 Connected Users Panel (`src/components/ConnectedUsersPanel.tsx`)

**Purpose**: Show who's connected and their roles

**Features**:

- List of users with their assigned roles

- Role indicators (color-coded)

- Connection status (latency indicator)

- Kick user button (DM only)

---

## Phase 4: Real-Time Synchronization

### 4.1 Event Types

**Create**: `src/types/multiplayerEvents.ts`

**Server → Client Events**:

```typescript

// Session events

'session_joined' - User successfully joined

'session_left' - User left session

'user_joined' - Another user joined

'user_left' - Another user left

'full_state_sync' - Complete state snapshot

'session_error' - Error message

// State sync events

'token_updated' - Token position/state changed

'token_added' - New token added

'token_removed' - Token removed

'initiative_updated' - Initiative order changed

'combat_state_changed' - Combat started/ended

'turn_changed' - Turn advanced

'fog_updated' - Fog data changed

'role_assigned' - Role assigned to user

'map_changed' - Map data changed

// User events

'user_list_updated' - Connected users list

'user_role_changed' - User's role updated

```

**Client → Server Events**:

```typescript

// Session

'join_session' - Join a session

'leave_session' - Leave session

'create_session' - Create new session

// State changes

'sync_token' - Token change

'sync_initiative' - Initiative change

'sync_combat' - Combat state change

'sync_fog' - Fog data change

'sync_role' - Role assignment

// Actions

'request_full_sync' - Request complete state

'kick_user' - Remove user (DM only)

```

### 4.2 Conflict Resolution

**Strategy**: Last-Write-Wins with timestamp

**Implementation**:

```typescript

interface SyncedAction {

  storeType: string;

  action: string;

  payload: any;

  timestamp: number;

  userId: string;

}

```

- Each action includes timestamp and user ID

- Client compares incoming timestamp with local

- If incoming is newer, apply change

- If local is newer, ignore (server will broadcast our change)

### 4.3 Throttling

**Token Movement**: Throttle position updates to 10 per second (100ms)

**Other Actions**: No throttling (initiative, combat state, etc.)

**Implementation**:

```typescript

const throttledSyncTokenPosition = throttle((tokenId, x, y) => {

  syncManager.syncState('session', 'updateTokenPosition', { tokenId, x, y });

}, 100);

```

---

## Phase 5: Permission Integration

### 5.1 Sync Manager Permission Checks

**Use existing role permissions** from `roleStore.ts`

**Before syncing action**:

```typescript

syncState(storeType: string, action: string, payload: any) {

  // Check permission

  const userRole = getCurrentUserRole();

  const hasPermission = checkActionPermission(action, userRole);

  if (!hasPermission) {

    console.warn('User lacks permission for action:', action);

    return;

  }

  // Proceed with sync

  this.socket.emit(`sync_${storeType}`, { action, payload, timestamp: Date.now() });

}

```

### 5.2 Server-Side Validation

**Server must validate permissions** before broadcasting changes

**Required**: Session state includes user roles for validation

---

## Phase 6: Save/Load System

### 6.1 Export Session (DM Only)

**Button**: In Session Manager card

**Functionality**:

```typescript

const exportSession = () => {

  // Use existing projectSerializer

  const projectData = serializeProject();

  const blob = new Blob([JSON.stringify(projectData, null, 2)], { 

    type: 'application/json' 

  });

  downloadBlob(blob, `session-${sessionId}-${timestamp}.d20pro`);

};

```

### 6.2 Import Session (DM Only)

**Button**: In Session Manager card

**Functionality**:

```typescript

const importSession = (file: File) => {

  const reader = new FileReader();

  reader.onload = (e) => {

    const projectData = JSON.parse(e.target.result);

    // Load into stores

    deserializeProject(projectData);

    // Broadcast full state to all clients

    syncManager.broadcastFullState();

  };

  reader.readAsText(file);

};

```

### 6.3 Auto-Save (Optional)

**Feature**: Periodic auto-save to localStorage

**Trigger**: Every 5 minutes or on major state changes

**Storage**: Use existing session history system

---

## Phase 7: UI Components

### 7.1 Connection Indicator

**Location**: Top-right corner (z-index 50000+)

**States**:

- 🟢 Connected (green)

- 🟡 Connecting (yellow)

- 🔴 Disconnected (red)

- ⚠️ Error (red with icon)

**Show**: Latency, session code, connected users count

### 7.2 Session Setup Modal

**Trigger**: On app load if not in session

**Tabs**:

1\. **Create Session**

   - Generate session code

   - Optional password

   - Username input

   - Server URL (default: localhost:3000)

   - "Create & Join" button

2\. **Join Session**

   - Session code input

   - Password input (if required)

   - Username input

   - Server URL

   - "Join Session" button

### 7.3 Update Initiative Tracker Card

**Add sync indicator**: Show when initiative is being synced

**Add optimistic updates**: Update UI immediately, rollback if sync fails

### 7.4 Add Synced Card Type

**Extend**: `src/types/cardTypes.ts`

```typescript

export type CardType = 

  | 'menu' 

  | 'tools' 

  | 'roster' 

  | 'map-manager'

  | 'initiative-tracker'  // Mark as synced

  | 'synced-custom';      // New category for future synced cards

```

**Mark InitiativeTrackerCard** as requiring sync connection

---

## Phase 8: Testing & Polish

### 8.1 Offline Mode

**Fallback**: If not connected, work in local-only mode

**Warning**: Show banner "Working Offline - Changes Not Synced"

### 8.2 Reconnection Logic

**On disconnect**:

- Show "Reconnecting..." indicator

- Attempt reconnection every 2s (exponential backoff to 30s)

- On reconnect, request full state sync

- Apply differences to local state

### 8.3 Error Handling

**Scenarios**:

- Session not found → Show error, return to setup

- Invalid password → Show error, allow retry

- Permission denied → Show toast notification

- Connection lost → Show reconnecting indicator

- Sync conflict → Log warning, apply server state

---

## Socket.io Server Requirements

### Server Features Needed

1\. **Session Management**

   - Create session with code + optional password

   - Join session with code + password validation

   - Track connected users per session

   - Remove sessions when empty (optional: persist for 24hrs)

2\. **State Broadcasting**

   - Receive state changes from clients

   - Validate user permissions

   - Broadcast to all session members

   - Handle full state sync requests

3\. **User Management**

   - Track user connections

   - Handle disconnections/reconnections

   - Assign socket IDs to user identities

   - Broadcast user join/leave events

4\. **Session State**

   - Store session metadata (code, password hash, created timestamp)

   - Store user list per session (username, role IDs, socket ID)

   - Store last known state per session (for late joiners)

   - Optional: Persist sessions to disk/database

### Server Event Handlers

**Connection Events**:

```javascript

io.on('connection', (socket) => {

  socket.on('create_session', handleCreateSession);

  socket.on('join_session', handleJoinSession);

  socket.on('leave_session', handleLeaveSession);

  socket.on('disconnect', handleDisconnect);

});

```

**Sync Events**:

```javascript

socket.on('sync_session', (data) => {

  // Validate permission

  // Broadcast to session room

  io.to(sessionCode).emit('token_updated', data);

});

socket.on('sync_initiative', (data) => {

  io.to(sessionCode).emit('initiative_updated', data);

});

socket.on('request_full_sync', () => {

  socket.emit('full_state_sync', sessions[sessionCode].state);

});

```

**Admin Events**:

```javascript

socket.on('kick_user', (userId) => {

  // Validate user is DM

  // Disconnect target user

  const targetSocket = findUserSocket(userId);

  targetSocket.disconnect();

});

```

### Server Data Structures

**Session Registry**:

```javascript

{

  'ABC123': {

    code: 'ABC123',

    passwordHash: 'bcrypt_hash',  // null if no password

    createdAt: timestamp,

    users: [

      { 

        socketId: 'socket_id', 

        userId: 'user_id',

        username: 'Player 1',

        roleIds: ['player'],

        connectedAt: timestamp 

      }

    ],

    state: {

      tokens: [...],

      initiative: {...},

      // Last known state for late joiners

    }

  }

}

```

### Server Configuration

**Environment Variables**:

```

PORT=3000

CORS_ORIGIN=http://localhost:5173

SESSION_TIMEOUT_MS=86400000  # 24 hours

MAX_USERS_PER_SESSION=20

LOG_LEVEL=info

```

**Dependencies**:

```json

{

  "socket.io": "^4.7.0",

  "bcrypt": "^5.1.1",

  "dotenv": "^16.4.0"

}

```

### Server Deployment Options

1\. **Local Development**: `node server.js` on localhost:3000

2\. **Self-Hosted**: Deploy to any Node.js hosting (VPS, home server)

3\. **Docker**: Provide Dockerfile for containerized deployment

4\. **Cloud Functions**: Can adapt to Cloudflare Workers, AWS Lambda, etc.

---

## Implementation Order

1\. ✅ **Phase 1**: Core infrastructure (syncManager, socketClient, multiplayerStore)

2\. ✅ **Phase 2**: Store integration (add sync hooks to session/initiative stores)

3\. ✅ **Phase 3**: Session management (UI for create/join, session manager)

4\. ✅ **Phase 4**: Real-time sync (event handlers, conflict resolution)

5\. ✅ **Phase 5**: Permission integration (role-based action validation)

6\. ✅ **Phase 6**: Save/load system (export/import with sync)

7\. ✅ **Phase 7**: UI components (connection indicator, session modal, updates)

8\. ✅ **Phase 8**: Testing & polish (offline mode, reconnection, error handling)

---

## Technical Considerations

### Performance

- **Throttle token movements**: 100ms minimum between position updates

- **Batch updates**: Group multiple changes in same tick

- **Selective sync**: Only sync changed fields, not entire objects

- **Compression**: Consider gzip for large state syncs

### Security

- **Password hashing**: Use bcrypt on server for session passwords

- **Rate limiting**: Prevent spam/abuse on server

- **Permission validation**: Always validate on server, not just client

- **Input sanitization**: Sanitize usernames, session codes

### Scalability

- **Memory management**: Clear old sessions after timeout

- **Connection limits**: Max users per session (default: 20)

- **Graceful degradation**: Handle 100+ concurrent sessions

### User Experience

- **Optimistic updates**: Update UI immediately, rollback on failure

- **Loading states**: Show when syncing large state changes

- **Toast notifications**: Inform users of sync events (user joined/left)

- **Latency indicator**: Show ping to server

---

## File Structure

**New Files**:

```

src/

├── lib/

│   ├── syncManager.ts          # Core sync orchestration

│   ├── socketClient.ts         # Socket.io client wrapper

│   ├── syncMiddleware.ts       # Zustand sync middleware

│   └── throttle.ts             # Throttle utility

├── stores/

│   └── multiplayerStore.ts     # Multiplayer state

├── types/

│   └── multiplayerEvents.ts    # Event type definitions

├── components/

│   ├── SessionManager.tsx      # Session create/join UI

│   ├── ConnectedUsersPanel.tsx # User list panel

│   ├── ConnectionIndicator.tsx # Status indicator

│   └── SessionSetupModal.tsx   # Initial setup modal

└── hooks/

    └── useMultiplayer.ts       # Multiplayer hook

```

**Modified Files**:

```

src/

├── stores/

│   ├── sessionStore.ts         # Add sync hooks

│   └── initiativeStore.ts      # Add sync hooks

├── types/

│   └── cardTypes.ts            # Add synced card type

└── components/

    └── cards/

        └── InitiativeTrackerCard.tsx  # Add sync indicator

```

---

## Success Criteria

✅ Multiple clients can connect to the same session

✅ Token movements sync in real-time with <200ms latency

✅ Initiative tracker stays synchronized across all clients

✅ Role permissions prevent unauthorized actions

✅ DM can export/import full session state

✅ Graceful handling of disconnections and reconnections

✅ Offline mode works without server connection

✅ No data loss on network interruptions

✅ Clean error messages for common issues

Implement Phase 1: Core Infrastructure