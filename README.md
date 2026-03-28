# Mage Hand — Virtual Tabletop

A browser-based Virtual Tabletop (VTT) for RPGS, preconfigured for D&D 5e-like systems, built with React, Pixi.js, and a layered real-time networking stack.

---

## Architecture Overview

Mage Hand uses a **three-layer networking model**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Jazz CoValues (Durable State / CRDT)             │
│  Tokens, maps, regions, effects, textures, fog              │
│  Transport: jazz-tools → ws://localhost:4200 (Jazz Sync)    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — JazzTransport (Presence / Session Protocol)      │
│  Synthesizes NetManager welcome/presence events from CRDT   │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — WebRTCTransport (Ephemeral / Low-Latency P2P)    │
│  Cursors, drag previews, pings, chat — signaled via Jazz    │
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

## Linking a Personal jazz.tools Account

By default the app uses **Demo Auth** (`useDemoAuth`) which creates a temporary local-only Jazz identity. To persist your identity and data across devices and browsers, link a personal [jazz.tools](https://jazz.tools) account.

### 1. Register an account

Go to **[jazz.tools](https://jazz.tools)** and create a free account. You will receive a **Jazz Cloud sync URL** of the form:

```
wss://cloud.jazz.tools/?key=YOUR_API_KEY
```

### 2. Set the sync URL

There are two ways to point Mage Hand at your Jazz Cloud endpoint:

**Option A — Environment variable (recommended):**

Create a `.env` file in the project root (copy from `.env.example` if it exists):

```
VITE_JAZZ_SYNC_URL=wss://cloud.jazz.tools/?key=YOUR_API_KEY
```

Then restart the dev server (`npm run dev`). The provider in `src/lib/jazz/provider.tsx` reads this env var as its default peer URL.

**Option B — Runtime override (no rebuild needed):**

Open **Menu → Network → Advanced → Custom Jazz URL** inside the running app and paste your cloud URL there. This is stored in the multiplayer store and takes precedence over the env var.

### 3. Account identity

Jazz identities are tied to the sync server that created them. If you switch from a local server (`ws://localhost:4200`) to a Jazz Cloud URL:

- Your previous local sessions will **not** be visible under the cloud account — local CoValues were created under a different peer
- Start a fresh session after switching to create CoValues owned by your cloud identity
- To migrate existing session data, export it via **Menu → Storage → Export Session** before switching

### Notes

- The `JazzReactProvider` in `src/lib/jazz/provider.tsx` currently uses `useDemoAuth`. To replace it with a proper Jazz account (passphrase / OAuth), follow the [jazz-tools auth docs](https://jazz.tools/docs/auth) and swap `useDemoAuth` for the appropriate auth method in `provider.tsx`
- The `AuthWrapper` component in `provider.tsx` renders `DemoAuthBasicUI` when no account is loaded — replace this with your own UI if using a custom auth flow

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

## Desktop Build (Tauri)

Mage Hand ships a [Tauri](https://tauri.app) wrapper that bundles the app as a native desktop binary (Windows `.msi`/`.exe`, macOS `.dmg`/`.app`, Linux `.deb`/`.AppImage`). The desktop build includes an embedded `jazz-sync-server` binary so users get a self-contained VTT with no external dependencies.

### Prerequisites

1. **Rust toolchain** — install via [rustup](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Tauri CLI** (already in devDependencies):
   ```bash
   npm install   # installs @tauri-apps/cli
   ```
3. Platform-specific requirements — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/):
   - **Windows**: Microsoft C++ Build Tools or Visual Studio
   - **macOS**: Xcode Command Line Tools
   - **Linux**: `libwebkit2gtk`, `libssl`, etc.

### Development (hot-reload)

```bash
npm run desktop
# Alias for: tauri dev
```

This starts the Vite dev server on `http://localhost:8080` and opens the Tauri window pointed at it. The Tauri `devUrl` in `src-tauri/tauri.conf.json` is `http://localhost:5173` — if you change the Vite port, update this field to match.

> **Note:** The `base` path in `vite.config.ts` is `"/"` in development mode, which is correct for Tauri's `devUrl`.

### Production build

```bash
npm run build          # builds Vite → dist/
npm run tauri build    # packages dist/ into a native binary
```

Tauri reads `src-tauri/tauri.conf.json → build.frontendDist` (`../dist`) to bundle the Vite output. The production build sets `base: "/mage-hand/"` via `vite.config.ts`; **this base path must be `"/"` for desktop use**, because Tauri loads the app from the filesystem, not a web server sub-path.

**To build for desktop, change `vite.config.ts` before running `npm run tauri build`:**

```diff
-  base: mode === "production" ? "/mage-hand/" : "/",
+  base: "/",
```

Or set the mode explicitly:

```bash
# Build with base "/" for Tauri (bypasses the production mode check)
VITE_BASE_PATH=/ npx vite build
```

Alternatively, add a dedicated Tauri build script to `package.json`:

```json
"build:desktop": "vite build --base / && tauri build"
```

### Key config files

| File | Relevant Setting |
|------|-----------------|
| `src-tauri/tauri.conf.json` | `build.devUrl` — must match the Vite dev server port |
| `src-tauri/tauri.conf.json` | `build.frontendDist` — path to Vite output (`../dist`) |
| `src-tauri/tauri.conf.json` | `bundle.externalBin` — bundles `bin/jazz-sync-server` into the installer |
| `vite.config.ts` | `base` — **must be `"/"` for desktop builds** |

### Embedded Jazz sync server

The Tauri bundle includes a pre-built `jazz-sync-server` binary at `src-tauri/bin/` (platform-specific suffixes like `jazz-sync-server-x86_64-pc-windows-msvc.exe`). The app spawns it on startup via the Tauri sidecar API so desktop users don't need to run a separate sync process.

---

## GitHub Pages Hosting

The repository includes a GitHub Actions workflow that automatically builds and deploys to GitHub Pages on every push to `main`.

### How it works

1. Push to `main` triggers `.github/workflows/deploy-pages.yml`
2. The workflow runs `npm install && npm run build`
3. The `dist/` directory is published to the `github-pages` environment

### Path configuration

GitHub Pages serves the app from `https://<username>.github.io/<repo-name>/`. The app must be aware of this sub-path prefix.

#### Files that must be updated when changing the repo name or Pages path:

| File | Setting | Current Value | Notes |
|------|---------|---------------|-------|
| `vite.config.ts` | `base` (production) | `"/mage-hand/"` | Must match the GitHub repo name exactly — e.g. if your repo is `my-vtt`, set `"/my-vtt/"` |
| `src-tauri/tauri.conf.json` | `build.devUrl` | `"http://localhost:5173"` | **Not** needed for Pages; only affects the Tauri desktop dev build |

**`vite.config.ts` — the critical file:**

```ts
base: mode === "production" ? "/mage-hand/" : "/",
//                            ^^^^^^^^^^^^
//  Change this to match your GitHub repo name
//  e.g. "/my-vtt/" if hosted at github.com/you/my-vtt
```

> The `/` at both the start and end of the path are **required** by Vite.

#### If you are hosting on a custom domain (not a sub-path):

Set `base: "/"` unconditionally — the sub-path prefix is only needed for the default `*.github.io/<repo>` URL:

```ts
base: "/",
```

Also add a `CNAME` file to the `public/` directory containing your domain:

```
# public/CNAME
vtt.example.com
```

### Enabling GitHub Pages

1. Push the repo to GitHub
2. Go to **Settings → Pages**
3. Set **Source** to **"GitHub Actions"**
4. Push to `main` — the workflow will deploy automatically

The live URL will be shown under **Settings → Pages** once the first deployment completes.

### Jazz sync server for Pages deployments

The self-hosted `jazz-run sync` server only runs locally. For a Pages deployment accessible from multiple machines, you need a cloud-accessible sync server:

- **Jazz Cloud** (recommended): Register at [jazz.tools](https://jazz.tools), get your `wss://cloud.jazz.tools/?key=...` URL, and set it as a GitHub Actions secret:
  ```
  # In GitHub repo → Settings → Secrets → Actions
  VITE_JAZZ_SYNC_URL = wss://cloud.jazz.tools/?key=YOUR_API_KEY
  ```
  Then update `.github/workflows/deploy-pages.yml` to pass it through:
  ```yaml
  - run: npm run build
    env:
      VITE_JAZZ_SYNC_URL: ${{ secrets.VITE_JAZZ_SYNC_URL }}
  ```
- **Self-hosted Jazz Server**: Deploy `jazz-run sync` on a VPS with a domain and TLS, then set `VITE_JAZZ_SYNC_URL=wss://your-server.example.com`.
- **Runtime override**: Users can override the sync URL at runtime via **Menu → Network → Advanced → Custom Jazz URL** — useful when you don't control the build.

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
| `npm run desktop` | Launch the Tauri desktop app in dev mode (requires Rust toolchain) |
| `npm run tauri build` | Package the desktop app as a native installer |
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
| `@tauri-apps/cli` | Desktop app packaging (Tauri v2) |

---

## Deployment

### GitHub Pages (built-in)

The Vite config sets `base: "/mage-hand/"` in production mode. Push to `main` and GitHub Actions will build and deploy to Pages automatically. See [GitHub Pages Hosting](#github-pages-hosting) for path configuration details.

### Desktop (Tauri)

Run `npm run build:desktop` (or `npm run build` + `npm run tauri build`) to produce a native installer. See [Desktop Build (Tauri)](#desktop-build-tauri) for full instructions.

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
