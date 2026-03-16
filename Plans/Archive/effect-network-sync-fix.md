# Fix: Networked Effect Templates — Instant Clearing & Template Corruption (v0.7.149)

## Root Causes

### Bug 1: Placed effects instantly cleared (echo loop)
Outbound effect sync used destructive clear-and-repush: spliced ALL entries from Jazz CoList then re-pushed. Inbound subscription fired during the intermediate empty state, wiping local effects.

### Bug 2: Placement previews cleared by inbound sync
Inbound subscription could fire with stale data before the outbound throttle callback, replacing just-placed effects.

### Bug 3: `deleteTemplate` causes hidden built-ins to appear
Inbound handler called `store.addCustomTemplate()` (generates new IDs → duplicates) and `store.deleteTemplate()` (hides built-ins when removing non-Jazz templates).

### Bug 4: Texture assignments don't persist through sync
Outbound strips texture data; inbound reconstructs from local library but texture may not be synced yet.

## Fixes Applied

### 1. Diff-based outbound effect sync (`syncEffectsToJazz`)
- Replaced clear-and-repush with add/update/remove diff pattern matching regions/mapObjects
- Prevents intermediate empty state that triggered inbound handler
- Captures `prevEffects` correctly for trailing-edge throttle

### 2. Inbound throttle guard
- Skips inbound placed effect updates when outbound throttle timer is active (`_fineGrainedTimers.has('effects')`)
- Added deep comparison to avoid redundant store writes

### 3. Direct `setState` for custom template inbound
- Bypasses `store.addCustomTemplate()` / `store.deleteTemplate()` entirely
- Uses array filtering instead of `deleteTemplate` to avoid hiding built-ins
- Preserves local texture data when incoming template has none
- Rebuilds `allTemplates` inline

### 4. Diff-based outbound custom template sync
- Same pattern as effects: add/update/remove instead of clear-and-repush

## Impact
- Jazz service: different CoList mutation patterns (upsert vs clear-and-repush). No restart needed.
- WebSocket server: unaffected.
- No external service restarts required.
