# Zoom Perf, Fog Toolbar, Always-One-Map Invariant (v0.7.104)

## Changes

### 1. Zoom Performance Fix
**Problem**: After DM fog rendering was enabled (v0.7.103), every zoom frame triggered a full Canvas 2D fog redraw + PixiJS texture upload because the throttle was bypassed for zoom changes.

**Fix**: Applied a 33ms (~30fps) throttle for zoom frames in `fogPostProcessing.ts` instead of bypassing throttle entirely. Pan fast-path (CSS offset) still runs at full speed.

### 2. Toolbar Fog Button Targets Active Map
**Change**: The CloudFog button in VerticalToolbar now directly toggles fog enabled/disabled for the current active map (via `selectedMapId`), instead of just opening the FogControlCard panel. The `isActive` state reflects whether fog is actually enabled on the current map.

### 3. Always-One-Active-Map Invariant
**Changes**:
- `createDefaultMap()` now generates unique IDs and uses empty name (unnamed map)
- `removeMap()` auto-creates a new unnamed map if the last map is removed
- Initial session starts with an unnamed map with a unique ID
- fogStore no longer hardcodes `'default-map'` in initial state — fog settings are created on-demand via `initMapFogSettings`/`getMapFogSettings` fallback
