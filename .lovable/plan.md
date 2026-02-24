

# Updates to NETWORKING-MATRIX.md

Four additions to the matrix document, placed in the appropriate sections:

---

## 1. Map Objects & Regions -- Drag and Transformation Previews

**Section 2 (Map & Camera) -- Ephemeral table**, add these rows:

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Region drag preview | planned | `region.drag.update` | Ghost position during region reposition, 20 Hz throttle, 400 ms TTL |
| Region resize / rotate handle preview | planned | `region.handle.preview` | Broadcast handle position while dragging transform handles |
| Map object drag preview | planned | `mapObject.drag.update` | Ghost position during reposition, 20 Hz throttle, 400 ms TTL |
| Map object rotate / scale handle preview | planned | `mapObject.handle.preview` | Broadcast handle position while dragging transform handles |

These are also currently listed in Section 3 (Map Objects) as `potential`. They will be upgraded to `planned` there and the duplicates in Section 2 provide the cross-reference since regions and map objects both live on the canvas alongside the map.

**Section 3 (Map Objects) -- Ephemeral table**: update `Map object drag preview` status from `potential` to `planned`.

---

## 2. DM Broadcast Pan/Zoom

**Section 2 (Map & Camera) -- Ephemeral table**, replace the existing "Camera pan / zoom / viewport" row and add a new row:

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Camera pan / zoom / viewport (personal) | N/A (local-only) | -- | Per-client, never networked |
| DM broadcast pan / zoom to point | planned | `map.dm.viewport` | DM sends { x, y, zoom }; all connected clients (including other DMs) match the viewport. 10 Hz throttle, fires on DM action only. |

This belongs in Ephemeral because it is a transient viewport command -- if a frame is dropped the next update corrects it. It is not stored in snapshots or undo history.

---

## 3. Connected Player Cursors (with DM hide/show control)

**Section 10 (UI Mode & Presence) -- Ephemeral table**, update the existing `User cursor position` row and add a control row:

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| Connected player cursors | planned | `cursor.update` | userId + world x,y + color, 15 Hz throttle, 500 ms TTL. DM cursor hidden by default. |
| DM toggle cursor visibility | planned | `cursor.visibility` | DM sends show/hide flag; all clients respect it. Persists for session duration only (ephemeral). |

The cursor rendering itself is ephemeral (high frequency, safe to drop). The DM's hide/show toggle is also ephemeral -- it controls a transient UI state that does not need to survive a full session restart. On reconnect, the server can re-broadcast the current flag as part of the presence handshake.

Remove the duplicate "Cursor sharing" entry from the Potential New Features table in Section 10 since it is now `planned`.

---

## 4. DM Mode Switch Enforcement

**Section 10 (UI Mode & Presence) -- Durable table**, update the existing `DM / play mode switch` row:

| Action | Status | Op Kind | Notes |
|--------|--------|---------|-------|
| DM / play mode switch (enforced) | planned | `session.mode` | RPC-style. DM sets mode for all connected clients. Non-DM players cannot select "edit" without DM approval. Other DM-role users may independently select edit mode. Enforced server-side via role check. |

This is correctly classified as **Durable** because:
- It changes authoritative session state that affects what all clients can do.
- It must survive reconnection (late-join clients need to know the current mode).
- It requires server-side permission enforcement (role check).

---

## Summary of All Edits

| Section | Table | Change |
|---------|-------|--------|
| 2. Map & Camera | Ephemeral | Add region drag/transform preview, map object drag/transform preview, DM broadcast pan/zoom |
| 2. Map & Camera | Ephemeral | Clarify personal camera row as local-only vs DM broadcast |
| 3. Map Objects | Ephemeral | Upgrade map object drag preview from `potential` to `planned` |
| 10. UI Mode | Ephemeral | Upgrade cursor to `planned` with DM hide/show control; add `cursor.visibility` row |
| 10. UI Mode | Durable | Update `session.mode` row with enforcement notes (DM-only, role-gated) |
| 10. UI Mode | Potential | Remove "Cursor sharing" (now planned) |

### Technical Details

- Version bump (`src/lib/version.ts`) will accompany this doc update.
- No code changes -- documentation only.

