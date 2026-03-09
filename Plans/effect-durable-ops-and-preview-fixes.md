# Effect Durable Ops & Preview Fixes (v0.7.151)

## Changes

### 1. Durable Ops for effect.place / effect.dismiss / effect.cancel
- Registered handlers in `OpBridge.ts` for `effect.place`, `effect.dismiss`, `effect.cancel`, and `effect.template.add`
- `effect.place` carries a full template snapshot so non-Jazz clients can reconstruct the effect
- Echo prevention: skips if effect already exists locally (by ID)
- `effect.template.add` uses direct `setState` to preserve original template ID

### 2. Outbound Op Emission from effectStore
- `placeEffect()` now emits `effect.place` durable op after local placement
- `dismissEffect()` emits `effect.dismiss`
- `cancelEffect()` emits `effect.cancel`
- `addCustomTemplate()` emits `effect.template.add` (with stripped texture data)
- All emissions use `emitLocalOp` which is suppressed when Jazz is active (via JAZZ_SYNCED_OPS)

### 3. JAZZ_SYNCED_OPS Updated
- Added `effect.place`, `effect.dismiss`, `effect.cancel`, `effect.template.add` to the suppression set in `src/lib/net/index.ts`

### 4. Placement Preview TTL Fix
- Increased `effect.placement.preview` TTL from 300ms to 5000ms in ephemeral config
- Previously, the preview ghost would vanish 300ms after mouse stopped moving
- Now persists for 5 seconds, giving adequate time between mouse movements

## Files Modified
- `src/lib/net/OpBridge.ts` — added 4 new durable op handlers
- `src/lib/net/index.ts` — expanded JAZZ_SYNCED_OPS
- `src/stores/effectStore.ts` — added durable op emissions
- `src/lib/net/ephemeral/types.ts` — increased placement preview TTL
- `src/lib/version.ts` — bumped to 0.7.151

## Impact on External Services
- **WebSocket server**: Will now receive and relay `effect.place`, `effect.dismiss`, `effect.cancel`, and `effect.template.add` ops. No server changes needed — the server is op-kind agnostic.
- **Jazz service**: No changes — these ops are suppressed when Jazz is active.
