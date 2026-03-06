# Jazz.tools — Durable Object Sync Integration Plan

## Status: Phase 1 Complete (v0.7.0)

## Context

### Current Architecture
The app has **two networking layers**:
1. **Ephemeral** — cursors, drag previews, typing indicators → `EphemeralBus` on raw WebSocket, TTL-based, lossy. **Stays as-is.**
2. **Durable** — token moves, chat, state commits → `OpBridge` on the same WebSocket, sequenced & acked. **Stays as-is.**

### Transport Selection Architecture (CRITICAL)

> **Jazz is a swappable transport module, NOT a replacement for OpBridge.**

The durable sync layer supports **multiple transport backends** that a hosting user can select:

| Transport | Backend | Use Case |
|-----------|---------|----------|
| `OpBridge` + WebSocket server | Custom Node.js server | Default, self-hosted, full control |
| `Jazz` CoValues | Jazz sync server (self-hosted or cloud) | CRDT conflict resolution, offline-first |
| *(future)* Cloudflare DOs | Cloudflare Workers | Edge-hosted, scalable |

**Architectural rules:**
1. `OpBridge` and `NetManager` remain the **default** durable transport — never remove them.
2. Jazz lives in `src/lib/jazz/` as a **standalone module** with no imports into core networking (`src/lib/net/`).
3. Transport selection is a **session-level config** — the hosting user picks which backend to use.
4. All transports feed into the **same Zustand stores** — the UI layer is transport-agnostic.
5. `DurableObjectRegistry` extractor/hydrator contracts are shared across all transports.
6. `EphemeralBus` is **always active** regardless of which durable transport is selected.

### What Jazz Provides (when selected)
| Current (OpBridge) | Jazz Equivalent |
|---------|----------------|
| `OpBridge.proposeOp()` | CoValue mutation (auto-synced) |
| `opBatch` handler + sequence tracking | CoValue subscription (`useCoState`) |
| `token.sync` bulk catchup | Automatic on CoValue load |
| `.mhsession` / `.mhdo` file export | CoValue snapshot / `toJSON()` |
| Server-side op ordering | Jazz CRDT merge (no server ordering needed) |
| `lastSeenSeq` localStorage tracking | Jazz handles internally |

### What Always Stays
- **OpBridge + NetManager** — default durable transport, always available
- **EphemeralBus** — all high-frequency lossy ops (cursors, drags, pings, typing)
- **DurableObjectRegistry** — extractor/hydrator contract (shared by all transports)
- **Zustand stores** — remain the source of truth for UI rendering; transports feed into them

---

## Phase 1: Foundation — Jazz Provider + Session Schema

### 1.1 Install Dependencies
```bash
npm install jazz-tools jazz-react
```

### 1.2 Self-Hosted Sync Server
For local development:
```bash
npx jazz-run sync --port 4200
```
Connect at `ws://localhost:4200`. No cloud account needed.

### 1.3 Define Jazz Schema (`src/lib/jazz/schema.ts`)
Map each DO kind to a CoMap. Start with the simplest stores:

```typescript
import { co, z } from "jazz-tools";

// ── Token ──
export const JazzToken = co.map({
  tokenId: z.string(),       // maps to Token.id
  x: z.number(),
  y: z.number(),
  color: z.string(),
  label: z.string(),
  gridWidth: z.number(),
  gridHeight: z.number(),
  // ... other serializable Token fields
});

// ── Token List (per-session) ──
export const JazzTokenList = co.list(JazzToken);

// ── Session Root — the top-level CoMap that holds all DO state ──
export const JazzSession = co.map({
  name: z.string(),
  tokens: JazzTokenList,
  // Phase 2+: maps, regions, effects, fog, etc.
});
```

### 1.4 Jazz Provider (`src/lib/jazz/provider.tsx`)
Wrap the app in `JazzReactProvider` with the self-hosted sync URL:

```tsx
import { JazzReactProvider } from "jazz-react";

export function JazzProvider({ children }: { children: React.ReactNode }) {
  return (
    <JazzReactProvider
      sync={{ peer: "ws://localhost:4200" }}
    >
      {children}
    </JazzReactProvider>
  );
}
```

### 1.5 Bridge Layer (`src/lib/jazz/bridge.ts`)
Bidirectional sync between Jazz CoValues and Zustand stores:

```
Jazz CoValue change → zustand store hydrator
Zustand store action → Jazz CoValue mutation
```

The bridge:
- Subscribes to CoValue changes → calls `DurableObjectRegistry.get(kind).hydrator(state)`
- Intercepts zustand store writes → mirrors to CoValue
- Uses a `_fromJazz` flag to prevent echo loops (same pattern as `_fromRemote` in OpBridge)

---

## Phase 2: Token Store Bridge (Proof of Concept) ✅ COMPLETE (v0.7.4)

