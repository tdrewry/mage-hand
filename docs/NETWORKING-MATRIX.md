# VTT Networking Classification Matrix

> **Purpose:** Classify every user interaction in the VTT into Ephemeral or Durable networking layers, identify what is already implemented, and surface potential new features.

## How to Read This Document

| Layer | Properties |
|-------|-----------|
| **Ephemeral** | High-frequency, lossy, TTL-based (250–1000 ms), throttled (10–30 Hz). Not in snapshots, not in undo/redo or authoritative history. Safe to drop frames. |
| **Durable** | Authoritative, server-ordered, acked/rejected, stored in op-log segments, snapshotable, replayable. Used for late-join and cross-device recovery. Permissions enforced. |

**Status key:** `implemented` · `planned` · `potential`

---

## 1. Tokens

*Primary stores: `sessionStore`, `dragPreviewStore`, `actionStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Token drag preview (ghost + path polyline) | implemented | `token.drag.begin/update/end` | 20 Hz throttle, 400 ms TTL, dragPreviewStore |
| Token rotate/scale handle preview | planned | `token.handle.preview` | Broadcast handle position while dragging |
| Hover highlight (who is hovering what) | planned | `token.hover` | userId + tokenId, 500 ms TTL |
| Selection box / lasso preview | planned | `selection.preview` | Broadcast selection rectangle/lasso polyline |
| Movement path preview during drag | implemented | (part of `token.drag.update`) | Path array sent with drag update |
| Targeting reticle position | planned | `action.target.preview` | From actionStore.targetingMousePos |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Token create | planned | `token.create` | Full token payload |
| Token delete | planned | `token.delete` | tokenId |
| Token move commit | implemented | `token.move` | tokenId, x, y (final position) |
| Token resize commit | planned | `token.resize` | tokenId, gridWidth, gridHeight |
| Token sync (bulk) | implemented | `token.sync` | Full token array for late-join |
| Label / name / color changes | planned | `token.update` | Partial token patch |
| Image / imageHash changes | planned | `token.update` | References assetId |
| Illumination source edits | planned | `token.update` | Vision radius, light settings |
| Vision settings | planned | `token.update` | Vision range, type |
| Ownership / roleId | planned | `token.update` | roleId assignment |
| Hidden flag | planned | `token.update` | isHidden toggle |
| Appearance variant switches | planned | `token.update` | Variant index |
| Entity ref updates | planned | `token.update` | Creature library link |
| Notes / statblock edits | planned | `token.update` | Rich text / JSON blob |
| Path style changes | planned | `token.update` | pathStyle enum |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Intent indicator ("about to move X") | Ephemeral | Broadcast intent before drag begins |
| Token rotate commit | Durable | Persist rotation angle |
| Token lock/unlock | Durable | Movement lock toggle |
| Token conditions/status markers | Durable | Shared condition icons |

---

## 2. Map & Camera

*Primary stores: `mapStore`, `regionStore`, canvas transform state*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Camera pan / zoom / viewport (personal) | N/A (local-only) | — | Per-client, never networked |
| DM broadcast pan / zoom to point | planned | `map.dm.viewport` | DM sends { x, y, zoom }; all connected clients (including other DMs) match viewport. 10 Hz throttle, fires on DM action only. |
| Ping / laser pointer | potential | `map.ping` | Position + color, 1 s TTL |
| GM "focus here" pointer | potential | `map.focus` | Forces camera pan on clients |
| Tool cursor broadcast | potential | `cursor.update` | userId + position + tool type |
| Region drag preview | planned | `region.drag.update` | Ghost position during region reposition, 20 Hz throttle, 400 ms TTL |
| Region resize / rotate handle preview | planned | `region.handle.preview` | Broadcast handle position while dragging transform handles |
| Map object drag preview | planned | `mapObject.drag.update` | Ghost position during reposition, 20 Hz throttle, 400 ms TTL |
| Map object rotate / scale handle preview | planned | `mapObject.handle.preview` | Broadcast handle position while dragging transform handles |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Map create / delete | planned | `map.create` / `map.delete` | Full map definition |
| Map update (name, grid, background) | planned | `map.update` | Partial patch |
| Region create / delete | planned | `region.create` / `region.delete` | Polygon + grid + texture |
| Region update (polygon, grid, texture) | planned | `region.update` | Partial patch |
| Map reorder | planned | `map.reorder` | New ordering array |
| Active map selection (shared) | planned | `map.activate` | mapId for all clients |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Ping / laser pointer | Ephemeral | Click-to-ping with auto-expire |
| GM focus pointer | Ephemeral | GM forces all clients to look at a point |
| Tool cursor broadcast | Ephemeral | See other users' cursor + active tool |

---

## 3. Map Objects

*Primary store: `mapObjectStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Map object drag preview | planned | `mapObject.drag.update` | Ghost position during reposition, 20 Hz throttle, 400 ms TTL |
| Door toggle preview | potential | `mapObject.door.preview` | Flash before commit |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Map object create / delete | planned | `mapObject.create` / `mapObject.delete` | Full object payload |
| Position / size / rotation commit | planned | `mapObject.update` | Partial patch |
| Door open / close commit | planned | `mapObject.door.toggle` | objectId + open boolean |
| Bulk operations | planned | `mapObject.bulk` | Array of operations |
| Category / style changes | planned | `mapObject.update` | category, style fields |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Map object drag preview | Ephemeral | Now `planned` — see Ephemeral table above |

