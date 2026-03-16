# Token Drag Preview Ops

## Overview
Adds `token.drag.begin`, `token.drag.update`, `token.drag.end` op kinds over the existing WS op-batch plumbing. These are broadcast-only (no server authority) and enable remote clients to see live drag previews.

## Files Changed
- `src/stores/dragPreviewStore.ts` — new ephemeral Zustand store for remote drag previews
- `src/lib/net/dragOps.ts` — emit helpers with 50ms throttle for updates
- `src/lib/net/OpBridge.ts` — register handlers for the 3 new op kinds
- `src/components/SimpleTabletop.tsx` — emit ops on drag start/move/end + render remote previews

## Payload Shapes
- `token.drag.begin`: `{ tokenId, startPos: {x,y}, mode }`
- `token.drag.update`: `{ tokenId, pos: {x,y}, path?: [{x,y}...] }`
- `token.drag.end`: `{ tokenId, finalPos: {x,y} }`

## Lifetime Rules
- Previews expire after 400ms with no update
- Cleared on `drag.end` or presence disconnect
- Expiry sweep runs via setInterval in SimpleTabletop
