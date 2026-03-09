

# Lifecycle-Based Drag/Placement Previews (v0.7.155)

## Concept

You're right. Drag and placement interactions have explicit start/stop semantics. The current approach of using TTL as the primary display mechanism is backwards -- it forces us to inflate TTL values (5000ms) as a workaround, which is both fragile and wasteful.

The correct model:
- **`begin`**: Creates the preview. No TTL -- it persists until explicitly ended.
- **`update`**: Refreshes position/path data. No TTL on the cache entry.
- **`end` / `cancel`**: Removes the preview immediately.
- **TTL**: Only used as a **safety net** for disconnect/crash recovery (e.g., 30s). Not the display mechanism.

This applies to three interaction families:
1. **Token drag** (`token.drag.begin/update/end`)
2. **Effect placement preview** (`effect.placement.preview` + placement/cancel as stop)
3. **Region/MapObject drags** (`region.drag.update`, `mapObject.drag.update`) -- these lack explicit begin/end today but can adopt the same pattern later

## Changes

### 1. TTL config adjustments (`src/lib/net/ephemeral/types.ts`)
Set `ttlMs: 0` (never expires) for lifecycle-managed ops:
- `token.drag.begin`: `ttlMs: 0` (was 5000)
- `token.drag.update`: `ttlMs: 0` (was 5000)
- `token.drag.end`: keep at 400ms (it's the termination signal itself -- short TTL is fine)
- `effect.placement.preview`: `ttlMs: 0` (was 5000)

### 2. Drag preview store cleanup (`src/stores/dragPreviewStore.ts`)
- Remove the `expireStale()` method entirely -- it's no longer needed since previews don't expire by TTL
- The `endDrag` and `clearUser` methods remain as the explicit cleanup paths

### 3. Remove stale-sweep interval from SimpleTabletop (`src/components/SimpleTabletop.tsx`)
- Find and remove the `setInterval` that calls `expireStale()` on the drag preview store
- Previews are now cleared only by `token.drag.end` or `clearUser` on disconnect

### 4. Effect placement preview lifecycle
- Currently `effect.placement.preview` has no explicit "stop" event. Need to add cleanup: when a placement completes (`effect.place` durable op) or is cancelled (Escape/right-click), emit an empty `effect.placement.preview` payload (`{}` or `{ templateId: null }`) to clear the preview on remote clients
- The inbound handler in the relevant ephemeral handler should treat an empty/null templateId as a "clear" signal

### 5. Disconnect safety net
- The `clearUser()` method on drag preview store is already called on presence disconnect -- this remains the crash/disconnect recovery path
- For effect placement previews, ensure the `onCacheChange` listener (or disconnect handler) clears stale entries when a user disconnects

### 6. Version bump
`src/lib/version.ts` → `0.7.155`

### 7. Save plan
`Plans/lifecycle-drag-preview.md`

## Impact on External Services
- **WebSocket server**: No changes needed -- op kinds are unchanged, server is kind-agnostic
- **Jazz service**: Unaffected -- drag previews are ephemeral-only

## Net Result
- Fewer network calls (no keepalive/re-emission needed)
- Previews display reliably regardless of mouse pause duration
- Clean separation: lifecycle events control display, TTL is only a disconnect safety net

