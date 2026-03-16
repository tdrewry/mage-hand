# Auto Durable State Sync on Player Join (v0.7.36)

## Problem
Players joining Jazz tandem sessions had to manually click "Sync to Players" / "Request Sync" to receive durable state (maps, regions, tokens). This was unintuitive.

## Solution: Two-sided automatic sync

### Host side (NetManager.ts)
- When a player joins via WS (`presence` → `join` event), the DM host automatically calls `pushAllToJazz()` to re-push all durable state to the Jazz CoValues
- Only triggers in `ephemeralOnly` mode (Jazz tandem) and only if the local user has the `dm` role

### Player side (session.ts)
- After `joinJazzSession` calls `pullAllFromJazz()`, it checks if the root had any data
- If empty (no tokens, no blobs), schedules up to 5 retries with exponential backoff (1s → 5s)
- Each retry re-loads the session root CoValue from Jazz to get fresh resolved data
- On success, re-hydrates all stores and shows a toast
- Retries are cancelled on `leaveJazzSession()`

## Files Modified
- `src/lib/net/NetManager.ts` — auto-push on player join
- `src/lib/jazz/session.ts` — retry pull with backoff
- `src/lib/version.ts` — bump to 0.7.36
