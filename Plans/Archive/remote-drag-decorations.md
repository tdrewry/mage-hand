# Remote Drag Decorations (v0.7.162 → v0.7.163)

## Problem (v0.7.162)
After removing the ghost preview system (v0.7.161), remote clients only saw the token moving but
missed the drag decorations (ghost-at-origin, path trail, distance labels) that the local dragger sees.

## Solution (v0.7.162)
Created a lightweight `remoteDragStore` that tracks only decoration metadata (startPos, path, mode, userId)
per token — not a parallel rendering pipeline. The token itself still moves via `updateTokenPosition()`.

Added `drawRemoteDragDecorations()` in SimpleTabletop that renders the same visuals as the local drag:
- Ghost token at start position (origin marker)
- Straight-line distance indicator
- Movement path (footprints, dashed, or solid — matching token's path style settings)
- Path distance label near origin

## Problem (v0.7.163)
1. Remote drag decorations did not clear immediately when a drag ended — persisted until the
   tabletop was interacted with. Root cause: `token.drag.end` is a fire-once ephemeral message;
   if lost or delayed, remote clients had no cleanup mechanism.
2. Token metadata changes (label, color, path style, appearance, size) were not synced live —
   remote clients only received updates on explicit card save.

## Solution (v0.7.163)
### Staleness auto-clear
- Added `lastUpdateMs` timestamp to each `RemoteDragState` entry
- Added `expireStale(maxAgeMs)` method to `remoteDragStore`
- `tokenHandlers.ts` runs a 1-second interval that auto-clears drags stale for >3 seconds
- Acts as a safety net alongside the normal `token.drag.end` handler

### Token metadata sync
- Added `token.meta.sync` ephemeral op kind (throttled 200ms, TTL 2s, entityId keyed)
- Handler in `tokenHandlers.ts` merges metadata fields into local token (excluding position)
- `emitTokenMetaSync(tokenId)` helper in `dragOps.ts` broadcasts current token metadata
- Strips position, imageUrl, and statBlockJson to keep payloads small

## Files Changed
| File | Change |
|------|--------|
| `src/stores/remoteDragStore.ts` | Added `lastUpdateMs`, `expireStale()` |
| `src/lib/net/ephemeral/tokenHandlers.ts` | Staleness interval + `token.meta.sync` handler |
| `src/lib/net/ephemeral/types.ts` | Added `token.meta.sync` op kind, payload, config |
| `src/lib/net/ephemeral/index.ts` | Re-export `TokenMetaSyncPayload` |
| `src/lib/net/dragOps.ts` | Added `emitTokenMetaSync()` helper |
| `src/lib/version.ts` | Bumped to 0.7.163 |

## Impact on External Services
None — all client-side changes. WebSocket server relays these as generic ephemeral ops.
The `token.meta.sync` op kind is new but the server treats all ephemeral ops the same (broadcast).
