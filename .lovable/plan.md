

# Landing Page as Unified Session Gateway — Behavior Analysis & Plan

## Current State Summary

The application has **three separate locations** handling overlapping concerns:

| Capability | LandingScreen | MenuCard | SessionManager | ProjectManagerCard |
|---|---|---|---|---|
| Set username/role | Yes | - | Yes (username only) | - |
| Continue session | Yes | - | - | - |
| New session | Yes | - | - | - |
| Save to disk (.mhsession) | Yes | via ProjectManager | - | Yes |
| Load from disk | Yes | via ProjectManager | - | Yes |
| Save to localStorage | - | via ProjectManager | - | Yes |
| Host multiplayer | - | opens SessionManager | Yes | - |
| Join multiplayer | - | opens SessionManager | Yes | - |
| Leave multiplayer | - | - | Yes | - |
| Transport selector | - | - | Yes | - |
| Session status/badge | - | Yes (basic) | Yes (detailed) | - |
| Return to landing | - | **MISSING** | - | - |
| About/version | Yes | - | - | - |
| Export DO archive | - | - | - | Yes |
| Import DO archive | - | - | - | Yes |
| Templates | - | - | - | Yes |
| Auto-save controls | - | - | - | Yes |
| Session history | - | - | - | Yes |

## Cross-Cutting Decisions to Unify

### 1. Identity is established in TWO places
LandingScreen has full username + role selection. SessionManager also asks for username. These should share state — if identity is set on landing, SessionManager should pre-fill it.

### 2. "Return to Landing" is missing
There is no way to go back to the landing page from the tabletop. The `launched` state in `Index.tsx` is a simple boolean with no reverse path.

### 3. Session file I/O is duplicated
LandingScreen and ProjectManagerCard both implement save/load with nearly identical `createCurrentProjectData()` and `applyProjectData()` logic (~200 lines each).

### 4. Multiplayer is hidden behind two clicks
From landing, there's no way to host or join a session. Users must launch first, open Menu, then open SessionManager.

## Proposed Changes

### Phase 1: Add "Return to Landing" (small, high-value)
- Add a `setLaunched` callback or expose it via a lightweight store/context so the MenuCard can set `launched = false`
- Add a "Return to Menu" button in MenuCard's top section
- When returning, optionally disconnect from multiplayer with confirmation

### Phase 2: Add Multiplayer section to LandingScreen
- Add a collapsible "Multiplayer" section below the identity block with Host / Join buttons
- Reuse the existing `SessionManager` component as a dialog (it already is one) — just add a trigger button on the landing page
- If already connected (e.g. returning to landing), show session status and Leave button

### Phase 3: Deduplicate session I/O (optional refactor)
- Extract the shared `createCurrentProjectData()` and `clearAllStores()` into a shared utility (e.g. `src/lib/sessionIO.ts`)
- Both LandingScreen and ProjectManagerCard import from it
- This is a code-health improvement, not user-facing

## Implementation Details

### Phase 1 — Return to Landing
**Files changed:**
- `src/pages/Index.tsx` — lift `setLaunched` into a callback passed to SimpleTabletop, or use a tiny zustand atom
- `src/components/cards/MenuCard.tsx` — add "Return to Menu" button above or below Danger Zone
- Disconnection prompt if multiplayer is active

### Phase 2 — Multiplayer on Landing
**Files changed:**
- `src/components/LandingScreen.tsx` — add a "Multiplayer" menu item that opens `SessionManager` dialog, plus connection status badge if already connected
- `src/components/SessionManager.tsx` — pre-fill username from the identity block (minor: read from props or sessionStore)

### Phase 3 — Deduplicate (optional)
**Files changed:**
- Create `src/lib/sessionIO.ts` with shared `createCurrentProjectData()`, `clearAllStores()`, `applyProjectData()`
- Refactor LandingScreen and ProjectManagerCard to use it

### Version bump
- `src/lib/version.ts` — bump to `0.7.9`

### Plan file
- Save to `Plans/landing-page-session-gateway.md`

## Recommended order
Phase 1 first (return to landing), then Phase 2 (multiplayer on landing). Phase 3 is optional cleanup that can happen anytime.

