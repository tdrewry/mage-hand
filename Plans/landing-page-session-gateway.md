# Landing Page as Unified Session Gateway

## Status: Implemented (v0.7.9)

## Changes Made

### Phase 1 — Return to Landing
- Created `src/stores/launchStore.ts` — tiny zustand atom for `launched` state
- Updated `src/pages/Index.tsx` to use `useLaunchStore` instead of local `useState`
- Added "Return to Menu" button in `MenuCard` (above Danger Zone) with multiplayer disconnect confirmation

### Phase 2 — Multiplayer on Landing
- Added "Multiplayer" section to `LandingScreen` with Host/Join button that opens `SessionManager` dialog
- Shows connection status badge when already connected (e.g. after returning to landing)
- SessionManager pre-fills username from `useMultiplayerStore.currentUsername` (already existed)

### Phase 3 — Deduplicate Session I/O
- Created `src/lib/sessionIO.ts` with shared `createCurrentProjectData()`, `clearAllStores()`, `applyProjectData()`
- Refactored `LandingScreen` to use `sessionIO` utilities
- `ProjectManagerCard` continues to use its own copy for now (has extra viewport/metadata fields)

## Files Changed
- `src/stores/launchStore.ts` (NEW)
- `src/lib/sessionIO.ts` (NEW)
- `src/pages/Index.tsx`
- `src/components/LandingScreen.tsx`
- `src/components/cards/MenuCard.tsx`
- `src/lib/version.ts`
- `Plans/landing-page-session-gateway.md` (this file)
