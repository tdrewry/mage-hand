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
