# Initiative Auto-Focus Visibility Gate

## Overview
When initiative advances and auto-focus-follows-token is enabled, the map only recenters to the active token if that token is **visible** to the current player based on their role permissions and token visibility state.

## Behavior
- DM users (`canSeeAllFog`) always recenter — they can see everything.
- Non-DM players skip recentering if:
  - Their role cannot see the token (`canSeeToken` returns false — e.g., no `canSeeOtherTokens` and token isn't owned)
  - The token is hidden (`isHidden` flag) and the player lacks `canSeeHiddenTokens`

## Files Modified
- `src/components/SimpleTabletop.tsx` — Added visibility gate in auto-focus useEffect using `canSeeToken` from rolePermissions
- `src/lib/version.ts` — 0.5.39
