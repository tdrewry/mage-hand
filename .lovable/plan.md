

# Comprehensive Sync Completion Plan (v0.7.115+)

## Scope

Seven workstreams addressing sync gaps across: chat, auras, actions, effects, portals (including map activation via portal), and remaining audit items.

---

## 1. Chat Log Fix

**Root cause**: The plumbing is fully wired — `chatStore.addMessage()` → `emitChatMessage()` → `ephemeralBus.emit("chat.message")` → `_sendFn` → WebSocket. Inbound: `miscHandlers` `chat.message` handler → `chatStore.addRemoteMessage()`. The `_sendFn` is set in `src/lib/net/index.ts` line 28.

**Likely failures**:
- **Echo prevention**: `EphemeralBus.receive()` (line 157-158) skips when `userId === localUserId`. If the WebSocket server echoes the sender's own messages AND `currentUserId` matches, they get filtered. If `currentUserId` is null on both sides, `null === null` filters everything.
- **Server relay**: The WebSocket server must forward `chat.message` ops to other peers. If it only relays known durable ops, ephemeral ops drop silently.

**Fix steps**:
1. In `EphemeralBus.receive()`, guard against null-null echo: `if (localUserId && userId === localUserId) return;` — if localUserId is null/undefined, don't skip.
2. Verify the WebSocket server relays all op kinds (not just a whitelist). If it whitelists, add all ephemeral op kinds.
3. Add `console.debug` breadcrumbs in `emitChatMessage` and the inbound handler for debugging.

**Files**: `src/lib/net/ephemeral/EphemeralBus.ts`, WebSocket server (external)

---

## 2. Aura State Emission

**Current state**: `emitAuraState()` is already called in the animation loop (SimpleTabletop.tsx lines 4204-4223) after `tickAuras()` returns events. The handler is registered in `effectHandlers.ts`.

**Status**: **Already wired.** The only gap is that emission only fires when `entered.length > 0 || exited.length > 0` — initial state on join isn't broadcast. This is acceptable since effects sync durably via Jazz; the ephemeral layer only provides real-time delta updates.

**Remaining work**: None — verify it works once chat fix confirms ephemeral ops flow correctly.

---

## 3. Action Resolution Sync

**Current state**: `actionStore` syncs as a Jazz blob (`BLOB_SYNC_KINDS`). Ephemeral ops (`action.pending`, `action.resolved`, `action.resolution.claim`, `action.queue.sync`, `action.flash`) all have handlers in `miscHandlers.ts`.

**Verification needed**:
- Confirm `actionStore` methods (`resolveAction`, `addPendingAction`) call the appropriate ephemeral emitters.
- Confirm the `ActionPendingOverlay` component reads from `actionPendingStore`.

**Files to check**: `src/stores/actionStore.ts`, `src/components/ActionPendingOverlay.tsx`

---

## 4. Effect Texture Resolution on Join

**Problem**: When a player joins, `pullEffectsFromJazz` hydrates effect templates but doesn't resolve `textureHash` to local blob URLs (same bug as regions, fixed in v0.7.112).

**Fix**: After pulling effects, collect those with `textureHash`, look up in IDB, and for missing ones trigger Jazz FileStream download. Mirror the `_resolveRegionTextures` pattern.

**Files**: `src/lib/jazz/bridge.ts`

---

## 5. Portal Map Activation Sync (NEW)

**Problem**: When a DM teleports a token through a portal with `portalAutoActivateTarget`, the code calls `useMapStore.getState().updateMap(targetMapId, { active: true })` and `setSelectedMap(targetMapId)` — but this only updates the DM's local state. The map activation change propagates via Jazz (maps DO is authoritative), but `setSelectedMap` is local-only.

Additionally, the portal activation flash animation (`portalActivationsRef`) is purely local — remote clients don't see the swirl/pulse.

**Fix — two parts**:

