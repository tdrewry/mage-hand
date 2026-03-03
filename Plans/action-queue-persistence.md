# Action Queue Persistence & Ephemeral Sync

## Problem
Action queue (currentAction, pendingActions, actionHistory) was lost on page refresh
and not synced between multiple DM sessions.

## Solution

### 1. Local Persistence (zustand/persist)
- Added `persist` middleware to `actionStore` with storage key `vtt-action-store`
- Partialized to only persist: `currentAction`, `pendingActions`, `actionHistory`
- Transient state (isTargeting, targetingMousePos, resolutionFlashes) is excluded

### 2. Ephemeral Sync (action.queue.sync)
- New ephemeral op kind: `action.queue.sync`
  - DM-only, throttled at 500ms, 10s TTL, session key strategy
- Outbound: `useActionStore.subscribe()` auto-broadcasts on meaningful state changes
  - Deduplicates via JSON snapshot comparison to avoid redundant emissions
- Inbound: `miscHandlers.ts` receives and calls `hydrateQueue()` to replace local state
- `hydrateQueue()` method sets currentAction, pendingActions, actionHistory atomically

### 3. Files Changed
- `src/stores/actionStore.ts` — persist middleware, hydrateQueue, broadcastActionQueue, subscriber
- `src/lib/net/ephemeral/types.ts` — ActionQueueSyncPayload type, op config
- `src/lib/net/ephemeral/miscHandlers.ts` — inbound handler
