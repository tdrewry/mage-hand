# Comprehensive Sync Completion Plan (v0.7.115)

## Implemented

### 1. Chat Log Fix — Echo Prevention
- **File**: `src/lib/net/ephemeral/EphemeralBus.ts`
- **Fix**: Changed `if (userId === localUserId) return` to `if (localUserId && userId === localUserId) return`
- **Why**: When `currentUserId` is null on both sender and receiver, `null === null` filtered ALL inbound messages as self-echoes
- **Remaining**: Verify WebSocket server relays `chat.message` ops (external)

### 2. Portal & Map Activation Sync (NEW)
- **Files**: `types.ts`, `mapHandlers.ts`, `mapEphemeralStore.ts`, `index.ts`
- **New ops**: `map.dm.selectMap` (dmOnly, session-scoped) and `portal.activate` (entityId-scoped)
- **Handlers**: Player receives `map.dm.selectMap` → calls `setSelectedMap(mapId)`. Portal activation stored in `mapEphemeralStore.portalActivations`
- **Emitters**: `emitMapSelectMap(mapId)`, `emitPortalActivate(objectId)` exported from index
- **Remaining**: Wire emitters into `executeTeleport` in SimpleTabletop.tsx

### 3. Effect Texture Resolution on Join
- **File**: `src/lib/jazz/bridge.ts`
- **Added**: `_resolveEffectTextures()` — mirrors `_resolveRegionTextures` pattern
- Called at the end of `pullEffectsFromJazz()` after restoring custom templates
- Resolves `textureHash` → IDB lookup → update template texture field
- Falls back to `requestTextureViaJazz()` for missing textures

### 4. Effect Placement Preview Rendering
- **Files**: `effectHandlers.ts`, `miscEphemeralStore.ts`
- **Changed**: `effect.placement.preview` handler from no-op stub to active storage
- Remote placement ghosts stored in `miscEphemeralStore.effectPlacementPreviews` keyed by userId
- TTL cleanup wired for cache expiry
- **Remaining**: Render the stored previews in `effectRenderer.ts`

### 5. Action Sync Verification — CONFIRMED WORKING
- `broadcastActionPending()` called from `confirmTargets()` and `startEffectAction()`
- `broadcastActionResolved()` called from `commitAction()`
- `broadcastResolutionClaim()` called from `commitAction()` and `cancelAction()`
- `action.flash` emitted from `commitAction()` for each target
- `ActionPendingOverlay` reads from `actionPendingStore` — fully wired

### 6. Region Drag Preview Emitters
- **File**: `mapHandlers.ts`
- **Added**: `emitRegionDragUpdate(regionId, pos)` exported
- **Existing**: `emitRegionHandlePreview()` already exported
- **Remaining**: Call emitters from SimpleTabletop.tsx drag interaction code

## Remaining Work (requires SimpleTabletop.tsx changes)

1. **Wire `emitMapSelectMap`** into portal teleport and DM map switch
2. **Wire `emitPortalActivate`** into portal activation flash
3. **Wire `emitRegionDragUpdate`** into region drag mousemove handler
4. **Render remote effect placement previews** in effectRenderer.ts using miscEphemeralStore — ✅ DONE (v0.7.117)

## External Impact

- **WebSocket server**: Must relay `map.dm.selectMap`, `portal.activate`, and all ephemeral ops. If using an op-kind whitelist, add the two new kinds.
- **Jazz service**: No changes needed.
