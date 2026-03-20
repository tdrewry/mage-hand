/**
 * Feature flags for in-flight or experimental features.
 * Toggle here to enable/disable without a full code change.
 */

/**
 * STEP-005: canvas.forceRedraw ephemeral broadcast.
 * When true, the DM broadcasts a canvas repaint command to all connected
 * clients after map switches and other bulk operations.
 * Set to false to disable and diagnose remote token drag flickering.
 */
export const FEATURE_CANVAS_FORCE_REDRAW = true;

/**
 * CANVAS DRAG: Live broadcast of canvas entity drag positions to connected clients.
 *
 * When TRUE — connected peers see region/mapObject drags move in near-real-time
 * via WebRTC ephemeral (region.drag.update). Broadcasts are throttled to
 * CANVAS_DRAG_BROADCAST_FPS frames per second to limit Jazz transaction pressure.
 *
 * When FALSE (default) — only the primary region's drag.update is emitted (existing
 * single-region live preview path). EntityGroup sibling positions and mapObjects
 * are committed silently on mouseup via Jazz CRDT sync. No per-frame store writes.
 *
 * Set to TRUE only once the action-owner guard pattern is implemented to prevent
 * observer clients from writing dragged positions back into the CRDT.
 */
export const FEATURE_CANVAS_DRAG_LIVE_PREVIEW = false;

/**
 * FPS cap for canvas drag broadcasts when FEATURE_CANVAS_DRAG_LIVE_PREVIEW is true.
 * Applies to both ephemeral region.drag.update sibling broadcasts AND
 * per-frame EntityGroup mapObject/light Zustand writes during drag.
 * Default: 15 fps  (~67ms between updates).
 * Lower = less Jazz traffic, higher lag. Higher = smoother, more traffic.
 */
export const CANVAS_DRAG_BROADCAST_FPS = 15;

/**
 * Per-kind Jazz sync throttle windows (milliseconds).
 *
 * Controls the trailing-edge debounce in `throttledPushFineGrained()` in bridge.ts.
 * Each key matches a "kind" string passed to that function.
 *
 * Lower values = changes reach Jazz (and connected clients) faster.
 * Higher values = more coalescing, fewer Jazz writes, lower throughput cost.
 *
 * Design intent:
 *  - regions / mapObjects: keep low (≤50ms) so drag-drop commits arrive atomically
 *    in a single Jazz sync cycle. The old 1000ms was causing 5-6s sequential
 *    client-side "population" of dragged region groups.
 *  - effects / illumination / customTemplates: can be higher — these change less
 *    frequently and don't need sub-frame commit latency.
 *
 * NOTE: flushPendingSync(kind) in bridge.ts bypasses this timer entirely for
 * time-critical paths like drag-commit — use that for guaranteed immediate sync.
 */
export const JAZZ_SYNC_THROTTLE_MS: Record<string, number> = {
    regions: 1,   // ~1 frame — drag commits land fast
    mapObjects: 12,   // ~1 frame — walls/doors group drag commits
    effects: 200,   // aura/effect updates
    illumination: 200,   // light changes
    customTemplates: 500,   // rarely updated
};
