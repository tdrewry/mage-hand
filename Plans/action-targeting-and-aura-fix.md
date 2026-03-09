# Fix: Action Delivery, Preview Flickering, and Aura Sync (v0.7.158)

## Changes Made

1. **`action.queue.sync` — removed `dmOnly: true`** so player-initiated attacks/skill checks reach the DM.
2. **TTL → 0 for lifecycle-managed previews**: `token.hover`, `selection.preview`, `token.handle.preview`, `action.target.preview`, `effect.aura.state` — all now persist until explicitly cleared.
3. **Removed `onCacheChange` TTL cleanup** from `tokenHandlers.ts` — no more polling-driven preview erasure.
4. **Explicit clear signals** for `action.target.preview` emitted on `confirmTargets()`, `cancelAction()`, and Escape key.

## Impact
- No WebSocket server or Jazz service changes needed.
- All changes are client-side ephemeral config adjustments.
