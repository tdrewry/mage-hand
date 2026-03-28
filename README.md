# Mage Hand — Virtual Tabletop

A browser-based Virtual Tabletop (VTT) for D&D 5e and compatible systems, built with React, Pixi.js, and a layered real-time networking stack.

---

## Architecture Overview

Mage Hand uses a **three-layer networking model**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Jazz CoValues (Durable State / CRDT)             │
│  Tokens, maps, regions, effects, textures, fog               │
│  Transport: jazz-tools → ws://localhost:4200 (Jazz Sync)     │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — JazzTransport (Presence / Session Protocol)       │
│  Synthesizes NetManager welcome/presence events from CRDT    │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — WebRTCTransport (Ephemeral / Low-Latency P2P)     │
│  Cursors, drag previews, pings, chat — signaled via Jazz     │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `src/lib/jazz/schema.ts` | CoMap/CoList/CoFeed definitions for all synced state |
| `src/lib/jazz/provider.tsx` | `JazzReactProvider` wrapper; connects to sync server |
| `src/lib/jazz/bridge.ts` | Bidirectional Zustand ↔ Jazz CoValue sync |
| `src/lib/jazz/session.ts` | Create/join/leave session helpers |
| `src/lib/jazz/textureSync.ts` | Texture binary sync via Jazz `FileStream` |
| `src/lib/net/NetManager.ts` | Singleton managing transport lifecycle + event routing |
| `src/lib/net/OpBridge.ts` | Translates EngineOps ↔ Zustand store mutations |
| `src/lib/net/transports/JazzTransport.ts` | Shim transport; maps Jazz CoValue events to NetManager protocol |
| `src/lib/net/transports/WebRTCTransport.ts` | P2P ephemeral channel; signaling via Jazz `signalingRoom` CoMap |
| `src/lib/net/ephemeral/` | EphemeralBus handlers (cursors, drags, pings, chat) |
| `networking/server-local/` | Optional LAN room server (WebSocket, JSON protocol) |

---

## Development Setup

### Prerequisites

- **Node.js** 18+ (or **Bun** — a `bun.lock` is present)
- **npm** (or `bun`)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Jazz sync server

Jazz requires a local sync server to relay CoValue updates between browser tabs/clients during development.

```bash
# Terminal 1 — Jazz sync server (ws://localhost:4200)
npm run dev:jazz
```

> This runs `npx jazz-run sync --port 4200`. The sync server uses IndexedDB for durable storage and will keep session state across page reloads on the same machine.

### 3. Start the Vite dev server

```bash
# Terminal 2 — Vite dev server (http://localhost:8080)
npm run dev
```

The app is now available at **http://localhost:8080**.

---

## Starting a Session (DM flow)

1. Open the app and click **Menu → Network**
2. Select **"Create Session"** — this creates a Jazz `JazzSessionRoot` CoValue and copies the **Session ID** (`co_z...`) to your clipboard
3. Share the Session ID with players
4. Players open the app, go to **Menu → Network → Join Session**, paste the ID and click Join

On join, the system:
- Loads the `JazzSessionRoot` CoValue via `session.ts`
- Pulls all durable state (tokens, maps, regions, fog blobs, textures) into Zustand stores
- Starts the bidirectional `bridge.ts` sync loop
- Registers presence in the `connectedUsers` Jazz CoMap
- Opens a WebRTC data channel (signaled via the `signalingRoom` Jazz CoMap) for low-latency ephemeral messages

---

## Networking Deep Dive

### Durable State (Jazz CoValues)

All authoritative game state is stored in Jazz `CoMap`/`CoList`/`CoFeed` structures defined in `schema.ts`. The root object is a `JazzSessionRoot` that holds:

- **`tokens`** — `JazzTokenList` (positions, HP, AC, visibility, entity sheets)
- **`maps`** / **`regions`** / **`mapObjects`** — map layer data
- **`effects`** — placed spell/ability templates + custom definitions
- **`blobs`** — generic Durable Object state snapshots (combat, initiative, etc.)
- **`textures`** — `JazzTextureList` of `FileStream` references for image data
- **`illuminationSources`** — light source configs
- **`connectedUsers`** — presence CoMap (userId → JSON status)
- **`signalingRoom`** — WebRTC signaling exchange CoMap (peerId → JSON SDP/ICE)

