# Remote Drag Decorations (v0.7.162)

## Problem
After removing the ghost preview system (v0.7.161), remote clients only saw the token moving but
missed the drag decorations (ghost-at-origin, path trail, distance labels) that the local dragger sees.

## Solution
Created a lightweight `remoteDragStore` that tracks only decoration metadata (startPos, path, mode, userId)
per token — not a parallel rendering pipeline. The token itself still moves via `updateTokenPosition()`.

Added `drawRemoteDragDecorations()` in SimpleTabletop that renders the same visuals as the local drag:
- Ghost token at start position (origin marker)
- Straight-line distance indicator
- Movement path (footprints, dashed, or solid — matching token's path style settings)
- Path distance label near origin

## Files Changed
| File | Change |
|------|--------|
| `src/stores/remoteDragStore.ts` | New lightweight store for remote drag metadata |
| `src/lib/net/ephemeral/tokenHandlers.ts` | Populate remoteDragStore on begin/update/end |
| `src/components/SimpleTabletop.tsx` | Subscribe + drawRemoteDragDecorations at path & ghost phases |
| `src/lib/version.ts` | Bumped to 0.7.162 |

## Impact on External Services
None — all client-side rendering changes.