### 5a. Map selection sync via ephemeral op
- Add new ephemeral op: `map.dm.selectMap` with payload `{ mapId: string }`, `dmOnly: true`, TTL 2000ms, `keyStrategy: "session"`
- Handler on player side: `useMapStore.getState().setSelectedMap(data.mapId)` + pan to center of target portal
- Emit from `executeTeleport` after `setSelectedMap`, and from `setSelectedMap` action in mapStore when DM changes focused map

### 5b. Portal activation flash sync via ephemeral op
- Add new ephemeral op: `portal.activate` with payload `{ objectId: string }`, TTL 1000ms, `keyStrategy: "entityId"`, throttle 100ms
- Handler: set `portalActivationsRef` on remote clients (needs to be exposed via a store or event)
- Emit from `executeTeleport` when setting `portalActivationsRef`

**Files**: `src/lib/net/ephemeral/types.ts`, `src/lib/net/ephemeral/mapHandlers.ts`, `src/components/SimpleTabletop.tsx`

---

## 6. Region Drag Preview Handlers

**Current state**: `region.drag.update` and `region.handle.preview` handlers are registered in `mapHandlers.ts` and store data in `mapEphemeralStore`. The outbound emitters exist (`emitRegionHandlePreview`).

**Gap**: The emitters are not called from the drag/resize interaction code in `SimpleTabletop.tsx`.

**Fix**: In the region drag handler and handle interaction code, call `emitRegionHandlePreview()` and emit `region.drag.update` during mousemove.

**Files**: `src/components/SimpleTabletop.tsx`

---

## 7. Effect Placement Preview Rendering

**Current state**: Outbound `effect.placement.preview` emission exists. Inbound handler is a no-op stub.

**Fix**: Store remote placement ghosts in an ephemeral store, render as semi-transparent previews in the effect renderer.

**Files**: `src/lib/net/ephemeral/effectHandlers.ts`, `src/stores/effectStore.ts` or new ephemeral store, `src/lib/effectRenderer.ts`

---

## Sync Audit Summary

| Feature | Durable | Ephemeral | Status |
|---------|---------|-----------|--------|
| Chat messages | -- | Fully wired | **Broken** (echo prevention or server relay) |
| Aura state | Jazz effects | `emitAuraState` in tick loop | **Working** |
| Action queue | Jazz blob | `action.*` handlers registered | **Verify call sites** |
| Effect textures | Jazz FileStream | -- | **Missing join-time resolution** |
| Portal teleport | Jazz mapObject sync | -- | **Map activation not synced** |
| Portal activation flash | -- | -- | **Not synced** |
| Region drag preview | -- | Handlers registered | **Emitters not called** |
| Effect placement preview | -- | Outbound exists | **Inbound is no-op** |
| Token scale/variants | Jazz token sync | -- | **Working** |
| Portals (data) | Jazz mapObject sync | -- | **Working** |

---

## Implementation Priority

1. **Chat fix** — small wiring fix, highest user impact
2. **Portal map activation sync** — new ephemeral op `map.dm.selectMap`
3. **Portal activation flash sync** — new ephemeral op `portal.activate`
4. **Effect texture resolution on join** — mirror region texture fix
5. **Action sync verification** — confirm call sites
6. **Region drag preview wiring** — call existing emitters
7. **Effect placement preview rendering** — implement inbound + render

---

## External Impact

- **WebSocket server**: Must relay `chat.message`, `map.dm.selectMap`, `portal.activate`, and all ephemeral op kinds. If using a whitelist, update it.
- **Jazz service**: No changes needed.

---

## Files to Create/Modify

- `src/lib/net/ephemeral/EphemeralBus.ts` — null-safe echo prevention
- `src/lib/net/ephemeral/types.ts` — new ops: `map.dm.selectMap`, `portal.activate`
- `src/lib/net/ephemeral/mapHandlers.ts` — handlers + emitters for new ops
- `src/lib/jazz/bridge.ts` — `_resolveEffectTextures` on pull
- `src/components/SimpleTabletop.tsx` — emit portal ops, wire region drag emitters
- `src/lib/version.ts` — version bump
- `Plans/comprehensive-sync-completion.md` — this plan

