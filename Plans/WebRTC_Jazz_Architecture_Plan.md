# WebRTC + Jazz Architecture & Implementation Plan

This plan outlines the steps required to split our networking into a durable, local-first path (Jazz) and a high-frequency ephemeral path (WebRTC), along with wrapping the application in Tauri for native desktop support and local infrastructure hosting.

## Recommended Execution Mode
**Gemini 3.1 Pro (High)**
*Reasoning*: This implementation crosses multiple complex domains (networking protocols, WebRTC signaling, CRDT schema migrations, Rust sidecar process management via Tauri, and frontend integration). High mode ensures sufficient context retention to track state across these boundaries effectively.

---

## 1. Current State & Impacts
Currently, the application utilizes a pluggable `ITransport` API (`src/lib/networking/client/transport.ts`). The `JazzTransport` implementation (`src/lib/net/transports/JazzTransport.ts`) routes both:
1. **Durable Actions**: (e.g., chat messages, token drops)
2. **Ephemeral Actions**: (e.g., `cursor.update`, `map.ping`, `token.drag.*`) 

*Impact*: Routing 60fps ephemeral events into the durable Jazz CRDT creates significant egress, bloats the local database, and creates unnecessary replication latency. 

## 2. Architecture Goal
We will achieve a "Zero-Cost" Architecture utilizing a Dual-Data Path:
* **Durable Path (Jazz)**: Exclusively for Commitment data (token stopped moving, HP changed). 
* **Ephemeral Path (WebRTC P2P)**: Exclusively for In-Flight data (token dragging, cursors, pings). 
  * *Topology*: We will utilize a **Star Topology** where the Host acts as the central router for ephemeral broadcasts. This prevents the exponential upload bottleneck found in Full-Mesh setups for 24+ players.

---

## Phase 1: Foundation & Jazz Signaling (The "Plumbing")
**Target**: Establish WebRTC connections using Jazz CoValues as our signaling mailbox.

**Steps:**
1. **Define `SignalingSchema` in Jazz** (`src/lib/jazz/schema.ts`):
   - Add a `signalingRoom` CoMap to `JazzSessionRoot`.
   - Structure it to accept SDP offers and answers keyed by `[peerId]`.
2. **Implement `WebRTCTransport`** (`src/lib/net/transports/WebRTCTransport.ts`):
   - Scaffold a new transport implementing the existing `ITransport` interface.
   - Setup a `ConnectionManager` that listens to players joining the Jazz session.
   - For the Host: Generate WebRTC Offers and write them to the `signalingRoom`.
   - For the Client: Read Host Offers, generate Answers, and write them back.
   - Configure public STUN servers (Google/Mozilla).
3. **Composite Transport Strategy** (`src/lib/networking/client/NetManager.ts`):
   - Update the connection injection to accept/initialize both transports.
   - Update `JazzTransport` to **stop** listening to or routing `msg.t === "ephemeral"`.
   - Route `msg.t === "ephemeral"` exclusively through the `WebRTCTransport` data channels.

---

## Phase 2: Tauri Desktop Wrapper & Local Service
**Target**: Wrap the app in Tauri so that the Host can act as a local node, auto-launching a local Jazz sync node on startup.

**Steps:**
1. **Tauri Initialization**:
   - Run `npx tauri init` to scaffold the `src-tauri` directory.
   - Update `package.json` scripts to include `tauri dev` and `tauri build`.
2. **Bundle Local Jazz Sync Node as a Sidecar**:
   - Configure `tauri.conf.json`’s `bundle.externalBin` to package the Jazz local sync node executable.
3. **Auto-Launch Lifecycle (`src-tauri/src/main.rs`)**:
   - Implement Rust code to automatically spawn the local Jazz server sidecar when the Tauri app boots.
   - Implement graceful shutdown logic to ensure the Jazz process is terminated when the app closes (preventing orphaned background loops).
4. **App Connectivity**:
   - Add an environment check (`window.__TAURI_IPC__`) to detect desktop mode.
   - If running in Tauri, bypass the cloud Jazz endpoints and point the local client directly to `ws://localhost:XXXX` (the auto-launched sidecar port).

---

## Phase 3: Asset Storage (IndexedDB/Dexie.js)
**Target**: Provide permanent local storage for browser users and fallback asset storage.

**Steps:**
1. Evaluate/Implement **Dexie.js** for an improved IndexedDB wrapper.
2. Ensure large shared images/assets are cached after the first download so sequential sessions load instantly.
3. Validate that the "Session Export" feature (`.mhsession`) correctly captures the IndexedDB data layout to provide functional manual backups.

## Phase 4: Testing & Validation
**Target**: Ensure the new networking paths are stable, visible via tooling, and don't block rapid web deployments.

**Steps:**
1. **Network Profiler Updates**:
   - Update `NetworkDemoCard.tsx` and related debug views to explicitly track and display stats for *both* transports (Jazz and WebRTC) independently.
   - Display active WebRTC peer connections, STUN/TURN status, and ephemeral message rates.
2. **Stress Test Adaptation**:
   - Update `scripts/stressTest.ts` to utilize the new Dual-Path approach. Ensure the headless clients can successfully negotiate WebRTC connections in the simulated environment.
3. **Web-First Compatibility Check**:
   - Ensure the Tauri build configuration and the desktop environment checks (`window.__TAURI_IPC__`) fail gracefully in the browser.
   - Verify that the standard browser build can still seamlessly deploy to GitHub Pages and fallback to Jazz signaling without requiring a local sidecar.
4. **Resiliency Testing**:
   - Create tests/procedures to simulate WebRTC connection drops and verify that the application correctly "ghosts" or falls back to routing through the Jazz CoValues.

---

## Final Review
* **App Hosting**: GitHub Pages (Primary Web Build) / Tauri (Desktop App) - **$0**
* **Signaling/Durable Sync**: Jazz Cloud / Local Sidecar - **$0**
* **Real-time Sync**: WebRTC P2P - **$0**

This plan achieves zero-cost, scalable networking while explicitly maintaining our dual-deployment strategy. We lock in WebRTC as the ephemeral layer, elevate the Host to a local-first provider via Tauri, and ensure the browser-first version remains unblocked for rapid iteration.