### What Was Done
1. **MageHandAccount** — defined `co.account()` with root containing `activeSession`
2. **createSessionRoot()** — helper creates `JazzSessionRoot` with empty lists and public group
3. **JazzSessionProvider** wired into `App.tsx` wrapping the entire app (anonymous auth)
4. **bridge.ts** — full bidirectional token sync:
   - Zustand → Jazz: token add/move/update/remove via `$jazz.set()`
   - Jazz → Zustand: subscription-based inbound with `runFromJazz()` echo prevention
5. **session.ts** — `createJazzSession()` / `joinJazzSession()` / `leaveJazzSession()`
6. **NetworkDemoCard** — Jazz Transport section with Create/Join/Leave/Copy ID controls

### How to Test Two-Peer Sync
1. Run sync server: `npm run dev:jazz`
2. Run app: `npm run dev`
3. Open two browser tabs
4. Tab 1: Network Demo → Create Jazz session → copy session ID
5. Tab 2: Network Demo → paste session ID → Join
6. Create tokens in either tab — they appear in both via CRDT bridge

### Steps Deferred
- Step 6 from original plan (remove token ops from OpBridge) — **NOT done** per architectural rule: OpBridge stays as default transport
- Both transports can coexist; Jazz bridge only activates when a Jazz session is created/joined

---

## Phase 3: Expand to All DO Stores

### Migration Order (by complexity)
| Priority | Store | Complexity | Notes |
|----------|-------|-----------|-------|
| 1 | tokens | Low | ✅ Done (Phase 2) |
| 2 | maps | Low | Metadata + image refs |
| 3 | initiative | Low | Ordered list |
| 4 | roles | Low | Simple assignments |
| 5 | groups | Medium | Member references cross-store |
| 6 | regions | Medium | Geometry (wall points, paths) |
| 7 | mapObjects | Medium | Position + shape + category |
| 8 | effects | Medium | Templates + active placements |
| 9 | fog | High | Binary reveal bitmap + explored areas |
| 10 | lights | Medium | Position + parameters |
| 11 | creatures | Low | Library data |
| 12 | cards | Low | UI layout state |
| 13 | dungeon | Medium | Nested structure |
| 14 | illumination | Low | Settings |
| 15 | hatching | Low | Settings |
| 16 | dice | Low | Roll history |
| 17 | actions | Medium | Action queue |
| 18 | visionProfiles | Low | Profile definitions |

### Per-Store Migration Pattern
1. Define CoMap schema in `src/lib/jazz/schema.ts`
2. Add field to `JazzSessionRoot`
3. Wire bridge: zustand action → CoValue mutation
4. Wire bridge: CoValue subscription → zustand hydrator
5. **Do NOT remove** corresponding ops from `OpBridge` — both transports coexist
6. Test two-peer sync

---

## Phase 4: Transport Selection UI

> **OpBridge is NEVER retired.** Jazz is an alternative transport.

- Add a transport selection UI to the session creation flow
- Allow hosting user to choose: "WebSocket (OpBridge)" or "Jazz (CRDT)"
- Store transport preference in session config
- Future: Cloudflare Durable Objects as a third option

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│           React Components          │
│  (useCoState for Jazz, zustand for  │
│   local UI state)                   │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐  ┌──────────────┐
│ Zustand │  │ Jazz CoValues │
│ Stores  │◄─┤ (CRDT sync)  │
│         │──►│              │
└────────┘  └──────┬───────┘
  Bridge ↕         │ WebSocket
                   ▼
           ┌──────────────┐
           │ Jazz Sync    │
           │ Server       │
           │ (localhost    │
           │  :4200)      │
           └──────────────┘

┌─────────────────────────────────────┐
│        EphemeralBus (unchanged)     │
│  Cursors, drags, pings, typing     │
│  via existing WebSocket protocol   │
└─────────────────────────────────────┘
```

---

## File Structure

```
src/lib/jazz/
  schema.ts          — CoMap/CoList definitions for all DO kinds
  provider.tsx       — JazzReactProvider wrapper
  bridge.ts          — Bidirectional zustand ↔ Jazz sync
  session.ts         — Session creation/join logic
  index.ts           — Public exports
```

---

## Open Questions

1. **Authentication**: Jazz requires an account system. For local dev, anonymous/guest accounts work. Production will need a proper auth adapter.
2. **Permissions**: Jazz uses `Group` for access control. Maps to our existing role system (DM = admin, players = writers/readers).
3. **Large binary data**: Fog bitmaps and textures may need `FileStream` CoValues rather than inline CoMap fields.
4. **Migration path**: Existing `.mhsession` files need an import path into Jazz CoValues.
5. **Ephemeral bus transport**: Currently shares the same WebSocket as durable ops. Once Jazz takes over durable, the ephemeral bus needs its own connection or a Jazz sideband.

---

## Success Criteria

- [ ] Two peers can join a session via Jazz sync server
- [ ] Token CRUD syncs in real-time without OpBridge
- [ ] Existing `.mhdo` export/import still works (extractors pull from zustand, which is fed by Jazz)
- [ ] Ephemeral overlays (cursors, drags, pings) continue working independently
- [ ] No regression in single-player mode (Jazz works offline-first)
