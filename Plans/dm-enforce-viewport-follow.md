# DM Enforce Viewport Follow (v0.7.111)

## Feature
Added a DM toolbar button (ScanEye icon) that forces all connected players to follow the DM's viewport. When active, players' `followDM` is remotely enabled via an ephemeral op, locking their pan/zoom to the DM's broadcast.

## Implementation
1. **New ephemeral op**: `map.dm.enforceFollow` with `{ enforce: boolean }` payload, DM-only
2. **Store**: Added `enforceFollowDM` flag to `mapEphemeralStore` for DM-side toggle state
3. **Handler**: `mapHandlers.ts` listens for `map.dm.enforceFollow` and sets `followDM` on player clients
4. **UI**: ScanEye button in `CircularButtonBar`, visible only to DMs, toggles enforce and broadcasts

## Files Changed
- `src/lib/net/ephemeral/types.ts` — added `map.dm.enforceFollow` op kind, payload, config
- `src/lib/net/ephemeral/mapHandlers.ts` — handler for enforce follow op
- `src/stores/mapEphemeralStore.ts` — added `enforceFollowDM` state
- `src/components/CircularButtonBar.tsx` — DM enforce follow button
- `src/lib/version.ts` — bumped to 0.7.111

## Impact
- **WebSocket server**: Must be restarted to recognize the new ephemeral op kind
- **Jazz service**: No impact