---

## 4. Fog of War & Vision

*Primary stores: `fogStore`, `lightStore`, `illuminationStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Realtime vision during token drag | N/A (local-only) | — | Computed locally from drag position |
| Fog brush cursor preview | potential | `fog.cursor.preview` | Brush position + radius |
| Temporary reveal preview | potential | `fog.reveal.preview` | Area shape before commit |
| Debug overlays | N/A (local-only) | — | Dev-only, never networked |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Fog enable / disable | planned | `fog.config` | fogEnabled boolean |
| Reveal-all toggle | planned | `fog.config` | revealAll boolean |
| Fog opacity settings | planned | `fog.config` | opacity value |
| Explored areas geometry | planned | `fog.reveal` | Polygon / stroke data |
| Vision range defaults | planned | `fog.config` | Default vision range |
| Light source create / delete / update | planned | `light.create` / `light.delete` / `light.update` | Position, radius, color, intensity |
| Ambient light / shadow intensity | planned | `illumination.config` | Global lighting settings |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Fog brush cursor preview | Ephemeral | See GM's fog brush while painting |
| Reveal preview before commit | Ephemeral | Show intended reveal area |

---

## 5. Chat & Dice

*Primary store: `diceStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Typing indicator | potential | `chat.typing` | userId, 2 s TTL |
| "User is rolling" spinner | potential | `dice.rolling` | userId, 3 s TTL |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Chat message posted | implemented | `chat.post` | text + msgId |
| Dice roll results | planned | `dice.result` | Formula, rolls, total |
| Pinned formulas | planned | `dice.pin` | Formula string |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Typing indicator | Ephemeral | "User is typing…" in chat |
| Rolling indicator | Ephemeral | "User is rolling dice…" spinner |

---

## 6. Initiative & Combat

*Primary store: `initiativeStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Initiative entry drag preview (reorder) | potential | `initiative.drag.preview` | Dragged entry index + position |
| Current-turn hover highlight | potential | `initiative.hover` | Highlighted entry, 500 ms TTL |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Start / end combat | planned | `initiative.start` / `initiative.end` | Toggle encounter |
| Add / remove combatant | planned | `initiative.add` / `initiative.remove` | tokenId + init value |
| Reorder commit | planned | `initiative.reorder` | New order array |
| Advance turn | planned | `initiative.advance` | Next turn index |
| Round number | planned | `initiative.round` | Round counter |
| Initiative values | planned | `initiative.setValue` | tokenId + value |
| Restrict movement toggle | planned | `initiative.config` | restrictMovement boolean |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Initiative reorder drag preview | Ephemeral | See drag handle movement in real time |

---

## 7. Groups

*Primary store: `groupStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Group selection preview | potential | `group.select.preview` | Selected group highlight |
| Group drag preview | potential | `group.drag.preview` | Ghost positions for group members |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Group create / delete | planned | `group.create` / `group.delete` | Group definition |
| Member add / remove | planned | `group.members` | tokenId array |
| Group transforms commit | planned | `group.transform` | Position / rotation delta |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Group drag preview | Ephemeral | See group being dragged by another user |

---

## 8. Roles & Permissions

