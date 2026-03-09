

# Fix: Action Delivery, Preview Flickering, and Aura Sync

## Root Causes Identified

### 1. Player attacks never reach the DM
`action.queue.sync` is marked `dmOnly: true` in `EPHEMERAL_OP_CONFIG` (types.ts line 602). When a player calls `startSkillCheck()` or `startAttack()`, the store subscriber at line 793 fires `broadcastActionQueue()` which emits `action.queue.sync` — but the `dmOnly` gate in `EphemeralBus.emit()` blocks the emission because the player doesn't have the "dm" role. The action never leaves the player's client.

### 2. Targeting reticle and token previews vanish (TTL expiry)
- `action.target.preview` has `ttlMs: 500` — the reticle disappears 500ms after the last mouse move
- The `onCacheChange` listener in `tokenHandlers.ts` (lines 87-103) removes `action.target.preview` entries on TTL expiry, clearing the reticle from the canvas
- Same issue affects `token.hover` (`ttlMs: 500`), `selection.preview` (`ttlMs: 400`), and `token.handle.preview` (`ttlMs: 400`)

### 3. Auras/effects only visible after hard refresh
- `effect.aura.state` has `ttlMs: 500` — aura state expires after just 500ms of no updates
- Placed effects sync via Jazz/durable ops but the template fallback (implemented in v0.7.154) only fires on Jazz hydration, not on initial placement via `effect.place` durable op
- The OpBridge `effect.place` handler already works, but the combination of short aura TTL and template sync race means auras appear briefly then vanish

## Fixes

### Fix 1: Remove `dmOnly` from `action.queue.sync` (types.ts)
This op must flow from **any** role to the DM. The DM-only gate is incorrect — it should be receivable by DMs but emittable by anyone. Change `dmOnly: true` → remove `dmOnly` (or set `false`).

Also: `action.pending` and `action.resolved` are broadcast *by* the DM *to* players — `dmOnly: true` is correct for those. `action.inProgress` has no `dmOnly` flag, which is correct since players can initiate targeting.

### Fix 2: Convert `action.target.preview` to lifecycle model (types.ts + tokenHandlers.ts)
- Set `ttlMs: 0` for `action.target.preview` — the reticle persists until targeting ends
- In `tokenHandlers.ts`, handle clear: when `action.target.preview` arrives with null/empty pos, call `removeActionTarget(userId)`
- In `SimpleTabletop.tsx`, emit a clear signal when targeting ends (confirmTargets, cancelAction)
- Remove the `action.target.preview` branch from the `onCacheChange` TTL listener

### Fix 3: Convert remaining TTL-reliant previews to lifecycle or extend TTL (types.ts + tokenHandlers.ts)
- `token.hover`: set `ttlMs: 0` — hover persists until explicitly cleared (null tokenId already serves as clear signal)
- `selection.preview`: set `ttlMs: 0` — selection persists until explicitly cleared (empty payload = clear)
- `token.handle.preview`: set `ttlMs: 0` — handle preview persists until drag ends
- Remove corresponding branches from `onCacheChange` listener (lines 87-103 in tokenHandlers.ts) since these are now lifecycle-managed

### Fix 4: Extend `effect.aura.state` TTL (types.ts)
- Set `ttlMs: 0` for `effect.aura.state` — aura state is broadcast at 5Hz by the authoritative client; it persists until the aura is dismissed or the owner disconnects
- Disconnect cleanup via `clearUser` already handles the crash case

### Fix 5: Emit clear signals for action targeting (SimpleTabletop.tsx + actionStore.ts)
- When `confirmTargets()` or `cancelAction()` fires, emit `action.target.preview` with `{ sourceTokenId: '', pos: { x: 0, y: 0 } }` to clear remote reticles
- Guard: only emit clear if `isTargeting` was true before the action

## Files to Change

| File | Changes |
|------|---------|
| `src/lib/net/ephemeral/types.ts` | Remove `dmOnly` from `action.queue.sync`; set `ttlMs: 0` for `action.target.preview`, `token.hover`, `selection.preview`, `token.handle.preview`, `effect.aura.state` |
| `src/lib/net/ephemeral/tokenHandlers.ts` | Remove entire `onCacheChange` block (lines 87-103) — all token previews are now lifecycle-managed; add clear handling for `action.target.preview` with empty payload |
| `src/stores/actionStore.ts` | Emit clear `action.target.preview` on `confirmTargets()` and `cancelAction()` |
| `src/components/SimpleTabletop.tsx` | Emit clear `action.target.preview` on Escape when targeting |
| `src/lib/version.ts` | Bump to `0.7.158` |
| `Plans/action-targeting-and-aura-fix.md` | Document changes |

## Impact on External Services
None — all changes are client-side ephemeral config. No WebSocket server or Jazz service changes needed.

