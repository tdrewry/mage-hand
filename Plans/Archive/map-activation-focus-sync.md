# Map Activation & Focus Sync (v0.7.107)

## Problem
Map activation/deactivation and blur/focus settings were not synced across clients. Players could have different maps active than the DM intended, and blur/opacity settings for non-focused maps were purely local.

## Solution

### 1. Maps DO → DM Authoritative (v2)
- Marked `maps` DO as `authoritative: true` — only the session creator (DM) pushes map state
- Expanded extractor to include `structures` array and `selectedMapId`
- Hydrator now restores structures and auto-selects the DM's active map for joining clients
- Players receive map activation/deactivation changes but cannot push them back

### 2. Map Focus Store → Synced & Authoritative
- Registered `mapFocus` as a new authoritative DO blob
- Syncs `unfocusedOpacity`, `unfocusedBlur`, and `selectionLockEnabled` from DM to all clients
- Added to `BLOB_SYNC_KINDS` and `STORE_FOR_KIND` in bridge
- Players see the same blur/opacity treatment as the DM configures

### 3. Selected Map Auto-Follow
- When players receive map state from DM, their `selectedMapId` is updated to match
- If a player's current map is deactivated, they auto-select the first active map

## Files Changed
- `src/lib/durableObjectRegistry.ts` — maps DO v2 (authoritative, structures, selectedMapId), mapFocus DO
- `src/lib/jazz/bridge.ts` — added `mapFocus` to BLOB_SYNC_KINDS and STORE_FOR_KIND, import useMapFocusStore
- `src/lib/version.ts` — bumped to 0.7.107

## Impact
- **Jazz service**: No restart needed — blob format change is backward-compatible
- **WebSocket server**: No impact
