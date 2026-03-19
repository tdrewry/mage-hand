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
