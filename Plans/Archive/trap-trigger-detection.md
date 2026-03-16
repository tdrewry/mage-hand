# Trap Trigger Detection Plan

## Summary
When a token finishes moving (drag-end), check if its final position overlaps any persistent effect on the same map. If so, auto-open the Action Card with the token as an impacted target.

## Implementation
- Added `checkTrapTrigger(tokenId)` callback in SimpleTabletop.tsx
- Called after `checkPortalTeleport` at both mouse and touch drag-end points
- Uses `computeEffectImpacts` from effectHitTesting.ts to test the single moved token against all persistent effects on the current map
- On hit: opens Action Card via cardStore, calls `startEffectAction` with the single token impact
- Only triggers on the first matching effect per move (break after first hit)
- Grid size determined from the region the token is in, falling back to 40px default

## Version
- APP_VERSION bumped to 0.5.68
