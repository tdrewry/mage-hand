# Outbound Sync Baseline Fix & Texture Pipeline Verification (v0.7.108)

## Problem
1. **Portal/entity loss**: The v0.7.107 outbound region and mapObject subscriptions added eager `prevRegions = regions` / `prevMapObjects = mapObjects` at the end of the callback, violating the trailing-edge throttle contract. This caused the throttled diff function to use an incorrect baseline, leading to missed additions (portals) and incorrect removals.
2. **Region textures on player**: While the pipeline was correctly wired (`_applyTextureToEntities` + `_resolveRegionTextures`), the broken outbound baseline could prevent texture hash pushes from triggering at the right time.

## Root Cause
The outbound sync pattern explicitly requires that `prevRegions`/`prevMapObjects` is ONLY updated inside the throttled function after a successful sync. The comment "DON'T update prevRegions here" was in the original code. Adding eager updates outside the throttle meant:
- Rapid subscription fires would advance the baseline past intermediate states
- The throttled function (which only fires the LAST closure) would diff against an incorrect baseline
- This could miss entity additions that happened in intermediate states (portal loss)

## Fix
Removed the two lines:
```typescript
// REMOVED — breaks trailing-edge throttle diff contract:
prevRegions = regions;      // line 2065
prevMapObjects = mapObjects; // line 2182
```

The texture push triggers (`needsTexturePush`) still work correctly because they compare against the current `prevRegions`/`prevMapObjects` at call time, before the throttled fn fires.

## Files Changed
- `src/lib/jazz/bridge.ts` — removed eager baseline updates
- `src/lib/version.ts` — bumped to 0.7.108
