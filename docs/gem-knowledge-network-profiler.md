# Mage Hand — Network Profiler Knowledge File
**For use with Gemini AI Gem: Network Visualization & Analysis Tool**
*App Version: 0.7.451*

---

## Project Overview

**Mage Hand** is a real-time collaborative tabletop RPG (TTRPG) virtual tabletop (VTT) application. Players and a Dungeon Master (DM/Host) connect online to share a synchronized canvas that includes:

- **Tokens** — player and NPC character pieces with positions, HP, stats, textures
- **Regions** — tiled map zones with background textures
- **Map Objects** — walls, doors, portals, annotations, decorative assets
- **Fog of War / Vision** — per-player visibility calculations
- **Effects** — spells, AoE templates, animated overlays
- **Illumination / Lighting** — dynamic light sources
- **Initiative / Combat** — turn tracking

The app runs in the browser (TypeScript + React + Vite), hosted locally with `npm run dev`. Use case: small groups of 2–6 players typically, with potentially 20–40 simultaneous entities (tokens + bots) on the canvas.

---

## Why We Need Network Analysis

We want to **measure, visualize, and optimize the effect cost-to-transaction metrics** for our two networking layers:

1. **Jazz.tools (Durable Objects / CRDT persistent layer)**
2. **WebRTC (ephemeral real-time layer)**

