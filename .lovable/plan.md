

# Networking Layer Classification Matrix & Ephemeral Implementation Plan

## What We're Doing

This is a two-step effort:

1. **Step 1 (this plan):** Create `docs/NETWORKING-MATRIX.md` -- a comprehensive classification of every user interaction in the VTT, sorted into Ephemeral vs Durable layers, plus a "Potential New Features" section for interactions we don't yet support.

2. **Step 2 (after your review of the matrix):** Author `docs/EPHEMERAL-NETWORKING-PLAN.md` with the implementation plan for wiring up every Ephemeral item.

We will not implement any code in this plan -- the deliverable is the matrix document for your review and refinement.

---

## Matrix Categories (based on actual stores and features)

The matrix will cover these sections, populated from real features found in the codebase:

### 1. Tokens (sessionStore)
- **Ephemeral:** drag preview (already implemented), rotate/scale handle preview, hover highlights, selection box/lasso, movement path preview during drag, targeting reticle position (actionStore.targetingMousePos)
- **Durable:** create/delete, move commit, resize commit, label/name/color changes, image changes, illumination source edits, vision settings, ownership/roleId, hidden flag, appearance variant switches, entity ref updates, notes/statblock edits, path style changes
- **Potential New:** intent indicators ("player is about to move X"), token rotate commit

### 2. Map & Camera (mapStore, regionStore, viewportTransforms)
- **Ephemeral:** camera pan/zoom/viewport (per-client, already local-only), ping/laser pointer, GM "focus here" pointer, tool cursor broadcast
- **Durable:** map create/delete/update, region create/delete/update (polygon edits, grid settings, textures), map reorder, active map selection (if shared)
- **Potential New:** ping/laser pointer, GM focus pointer, tool cursor broadcast

### 3. Map Objects (mapObjectStore)
- **Ephemeral:** drag preview while repositioning, door toggle preview
- **Durable:** create/delete, position/size/rotation commits, door open/close commit, bulk operations, category/style changes
- **Potential New:** drag preview for map objects

### 4. Fog of War & Vision (fogStore, lightStore, illuminationStore)
- **Ephemeral:** realtime vision during drag (already local-only), fog brush cursor preview, temporary reveal preview
- **Durable:** fog enable/disable, reveal-all toggle, fog opacity settings, explored areas geometry, vision range defaults, light source create/delete/update, ambient light/shadow intensity
- **Potential New:** fog brush cursor preview, reveal preview before commit

### 5. Chat & Dice (diceStore)
- **Ephemeral:** typing indicator, "user is rolling" spinner
- **Durable:** dice roll results (already synced via syncPatch), chat messages (already via chat.post op), pinned formulas
- **Potential New:** typing indicator, rolling indicator

### 6. Initiative & Combat (initiativeStore)
- **Ephemeral:** dragging initiative entry preview (reorder handle), current-turn hover highlight
- **Durable:** start/end combat, add/remove combatant, reorder commit, advance turn, round number, initiative values, restrict movement toggle
- **Potential New:** initiative reorder drag preview

### 7. Groups (groupStore)
- **Ephemeral:** group selection preview, group drag preview
- **Durable:** group create/delete, member add/remove, group transforms commit
- **Potential New:** group drag preview

### 8. Roles & Permissions (roleStore)
- **Ephemeral:** "request control" / hand raise, presence metadata ("is editing map")
- **Durable:** role create/update/delete, hostility settings, permission changes, token role assignments
- **Potential New:** hand raise, editing-state presence

### 9. Actions & Combat Resolution (actionStore)
- **Ephemeral:** targeting reticle position, resolution flash effects, "action in progress" indicator
- **Durable:** action resolution results, attack history entries
- **Potential New:** networked targeting reticle, networked resolution flashes

### 10. UI Mode & Presence (uiModeStore, multiplayerStore)
- **Ephemeral:** user cursor position, "user is viewing map X" indicator, connected/disconnected presence events (already implemented)
- **Durable:** DM/play mode switch (RPC), user kick/ban
- **Potential New:** cursor sharing, "viewing map X" indicator

### 11. Assets
- **Ephemeral:** upload progress, loading states
- **Durable:** asset registered (hash, size, mime), token/region image references (via imageHash/textureHash)
- **Potential New:** upload progress broadcast

---

## Already Implemented (Ephemeral)

- Token drag preview (`token.drag.begin/update/end` ops + dragPreviewStore)
- Presence join/leave (via WebSocket protocol `presence` messages)
- Ping op (debug)
- Chat post op
- Token move op
- Token sync op

---

## Document Structure

The `docs/NETWORKING-MATRIX.md` file will use this format:

```text
# VTT Networking Classification Matrix

## How to Read This Document
- Ephemeral: high-frequency, lossy, TTL-based, not in snapshots/undo
- Durable: authoritative, ordered, acked, snapshotable, replayable
- Status: [implemented] [planned] [potential]

## 1. Tokens
### Ephemeral
| Action | Status | Notes |
|--------|--------|-------|
| Token drag preview | implemented | 20Hz throttle, 400ms TTL |
| ... | ... | ... |

### Durable
| Action | Status | Notes |
|--------|--------|-------|
| Token create/delete | planned | ... |
| ... | ... | ... |

(repeat for each category)

## Potential New Features
### Ephemeral
| Action | Category | Description |
...
### Durable
| Action | Category | Description |
...
```

---

## Technical Notes

- The matrix document will be saved as `docs/NETWORKING-MATRIX.md`
- No code changes in this step
- Version bump will happen when we implement Step 2
- After you review and refine the matrix, we proceed to `docs/EPHEMERAL-NETWORKING-PLAN.md`