*Primary store: `roleStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| "Request control" / hand raise | potential | `role.handRaise` | userId, auto-expire 30 s |
| Presence metadata ("is editing map") | potential | `presence.activity` | userId + activity string |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Role create / update / delete | planned | `role.create` / `role.update` / `role.delete` | Role definition |
| Hostility settings | planned | `role.hostility` | Hostility matrix |
| Permission changes | planned | `role.permissions` | Permission key array |
| Token role assignments | planned | `token.update` | roleId on token |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Hand raise | Ephemeral | Player requests GM attention |
| Editing-state presence | Ephemeral | "User X is editing the map" indicator |

---

## 9. Actions & Combat Resolution

*Primary store: `actionStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Targeting reticle position | potential | `action.target.preview` | Mouse position + source token |
| Resolution flash effects | potential | `action.flash` | Hit/miss animation trigger |
| "Action in progress" indicator | potential | `action.inProgress` | userId + action type |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Action resolution results | planned | `action.resolve` | Attack roll, damage, outcome |
| Attack history entries | planned | `action.history` | Log entry |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Networked targeting reticle | Ephemeral | See other users' targeting crosshair |
| Networked resolution flashes | Ephemeral | Synchronized hit/miss VFX |

---

## 10. UI Mode & Presence

*Primary stores: `uiModeStore`, `multiplayerStore`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Connected player cursors | planned | `cursor.update` | userId + world x,y + color, 15 Hz throttle, 500 ms TTL. DM cursor hidden by default. |
| DM toggle cursor visibility | planned | `cursor.visibility` | DM sends show/hide flag; all clients respect it. Persists for session duration only (ephemeral). |
| "User is viewing map X" indicator | potential | `presence.viewingMap` | userId + mapId |
| Connected / disconnected presence | implemented | (protocol `presence`) | join/leave via WebSocket handshake |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| DM / play mode switch (enforced) | planned | `session.mode` | RPC-style. DM sets mode for all connected clients. Non-DM players cannot select "edit" without DM approval. Other DM-role users may independently select edit mode. Enforced server-side via role check. |
| User kick / ban | planned | `session.kick` / `session.ban` | userId target |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| "Viewing map X" indicator | Ephemeral | Know which map each user is on |

---

## 11. Assets

*Primary stores: texture/image storage modules*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Upload progress indicator | potential | `asset.uploadProgress` | userId + percentage, 1 s TTL |
| Loading states | N/A (local-only) | — | Per-client loading spinners |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Asset registered | planned | `asset.register` | hash, size, mime, key |
| Token image reference | planned | (via `token.update`) | imageHash / assetId |
| Region texture reference | planned | (via `region.update`) | textureHash / assetId |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Upload progress broadcast | Ephemeral | "User X is uploading an asset (45%)" |

---

## 12. Effects & Auras

*Primary stores: `effectStore`, `auraEngine`*

### Ephemeral

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Effect placement preview (ghost) | planned | `effect.placement.preview` | templateId + origin + direction, 15 Hz throttle, 300 ms TTL |
| Aura tokensInsideArea update | planned | `effect.aura.state` | effectId + insideIds + impacts, 5 Hz throttle, 500 ms TTL. DM/owner authority only. |

### Durable

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Effect placed | planned | `effect.place` | Template snapshot + origin + direction + casterId + mapId + aura fields |
| Effect dismissed (fade-out) | planned | `effect.dismiss` | effectId |
| Effect cancelled (revert modifiers) | planned | `effect.cancel` | effectId |
| Effect round tick (duration countdown) | planned | `effect.tick` | effectId + roundsRemaining. DM authority only. |

### Potential New Features

| Action | Layer | Description |
|--------|-------|-------------|
| Effect modifier sync | Durable | Sync stat modifiers applied by effects (deferred until character state networking) |
| Effect template library sync | Durable | Share custom effect templates across clients |

---

## Already Implemented Summary

| Op Kind | Layer | Store | Notes |
|---------|-------|-------|-------|
| `token.drag.begin/update/end` | Ephemeral | dragPreviewStore | 20 Hz, 400 ms TTL |
| `presence` (join/leave) | Ephemeral | multiplayerStore | Protocol-level |
| `ping` | Ephemeral | — | Debug op |
| `chat.post` | Durable | — | Text chat |
| `token.move` | Durable | sessionStore | Position commit |
| `token.sync` | Durable | sessionStore | Bulk sync for late-join |

---

## Next Steps

1. **Review this matrix** — confirm classifications, add missing interactions, adjust status.
2. **Author `docs/EPHEMERAL-NETWORKING-PLAN.md`** — implementation plan for all Ephemeral items marked `planned` or `potential`.
3. **Implement Ephemeral layer** — wire up ops, handlers, throttling, TTL expiry.
4. **Author Durable plan** — separate document for the ordered/acked/snapshotted layer.
