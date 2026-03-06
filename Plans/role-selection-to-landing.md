# Role Selection Moved to Landing Screen

## Problem
Players were stuck in edit mode because:
1. Role selection happened AFTER the tabletop mounted (via RoleSelectionModal in SimpleTabletop)
2. The rendering mode was already initialized before the role was known
3. The CircularButtonBar hid the toggle for Players but didn't force play mode

## Solution
1. Moved username/role selection to the LandingScreen (before tabletop mounts)
2. `commitIdentityAndLaunch()` commits player identity and sets `renderingMode` based on role:
   - DM → keeps current mode (default: edit)
   - Player → forced to 'play'
3. Removed `RoleSelectionModal` from SimpleTabletop
4. All session actions (Continue, New, Load, Save) require identity to be set first
5. Load Session also enforces play mode for non-DM players after data import

## Files Changed
- `src/components/LandingScreen.tsx` - Added identity form, role-based mode initialization
- `src/components/SimpleTabletop.tsx` - Removed RoleSelectionModal import and usage
- `src/components/CircularButtonBar.tsx` - (v0.6.74) Already gated Edit button for non-DMs
- `src/lib/version.ts` - Bumped to 0.6.75
