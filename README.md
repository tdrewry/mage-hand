# Tabletop Multiplayer Server

Socket.io server for real-time multiplayer tabletop sessions.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment (optional):
Create a `.env` file:
```
PORT=3001
CLIENT_ORIGIN=http://localhost:8080
```

3. Run the server:
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## Architecture

### Files
- `index.js` - Main server entry point, Socket.io setup
- `sessionManager.js` - Session and user state management
- `eventHandlers.js` - Socket event handlers for all client events

### Session Management
Sessions are stored in memory with:
- Unique session codes (6-character alphanumeric)
- Optional password protection
- User tracking with roles
- Game state (tokens, initiative, fog)

### API Events

#### Client → Server
- `create_session` - Create new session
- `join_session` - Join existing session
- `leave_session` - Leave current session
- `sync_token` - Sync token changes
- `sync_initiative` - Sync initiative/combat
- `sync_map` - Sync map changes (add/update/remove/reorder)
- `sync_fog` - Sync fog of war
- `sync_role` - Assign/update user roles
- `request_full_sync` - Request full state
- `kick_user` - Remove user (DM only)

#### Server → Client
- `session_created` - Session created confirmation
- `session_joined` - Joined session confirmation
- `session_error` - Error occurred
- `user_joined` - Another user joined
- `user_left` - User disconnected
- `full_state_sync` - Complete state snapshot
- `token_added/updated/removed` - Token changes
- `initiative_updated` - Initiative changes
- `combat_state_changed` - Combat status
- `map_updated` - Map changes (add/update/remove/reorder)
- `fog_updated` - Fog changes
- `user_list_updated` - User list changed
- `user_role_changed` - User role updated

## Health Check

GET `/health` returns server status:
```json
{
  "status": "ok",
  "sessions": 3,
  "connections": 12
}
```

## State Management

All game state is stored in memory per session:
```javascript
{
  tokens: [],
  initiative: {
    isInCombat: false,
    currentTurnIndex: -1,
    roundNumber: 0,
    initiativeOrder: []
  },
  maps: [],
  fog: null,
  roles: []
}
```

Sessions are automatically cleaned up when all users disconnect.

## Security Notes

- Password validation for sessions
- Role-based permission checks (DM actions)
- Socket ID tracking for user management
- Automatic cleanup on disconnect

## Deployment

For production deployment:
1. Set `CLIENT_ORIGIN` to your client app URL
2. Use a process manager (PM2, systemd)
3. Configure reverse proxy (nginx)
4. Enable HTTPS/WSS

Example PM2:
```bash
pm2 start index.js --name tabletop-server
pm2 save
pm2 startup
```

========================================
SETUP INSTRUCTIONS
========================================

1. Download this file and create a new folder called "tabletop-server"

2. Create each file listed above in that folder with the exact content

3. Run these commands:
   cd tabletop-server
   npm install
   npm start

4. The server will run on http://localhost:3001

5. Update your Lovable app's multiplayerStore.ts to set:
   serverUrl: 'http://localhost:3001'

6. For production, deploy to Railway, Render, or Fly.io

---

## Jazz CRDT Transport (Dev Setup)

Jazz is an **optional** alternative transport for durable state sync (tokens, maps, etc.) using CRDTs. The default WebSocket/OpBridge transport always works without it.

### Prerequisites

Jazz uses a self-hosted sync server for local development — no cloud account needed.

### Running

Open **two terminals**:

```bash
# Terminal 1 — Jazz sync server
npm run dev:jazz
# Starts sync server on ws://localhost:4200

# Terminal 2 — Vite dev server
npm run dev
```

### Two-Peer Token Sync

1. Open two browser tabs at `http://localhost:5173`
2. In **Tab 1**: Open the **Menu → Network Demo** card → scroll to **Jazz Transport (CRDT)** → click **Create Session** → copy the session ID
3. In **Tab 2**: Open **Network Demo** → paste the session ID → click **Join**
4. Create, move, or delete tokens in either tab — changes sync in real-time via CRDT

### How It Works

```
Tab A (Zustand store) ←→ Jazz Bridge ←→ Jazz CoValues ←→ Sync Server ←→ Jazz CoValues ←→ Jazz Bridge ←→ Tab B (Zustand store)
```

- The bridge in `src/lib/jazz/bridge.ts` watches Zustand for local changes and pushes to Jazz CoValues
- It also subscribes to CoValue updates from the sync server and hydrates Zustand
- Echo prevention (`_fromJazz` flag) stops infinite loops
- EphemeralBus (cursors, drags, pings) runs independently on the existing WebSocket — unaffected by transport choice

### Files

| File | Purpose |
|------|---------|
| `src/lib/jazz/schema.ts` | CoMap/CoList definitions |
| `src/lib/jazz/provider.tsx` | JazzReactProvider wrapper |
| `src/lib/jazz/bridge.ts` | Bidirectional Zustand ↔ Jazz sync |
| `src/lib/jazz/session.ts` | Create/join/leave session helpers |
