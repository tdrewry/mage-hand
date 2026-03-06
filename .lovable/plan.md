

# Jazz (Durable) + WebSocket (Ephemeral) Tandem Mode

## Goal

A single shared session code gives both peers **Jazz CRDT sync for durable state** and a **WebSocket connection for ephemeral ops** (cursors, drag previews, typing indicators, pings). Today these are independent; the tandem mode runs both simultaneously under one code.

## Shared Session Code Design

The Jazz code (`J-...`) remains the canonical session code users share. When a peer creates or joins a Jazz session, the system also opens a WebSocket connection to the ephemeral server using the **same Jazz code as the WebSocket session code**. The WebSocket server doesn't care about code format -- it just rooms peers by matching codes.

```text
User shares: J-Y29femFiYzEyMw

  ┌──────────────────────────────────┐
  │        Shared Session Code       │
  │      J-Y29femFiYzEyMw            │
  └──────┬───────────────┬───────────┘
         │               │
    ┌────▼────┐    ┌─────▼──────┐
    │  Jazz   │    │ WebSocket  │
    │  CRDT   │    │ Ephemeral  │
    │ Bridge  │    │   Only     │
    └─────────┘    └────────────┘
    Tokens, maps,   Cursors, drags,
    effects, fog    pings, typing
```

## Changes Required

### 1. NetManager: Ephemeral-Only Connect Mode

Add a `connectEphemeralOnly()` method (or a flag on `connect()`) that:
- Opens the WebSocket connection normally
- Skips wiring `opBatch` to `OpBridge` (no durable op routing)
- Only activates ephemeral message routing and presence events
- Uses the Jazz session code as the WebSocket room code

### 2. SessionManager: Tandem Startup on Jazz Create/Join

When creating or joining a Jazz session in `handleCreateSession` / `handleJoinSession`:
1. Create/join Jazz session (existing logic)
2. Also call `netManager.connectEphemeralOnly({ serverUrl, sessionCode: jazzCode, username })`
3. Both connections run in parallel

### 3. AutoReconnect: Reconnect Both Layers

Update `useAutoReconnect.ts` so that for Jazz codes:
1. Reconnect Jazz bridge (existing logic)
2. Also reconnect WebSocket in ephemeral-only mode

### 4. Leave/Disconnect: Tear Down Both

Update `handleLeaveSession` to call both `leaveJazzSession()` and `netManager.disconnect()`.

### 5. EphemeralBus: Already Works

The `EphemeralBus.setSendFn()` already points at `netManager.sendEphemeral()`. Once the WebSocket is connected (even ephemeral-only), ephemeral ops flow automatically. No changes needed here.

### 6. OpBridge Gating

In `NetManager.wireEvents()`, the `opBatch` handler should check `activeTransport === 'jazz'` and skip forwarding durable ops to `OpBridge` when in tandem mode. Ephemeral ops within batches still route to `EphemeralBus`.

## Files to Edit

| File | Change |
|------|--------|
| `src/lib/net/NetManager.ts` | Add `connectEphemeralOnly()` method; gate durable ops in `opBatch` handler |
| `src/components/SessionManager.tsx` | After Jazz create/join, also open ephemeral WebSocket; update leave handler |
| `src/hooks/useAutoReconnect.ts` | For Jazz codes, also reconnect WebSocket ephemeral-only |
| `src/lib/version.ts` | Bump version |
| `Plans/jazz-websocket-tandem.md` | Save this plan |

## Edge Cases

- **No WebSocket server available**: Ephemeral connect failure is non-fatal; Jazz durable sync still works, just no cursors/drags. Log a warning, don't block.
- **WebSocket reconnect**: Existing auto-reconnect logic handles WebSocket drops independently of Jazz.
- **Single-player mode**: Neither transport activates; no change.

