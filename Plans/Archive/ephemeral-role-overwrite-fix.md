# Ephemeral Role Overwrite Fix (v0.7.33)

## Problem
Three issues with Jazz tandem sessions:

1. **cursor.visibility not propagating**: When DM disables cursors, players still see DM cursor overlays
2. **Durable state not syncing**: Connected players don't receive map/region/token state
3. **"Sync to Players" button**: Was a TODO placeholder, did nothing

## Root Cause Analysis

### cursor.visibility
The `connectEphemeralOnly()` call in SessionManager didn't pass `roles` to the WS server. More critically, the `connected` event handler in `NetManager.wireEvents()` unconditionally overwrote `multiplayerStore.roles` with the server-assigned roles — erasing the `['dm']` roles that Jazz session creation had just set. This caused the `dmOnly` gate on `cursor.visibility` to block the emit.

### Durable state
The Jazz bridge's `pullAllFromJazz` should work on join, but the "Sync to Players" button was a hard TODO that did nothing.

## Changes

### NetManager.ts
- In `wireEvents()` connected handler: when in `ephemeralOnly` mode (Jazz tandem), skip overwriting `currentSession`, `roles`, and `permissions` — those are managed by Jazz session manager
- Self-user roleIds use the already-set multiplayerStore roles in ephemeral-only mode

### SessionManager.tsx
- Pass `roles` to `connectEphemeralOnly()` for both create and join flows

### MenuCard.tsx
- Implemented "Sync to Players" button: DM re-pushes all state via `pushAllToJazz()`
- Implemented "Request Sync" button: Player re-pulls all state via `pullAllFromJazz()`

## Files Modified
- `src/lib/net/NetManager.ts`
- `src/components/SessionManager.tsx`
- `src/components/cards/MenuCard.tsx`
- `src/lib/version.ts`
