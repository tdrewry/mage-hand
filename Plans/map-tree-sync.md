# Map Tree State Sync (v0.7.142)

## Problem
Map tree state (activations, selected map, structures, focus/blur settings) was not synced from DM to clients in real-time. Players could have different maps active, different focus settings, and portal transitions didn't fully sync the map configuration.

## Solution

### 1. New Ephemeral Op: `map.tree.sync`
- DM-only, throttled at 300ms, TTL 5s, session-scoped
- Carries full map tree state: activations, selectedMapId, structures, focus settings
- Handler in `mapHandlers.ts` applies all fields on receiving clients

### 2. Auto-Emit Hook: `useMapTreeSync`
- Watches `mapStore` (activations, selectedMapId, structures) and `mapFocusStore` (opacity, blur, selectionLock)
- Only emits when current user is DM and connected
- Uses 300ms trailing-edge debounce to batch rapid changes

### 3. Portal Approval Now Always Sends Map Tree State
- `portal.teleport.approved` always includes `activeMapId` and `mapActivations` (not just cross-map)
- Additionally emits `map.tree.sync` on approval to sync focus/structure settings

## Sync Events Covered
- **Map activation toggle** (Switch in MapTreeCard / MapManagerCard) → auto-detected by store subscription
- **Map selection change** → auto-detected by store subscription
- **Structure changes** (add/remove/exclusive focus) → auto-detected by store subscription
- **Focus settings** (opacity, blur, selection lock) → auto-detected by store subscription
- **Portal teleport approval** → explicit `emitMapTreeSync()` call
- **Fog changes** → already handled by `fog` Durable Object (authoritative) + `fog.reveal.preview` ephemeral

## Files Changed
- `src/lib/net/ephemeral/types.ts` — `map.tree.sync` op kind, `MapTreeSyncPayload`, config
- `src/lib/net/ephemeral/mapHandlers.ts` — handler + `emitMapTreeSync()` emitter
- `src/lib/net/ephemeral/index.ts` — re-exports
- `src/hooks/useMapTreeSync.ts` — **NEW** auto-emit hook
- `src/components/SimpleTabletop.tsx` — wired hook + updated portal approval
- `src/lib/version.ts` — bumped to 0.7.142

## Impact
- **WebSocket Server**: No changes needed — ephemeral ops pass through as generic `{ kind, data }` envelopes
- **Jazz Service**: No changes needed — this uses the ephemeral layer, not durable objects
