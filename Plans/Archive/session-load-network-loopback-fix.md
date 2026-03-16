# Session Load Network Loopback Fix

## Problem
When the host loads a .mhsession file (or imports JSON/DOMH) while connected to a tandem session, regions, map objects, and effects load momentarily then disappear. Only tokens survive.

## Root Cause
The `throttledPushFineGrained` function used a **leading-edge drop** pattern: it captured the first closure and silently dropped all subsequent calls within the 1-second throttle window.

Session file loading follows a `clear → repopulate` pattern in rapid succession:
1. Stores are cleared (regions=[], mapObjects=[], effects=[])
2. Stores are repopulated with loaded data

The throttle captured the `clear` state (step 1) and dropped the `repopulate` state (step 2). When the timer fired 1s later, it pushed empty lists to Jazz. The inbound Jazz subscription then echoed that empty state back.

**Why tokens survived:** Token outbound sync runs synchronously on every store change (no throttle wrapper), so both the clear and repopulate were processed.

## Fix (v0.7.91)
Changed `throttledPushFineGrained` from leading-edge-drop to **trailing-edge** pattern:
- A `_fineGrainedPending` map always stores the **latest** closure
- When the timer fires, it executes the most recent function, not the first
- This ensures the final repopulated state is what gets pushed to Jazz

## Files Changed
- `src/lib/jazz/bridge.ts` — Trailing-edge throttle + cleanup in stopBridge
- `src/lib/version.ts` — 0.7.91
