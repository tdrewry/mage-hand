# DM Portal Teleport Approval System

## Summary
Non-DM players no longer auto-teleport when entering a portal. Instead, a request is sent to the DM who can approve or deny. On approval, the teleport executes on all clients with full map tree sync.

## Ephemeral Ops Added
- `portal.teleport.request` — Player → DM: request to teleport through a portal
- `portal.teleport.approved` — DM → All: approval with map state sync payload
- `portal.teleport.denied` — DM → All: denial with optional reason

## Flow
1. Player drops token on portal → `portal.teleport.request` sent
2. DM sees approval dialog (shows requesting player name)
3. DM approves → `executeTeleport()` runs locally, `portal.teleport.approved` broadcast
4. All clients receive approval → execute teleport, sync map activations & selected map
5. DM denies → `portal.teleport.denied` broadcast, player sees toast

## Files Changed
- `src/lib/net/ephemeral/types.ts` — New op kinds and payload types
- `src/lib/net/ephemeral/mapHandlers.ts` — Emit helpers for new ops
- `src/lib/net/ephemeral/index.ts` — Re-exports
- `src/components/SimpleTabletop.tsx` — Request/approval/denial flow + dialog updates

## Impact
- **WebSocket Server**: New ephemeral op kinds pass through as-is (no server changes needed since ephemeral ops are generic `{ kind, data }` envelopes)
- DM approval dialog button text changed from "Teleport" to "Approve Teleport" and "Cancel" to "Deny"
