---
description: WebRTC + Jazz Architecture Implementation Plan
model: Gemini 3.1 Pro (High)
status: Pending
---

# Agent Contract: WebRTC + Jazz Architecture Implementation

## Context & Objectives
You are tasked with executing a major network architecture migration for an existing web-first VTT application. Currently, all networking (both durable state and high-frequency ephemeral state like mouse cursors and token dragging) routes through a Jazz CRDT via `src/lib/net/transports/JazzTransport.ts`. 

Your objective is to split this into a Dual-Path "Zero-Cost" Architecture:
1. **Durable Path**: Jazz CRDT (for commitments: dropping tokens, character state changes).
2. **Ephemeral Path**: WebRTC P2P (for high-frequency sync metrics).

Additionally, you will wrap the host client in Tauri to allow the instantiation of a local Jazz sync node, reducing cloud reliance and unlocking true local-first performance. You must ensure that standard browser deployments (like GitHub Pages) are unblocked and gracefully downgrade back to Jazz signaling if the WebRTC or Tauri environment is unavailable.

---

## 📋 Task Checklist

### Phase 1: Signaling & WebRTC Foundation (The "Plumbing")
- [ ] **Define Signaling Schema**: Update `src/lib/jazz/schema.ts` to include a `signalingRoom` CoMap inside `JazzSessionRoot` capable of handling WebRTC SDP offers and answers keyed by `[peerId]`.
- [ ] **Implement WebRTCTransport**: Create `src/lib/net/transports/WebRTCTransport.ts` implementing `ITransport`.
  - [ ] Implement a `ConnectionManager` to detect new players via the Jazz session.
  - [ ] Implement Host logic to write SDP Offers to the `signalingRoom`.
  - [ ] Implement Client logic to read Offers and return SDP Answers to the `signalingRoom`.
  - [ ] Configure STUN servers (e.g., standard Google/Mozilla stun endpoints).
- [ ] **Composite Strategy**: Update `src/lib/networking/client/NetManager.ts` to accept/initialize both `JazzTransport` and `WebRTCTransport`.
- [ ] **Data Rerouting**: Modify `JazzTransport.ts` to **stop** listening to or routing `msg.t === "ephemeral"`. Pass these explicitly through the new `WebRTCTransport` data channels.

### Phase 2: Tauri Desktop Wrapper & Local Service
- [ ] **Tauri Scaffold**: Run `npx tauri init` to scaffold the `src-tauri` directory. Update `package.json` scripts (`tauri dev`, `tauri build`).
- [ ] **Jazz Sidecar Bundle**: Configure `tauri.conf.json` (`bundle.externalBin`) to package the Jazz local sync node executable.
- [ ] **Rust Auto-Launch**: Modify `src-tauri/src/main.rs` to spawn the Jazz server sidecar on app start and implement a graceful shutdown hook.
- [ ] **App Connectivity Toggle**: Implement environment checks (e.g., `window.__TAURI_IPC__`) to detect desktop mode. If true, bypass cloud Jazz and connect directly to the local sidecar WS port.

### Phase 3: Asset Storage (IndexedDB/Dexie.js)
- [ ] **Dexie.js Implementation**: Integrate `Dexie.js` as an IndexedDB wrapper for local image/asset storage.
- [ ] **Caching Strategy**: Ensure that shared assets are downloaded once by clients and cached locally for subsequent sessions.
- [ ] **Session Export**: Validate that the Session Export feature (`.mhsession`) captures the IndexedDB data layout correctly for manual backups.

### Phase 4: Testing & Validation
- [ ] **Network Profiler Updates**: Update debug views (e.g., `NetworkDemoCard.tsx`) to track stats for both transports independently (Active Peer Connections, Ephemeral message rates, etc.).
- [ ] **Stress Test Adaptation**: Update `scripts/stressTest.ts` to utilize the Dual-Path approach and ensure headless clients can negotiate WebRTC.
- [ ] **Fallback Validation**: Verify that the app correctly "ghosts" (falls back to Jazz CoValue routing) if WebRTC drops, and that standard web-builds deploy to GitHub Pages without the Tauri sidecar requirement.

---

## Technical Constraints & Guidelines
1. Do **not** route `msg.t === "ephemeral"` through Jazz once Phase 1 is complete.
2. WebRTC Topology must be a **Star Topology** where the Host routes ephemeral data to prevent upload bottlenecks.
3. Respect existing components. Use absolute file paths when modifying files.
4. After completing a phase, verify that type definitions compile and tests run successfully before moving to the next.

**End of Contract.**