The key business question is: **How much does it cost (in bandwidth/DO operations) to perform common VTT actions?** We want to identify expensive operations, detect idle baseline chatter, and find optimization opportunities to reduce [Jazz.tools](https://jazz.tools) Cloudflare Durable Object billing costs.

---

## Architecture: Dual-Transport Networking

The app uses two separate networking layers that serve distinct purposes:

### Layer 1: Jazz.tools (Persistent CRDT Sync)
- Built on **Cloudflare Durable Objects** (DOs) — the billing/cost unit
- Uses the **Jazz CoValues** (Conflict-free Replicated Data Types) model
- Managed by `src/lib/jazz/bridge.ts` — a bidirectional bridge between Jazz CoValues and local Zustand stores
- **Two sync strategies:**
  - **Fine-grained CoValue sync** — Tokens, Regions, MapObjects, Effects each get their own CoValue
  - **Blob sync** — maps, groups, initiative, roles, visionProfiles, fog, lights, dungeon, creatures, hatching, actions, dice, mapFocus, campaigns, tokenGroups use a JSON-serialized blob (`JazzDOBlob`)
- **FileStream** — Binary texture/image sync (PNG/JPEG data URIs) via Jazz FileStream API
- **Cost driver**: Each unique entity (CoValue) modified or observed is a Durable Object activation. More DOs = higher cost.
- **Throttling**: Jazz writes are throttled to avoid excessive DO operations. During canvas edits, writes may be deferred (broadcast pause) and flushed on completion.

### Layer 2: WebRTC (Ephemeral Real-time)
- **Star topology** — Host (DM) acts as router; all clients connect to the Host, messages fan-out
- **Signaling** — Uses Jazz CoValues (a `signalingRoom` CoMap) to exchange WebRTC offers/answers/ICE candidates without a dedicated signaling server
- **Data channel** — Unordered, unreliable (`maxRetransmits: 0`) for low-latency delivery
- **Purpose** — Carries ephemeral, high-frequency messages only:
  - Cursor positions
  - Token drag position updates (live drag)
  - Chat messages
  - Ping events (pings/highlights on canvas)
  - Canvas edit lifecycle events (begin/end broadcasts)
- **NOT cost-incurring** in Jazz billing terms — WebRTC data is P2P, not through Cloudflare DOs
- **ICE Servers** — Google STUN servers (`stun.l.google.com:19302`, `stun1.l.google.com:19302`)

### Transport Roles Summary
| Capability | Jazz (CRDT) | WebRTC (Ephemeral) |
|---|---|---|
| Persistent state | ✅ Yes | ❌ No |
| Billed per operation | ✅ Yes (DO billing) | ❌ No |
| Texture/image sync | ✅ Yes (FileStream) | ❌ No |
| Presence/roster | ✅ Yes | ❌ No |
| Live cursor/drag | ❌ No | ✅ Yes |
| Latency | Medium (CRDT propagation) | Low (P2P direct) |

---

## The SyncProfiler

`src/lib/jazz/profiler.ts` — A rolling-window bandwidth monitor. It samples every **10 seconds** and appends a row to its history log.

### What It Measures

| Metric | Description |
|---|---|
| `outKb` | Estimated KB of Jazz CoValue mutations sent outbound in the window |
| `inKb` | Estimated KB of Jazz CoValue subscription callbacks received in the window |
| `outOps` | Count of outbound CoValue mutation operations in the window |
| `inOps` | Count of inbound CoValue subscription callback fires in the window |
| `activeDOs` | Cumulative count of unique CoValues (entities) touched this session |
| `streamOutKb` | FileStream bytes uploaded in the window (textures out) |
| `streamInKb` | FileStream bytes downloaded in the window (textures in) |

> **Note on size estimation**: The `approximateSize()` heuristic is fast and non-blocking (deliberately avoids `JSON.stringify` on CoValues to prevent main-thread blocking). It uses a rough 50-byte/key heuristic for objects and 2-bytes/char for strings. Values are **approximate** and should be treated as relative indicators, not precise byte counts.

### Important Behavioral Notes
- `activeDOs` is **cumulative per session** — it does not reset per window
- `streamOutKb` and `streamInKb` **do** reset per window (window-level delta)
- `outKb` and `inKb` **reset per window** (window-level delta)
- The profiler only logs a row if at least one op or stream byte occurred in the window
- A client-role session (non-DM) will always show `Out (Ops) = 0` for most sessions because clients generally read, not write. Writes come from the DM/Host.

---

## CSV Export Format

The profiler can export its history as a CSV file via the **"Save CSV"** button in the Network Profiler panel.

### File Naming Convention
```
sync_profiler_log_{unix_timestamp_ms}.csv
```
Optionally prefixed with a test name:
```
webrtc-sync_profiler_log_{timestamp}.csv
20-tokens-20-bots-sync_profiler_log_{timestamp}.csv
```

### CSV Schema (Current — 8 columns)
```csv
Timestamp,Out (KB),In (KB),Out (Ops),In (Ops),Active DOs,Stream Out (KB),Stream In (KB)
```

| Column | Type | Unit | Description |
|---|---|---|---|
| `Timestamp` | ISO 8601 string | UTC datetime | End of the 10-second window |
| `Out (KB)` | float (2 dp) | Kilobytes | Outbound Jazz CoValue data in window |
| `In (KB)` | float (2 dp) | Kilobytes | Inbound Jazz CoValue data in window |
| `Out (Ops)` | integer | Count | # of outbound CoValue mutation operations |
| `In (Ops)` | integer | Count | # of inbound subscription callback fires |
| `Active DOs` | integer | Count | Cumulative unique CoValues touched (session total) |
| `Stream Out (KB)` | float (2 dp) | Kilobytes | FileStream upload bytes in window |
| `Stream In (KB)` | float (2 dp) | Kilobytes | FileStream download bytes in window |

> **Legacy note**: Older CSV files may have 7 columns with `Stream (KB)` (combined) instead of the split `Stream Out (KB)` / `Stream In (KB)`. Check header row.

### Example Rows (Client perspective, 20 tokens active)
```csv
Timestamp,Out (KB),In (KB),Out (Ops),In (Ops),Active DOs,Stream Out (KB),Stream In (KB)
2026-03-15T22:13:55.495Z,0.00,2.39,0,15,0,0.00,0.00
2026-03-15T22:14:45.495Z,0.00,53.59,0,34,16,0.00,0.00
2026-03-15T22:14:55.494Z,0.00,152.89,0,97,20,0.00,0.00
2026-03-15T22:15:05.508Z,0.00,167.07,0,106,20,0.00,0.00
2026-03-15T22:15:15.496Z,0.00,151.31,0,96,20,0.00,0.00
```

### Example Rows (Host perspective, 20 tokens + 20 bots scenario)
```csv
Timestamp,Out (KB),In (KB),Out (Ops),In (Ops),Active DOs,Stream Out (KB),Stream In (KB)
2026-03-15T23:36:08.204Z,3.03,0.00,62,0,0,0.00,0.00
2026-03-15T23:36:28.207Z,0.00,64.30,0,40,20,570.94,0.00
2026-03-15T23:36:38.219Z,0.00,291.68,0,178,20,17660.42,0.00
2026-03-15T23:37:48.209Z,0.00,4.92,0,3,20,0.00,0.00
```
*(Note: 17,660 KB stream spike = texture batch download during initial session join)*

### Example Rows (Steady-state, client, 40 bots running)
```csv
Timestamp,Out (KB),In (KB),Out (Ops),In (Ops),Active DOs,Stream (KB)
2026-03-15T14:00:52.458Z,0.00,32.70,0,113,40,0.00
2026-03-15T14:01:02.515Z,0.00,31.03,0,112,40,0.00
...
2026-03-15T14:04:42.519Z,0.00,97.99,0,181,40,0.00
```
*(~32–33 KB/10s inbound baseline per 40 active bots, with occasional 97 KB spikes during burst events)*

---

## Known Patterns & Observations

### Idle Chatter Baseline (40 entities)
- **Inbound**: ~75–80 KB / 10-second window at 40 active tokens
- **Ops**: ~110–115 inbound ops / window
- This represents the CRDT heartbeat cost of 40 entities being subscribed to

### Session Init Spike
- First few windows show elevated ops as the client hydrates all entity CoValues
- `Stream In (KB)` spikes sharply on first join (all textures downloading)
- `Active DOs` grows from 0 to entity count quickly during hydration

### Host vs Client Asymmetry
- **Host (DM)**: High `Out (KB)` and `Out (Ops)` — all mutations originate here
- **Client**: `Out (Ops) = 0` in normal play; only increases if client owns mutations (rare)
- **Both**: `In (KB)` and `In (Ops)` active — all participants receive CRDT sync events

### Deferred Writes (Broadcast Pause)
- During active canvas edits, the DM can pause Jazz writes
- Out (KB) may drop to 0 for several windows during a long edit session
- A single spike appears on flush when edits are committed

### WebRTC vs Jazz Cost Split
- **Cursor/drag** traffic does NOT appear in the CSV — it's WebRTC only, not billed
- The CSV exclusively reflects **Jazz CRDT / Durable Object** traffic
- WebRTC peer connection state is visible in the UI panel but not exported to CSV

---

## Analysis Goals

When analyzing these CSVs, we are focused on:

1. **Baseline cost per entity count** — KB and Ops as a function of active token/entity count
2. **Spike detection** — identify anomalous high-bandwidth windows and correlate with events
3. **Session lifecycle costs** — init, steady-state, and teardown
4. **Cost-per-action** — how expensive is "move token", "add region", "cast effect", etc.
5. **DO utilization efficiency** — is `Active DOs` growing unboundedly? When does it plateau?
6. **Stream traffic isolation** — texture downloads are one-time (cached in IndexedDB). Recurring stream bytes indicate texture uploads being re-triggered.
7. **Optimization validation** — before/after comparisons of CSV traces to verify that throttle or deferred-write changes reduced costs

---

## Visualization Recommendations

For a Gem-powered network visualization tool, the recommended charts are:

- **Time-series line chart** — `Out (KB)` and `In (KB)` over time (dual-axis or same scale)
- **Ops bar chart** — `Out (Ops)` vs `In (Ops)` per window
- **Active DOs plateau chart** — `Active DOs` as a step function showing entity discovery
- **Stream spike overlay** — `Stream Out (KB)` and `Stream In (KB)` as spike markers
- **Rolling average** — 30-second / 60-second moving average to smooth window jitter
- **Cost estimate overlay** — Annotate windows with estimated DO billing cost (requires Jazz.tools pricing reference)
- **Multi-file comparison** — Overlay two or more CSVs (e.g., pre/post optimization) for A/B comparison

---

## Files and Code References

| File | Purpose |
|---|---|
| `src/lib/jazz/profiler.ts` | `SyncProfiler` class — captures metrics and exports CSV |
| `src/components/SyncProfilerPanel.tsx` | UI panel — shows live stats, WebRTC peer list, CSV download |
| `src/lib/jazz/bridge.ts` | Jazz ↔ Zustand bidirectional sync (where outbound metrics are wired) |
| `src/lib/net/transports/JazzTransport.ts` | Jazz transport adapter — presence sync, welcome handshake |
| `src/lib/net/transports/WebRTCTransport.ts` | WebRTC P2P transport — star topology, signaling via Jazz |
| `src/stores/networkDiagnosticsStore.ts` | Per-peer WebRTC diagnostics state |
| `example/*.csv` | Example CSV exports from real sessions |
