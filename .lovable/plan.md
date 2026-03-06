

# Test Plan: Hybrid Jazz + WebSocket Tandem Session

## Purpose

Validate the end-to-end workflow where a Host creates a Jazz-backed campaign session and a Player joins using a shared `J-` session code, with Jazz handling durable state and WebSocket handling ephemeral ops.

---

## Workflow: Host (DM)

1. **Landing Screen** — Enter username, select DM role
2. **Load Campaign** — Click "Load" and import an `.mhsession` file (populates tokens, maps, fog, effects, etc.)
3. **Continue to Tabletop** — Click "Continue" to enter the canvas
4. **Open Session Manager** — Click the multiplayer/network button
5. **Select Jazz Transport** — Switch the transport dropdown to "Jazz"
6. **Create Session** — Click "Create Session"
   - Jazz session root is created; all DO kinds are pushed as blobs
   - Ephemeral WebSocket connects in tandem (non-blocking)
   - A `J-` session code is generated and displayed
7. **Copy Session Code** — Click the copy button to share the `J-` code with the Player

## Workflow: Player

1. **Landing Screen** — Enter username, select Player role
2. **Continue to Tabletop** — Click "Continue" (empty canvas)
3. **Open Session Manager** — Click the multiplayer/network button
4. **Paste Session Code** — Paste the `J-` code into the join input
5. **Join Session** — Click "Join"
   - Code is auto-detected as Jazz via the `J-` prefix
   - `joinJazzSession()` loads the CoValue root and pulls all blob state into Zustand stores
   - Ephemeral WebSocket connects in tandem (non-blocking)
6. **Canvas Populates** — Player sees the Host's maps, tokens, fog, effects, etc.

---

## Expected Outcomes

### Connection

| Check | Expected |
|-------|----------|
| Host connection indicator | Shows "Tandem" badge with both Durable (Jazz) = green, Ephemeral (WS) = green |
| Player connection indicator | Same as above after join completes |
| Ephemeral WS failure | Non-fatal — Jazz durable sync still works, WS row shows yellow/red, toast warns |
| Session code format | Starts with `J-`, is copyable and pasteable across devices |

### Durable State Sync (Jazz)

| Check | Expected |
|-------|----------|
| Tokens | Player sees all Host tokens in correct positions |
| Maps | Player sees Host's map list; active map renders correctly |
| Regions | All regions with textures/backgrounds appear on Player's canvas |
| Fog of War | Host's fog state (revealed/hidden areas) replicates to Player |
| Effects | Active effects (auras, templates) appear on Player's canvas |
| Initiative | Initiative order and current turn sync to Player |
| Creatures | Creature library entries are available to Player |
| Lights / Illumination | Light sources and illumination settings sync |

### Ephemeral Ops (WebSocket)

| Check | Expected |
|-------|----------|
| Cursor sync | Host sees Player's cursor position and vice versa |
| Token drag preview | Dragging a token shows a ghost preview on the other client |
| Ping | Sending a ping from debug tools shows on the other client |
| Chat typing indicator | Typing in chat shows indicator on the other client |
| Presence | Both clients see each other in the connected users list |
| Join/leave toasts | "X joined/left the session" toasts appear |

### Live Mutations

| Check | Expected |
|-------|----------|
| Host moves a token | Player sees the token move (via Jazz blob/fine-grained sync, ~1s delay for blobs) |
| Host places an effect | Player sees the effect appear |
| Host reveals fog | Player's fog updates |
| Host advances initiative | Player sees turn change |
| Player moves their token | Host sees movement (if role permissions allow) |

### Disconnect / Reconnect

| Check | Expected |
|-------|----------|
| Host clicks Leave | Both Jazz bridge and WebSocket disconnect; status returns to "Disconnected" |
| Player clicks Leave | Same; Host sees "X left" toast |
| WebSocket drops (network blip) | Auto-reconnect fires for WS; Jazz stays connected; indicator shows WS reconnecting |
| Rejoin after leave | Player can re-paste the `J-` code and rejoin; state re-syncs |

---

## Known Limitations / Risks

- **Blob sync latency**: Non-token DO kinds use 1Hz throttled JSON blobs — expect up to ~1s delay for map/fog/effect changes
- **Large fog geometry**: Fog with complex reveal paths may produce large JSON blobs; watch for performance
- **Jazz provider**: Requires `JazzSessionProvider` to be mounted in the component tree; if missing, `createSessionRoot` will fail
- **No WebSocket server**: If no WS server is running at the configured URL, ephemeral features (cursors, drags) won't work but durable sync still functions
- **Echo loops**: If `isFromJazz()` guard fails, mutations could ping-pong; watch console for rapid re-push warnings

---

## Manual Test Checklist

```text
[ ] Host: Load .mhsession with tokens, maps, fog, effects
[ ] Host: Create Jazz session → J- code generated
[ ] Host: Connection indicator shows Tandem (Jazz + WS green)
[ ] Player: Join with J- code → canvas populates
[ ] Player: Connection indicator shows Tandem
[ ] Verify: Token positions match
[ ] Verify: Map/region/fog state matches
[ ] Verify: Effects and initiative match
[ ] Verify: Cursor sync works (ephemeral)
[ ] Verify: Token drag preview works (ephemeral)
[ ] Host: Move a token → Player sees update
[ ] Host: Reveal fog → Player sees update
[ ] Player: Leave session → Host sees toast
[ ] Player: Rejoin → state re-syncs
[ ] Host: Leave session → both transports disconnect
```

This plan will be saved to `Plans/hybrid-tandem-test-plan.md`.