The `bridge.ts` module watches Zustand store changes and writes them to Jazz CoValues (outbound), and subscribes to CoValue mutations to hydrate Zustand (inbound). Echo prevention is managed via an `_fromJazz` flag.

### Ephemeral State (WebRTC P2P)

Cursor movement, token drag previews, pings, and chat are **ephemeral** — they flow over WebRTC data channels (unreliable, unordered) instead of Jazz to avoid polluting the CRDT log.

The **WebRTCTransport** uses a Star Topology:
- The **DM/host** maintains one `RTCPeerConnection` + data channel per connected player
- **Players** maintain a single connection back to the host
- The host acts as a message router, forwarding player ephemeral messages to all other clients
- Signaling (SDP offer/answer, ICE candidates) is exchanged through the `signalingRoom` Jazz CoMap

The `EphemeralBus` (`src/lib/net/ephemeral/`) receives all ephemeral messages and dispatches them to typed handlers for cursors, drags, pings, and chat.

### Session Code Resolution

Short session codes (e.g. `"ABCD12"`) can optionally be resolved to full CoValue IDs via the `JazzSessionRegistry` CoMap (`sessionCodeResolver.ts`). When a full `co_z...` ID is pasted directly, resolution is bypassed.

---

## Optional: LAN Room Server

For play without Internet access or as a fallback transport, a local WebSocket room server is included.

### Setup

```bash
cd networking/server-local
npm install
npm run start
```

By default: `ws://localhost:3001`, DM password: `dm`

```bash
# Override port and DM password
PORT=4001 DM_PASSWORD=mysecret npm run start
```

### Connect

In the app's **Network** panel, select **"LAN Server"** mode and enter:
- **Server URL**: `ws://<your-lan-ip>:3001`
- **Session Code**: any string (creates or joins that room)
- **Username**: any
- **Password**: `dm` to gain the `dm` role (full permissions)

> The LAN server keeps state in memory and drops it when all clients disconnect. It is intended for development and local LAN play — not hardened for internet exposure.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_JAZZ_SYNC_URL` | `ws://localhost:4200` | Jazz sync server WebSocket URL |

Create a `.env` file in the project root to override:

```
VITE_JAZZ_SYNC_URL=wss://your-jazz-server.example.com
```

The sync server URL can also be overridden at runtime via **Menu → Network → Advanced → Custom Jazz URL**.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server on port 8080 |
| `npm run dev:jazz` | Start Jazz sync server on `ws://localhost:4200` |
| `npm run build` | Production build (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run desktop` | Launch the Tauri desktop app (requires Rust toolchain) |
| `npm run lint` | Run ESLint |

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `jazz-tools` | CRDT CoValues, CoList, CoMap, CoFeed, FileStream |
| `jazz-nodejs` | Jazz sync server runtime (`npm run dev:jazz`) |
| `pixi.js` | 2D map canvas renderer |
| `zustand` | Client-side state management |
| `dexie` | IndexedDB wrapper for local persistence |
| `react-router-dom` | Client-side routing |
| `@radix-ui/*` | Accessible UI primitives |
| `fabric` | Image/canvas manipulation |

---

## Deployment

### GitHub Pages (built-in)

The Vite config sets `base: "/mage-hand/"` in production mode. Push to `main` and GitHub Actions will build and deploy to Pages automatically.

### Self-Hosted

1. Build: `npm run build`
2. Serve `dist/` from any static host (Nginx, Caddy, etc.)
3. Point `VITE_JAZZ_SYNC_URL` to your own Jazz sync server instance

### Jazz Sync Server (production)

For production, replace the local `jazz-run sync` with a managed Jazz Cloud instance or a self-hosted deployment. See [jazz.tools](https://jazz.tools) for hosting options.

> The app degrades gracefully if the Jazz sync server is unreachable — a toast notification is shown and the app continues in offline-first mode. Changes will sync when connectivity is restored.

---

## License

[MIT](./LICENSE)
