

# Fix: Networked Effect Templates — Instant Clearing & Template Corruption (v0.7.149)

## Root Causes Identified

I've traced **four distinct bugs** in the Jazz bridge's effect sync logic:

### Bug 1: Placed effects instantly cleared (echo loop)
**Location:** `bridge.ts` lines 2303-2329 (Zustand → Jazz outbound) and 2332-2371 (Jazz → Zustand inbound)

The outbound effect sync uses a **destructive clear-and-repush** strategy: it splices ALL entries from the Jazz CoList, then re-pushes active effects. But the inbound subscription fires immediately when the splice happens (Jazz CoList is now empty), and the inbound handler sees `len === 0` and sets `placedEffects: []` locally — wiping the effects before the re-push completes. The `_isCreator` guard only protects the creator; the creator's own effects get wiped on the joiner's client.

The trailing-edge throttle (`FINE_GRAINED_THROTTLE_MS = 1000ms`) makes this worse — the clear happens in the throttled callback, but the inbound subscription fires synchronously during the splice.

### Bug 2: Placement previews cleared by inbound sync
When a placed effect is added locally (via `placeEffect()`), the store update triggers the outbound subscription. The throttled callback eventually fires, but the inbound subscription may fire first with stale data, replacing the just-placed effect with nothing.

### Bug 3: `deleteTemplate` causes hidden built-ins to appear
**Location:** `bridge.ts` lines 2393-2411 (Custom template Jazz → Zustand inbound)

When the inbound handler calls `store.addCustomTemplate(t)` for a template received from Jazz, `addCustomTemplate` generates a **new ID** (`custom-fx-${Date.now()}-...`) instead of using the incoming template's ID. This creates duplicates. Additionally, `store.deleteTemplate()` on a built-in ID adds it to `hiddenBuiltInIds` — but the inbound handler calls `deleteTemplate` for templates not in Jazz, which may include built-in IDs that were overridden, causing them to get hidden.

### Bug 4: Texture assignments don't persist through sync
The outbound effect sync calls `placedEffectToJazzInit()` which doesn't include template texture data (by design — `stripTemplateForSync` removes it). But the inbound handler reconstructs templates via `buildTemplateLookup` using the local template library. If the custom template's texture hasn't been synced yet (or was stripped), the reconstructed template has no texture.

## Fix Plan

### 1. Replace destructive clear-and-repush with diff-based effect sync
Mirrors the pattern already used for regions and mapObjects. Instead of splicing all entries and re-pushing, diff against previous state to determine added/updated/removed effects.

**File:** `src/lib/jazz/bridge.ts` (lines 2303-2329)
- Track `prevEffects` properly (already declared but underused)
- Compute added/updated/removed sets
- Only splice removed entries, upsert updates, push new entries
- This prevents the intermediate empty state that triggers the inbound handler

### 2. Guard inbound placed effects against empty-during-throttle
**File:** `src/lib/jazz/bridge.ts` (lines 2332-2371)
- Add a timing guard: if the outbound throttle timer is active for 'effects', skip the inbound update (it's likely seeing our own intermediate state)
- Also add deep-comparison like regions/mapObjects to avoid redundant store writes

### 3. Fix custom template inbound sync to use proper upsert
**File:** `src/lib/jazz/bridge.ts` (lines 2393-2411)
- Instead of calling `store.addCustomTemplate(t)` (which generates a new ID), directly set the template in the store with its original ID
- Instead of calling `store.deleteTemplate(ct.id)` (which hides built-ins), filter the custom templates array directly and rebuild `allTemplates`
- Use `setState` directly within `runFromJazz` to avoid side effects from the store's CRUD methods

### 4. Add outbound `_fromJazz` guard to effect store CRUD methods
The inbound custom template handler calls `store.updateCustomTemplate()` and `store.addCustomTemplate()` inside `runFromJazz()`, but these methods trigger `saveCustomTemplates()` (localStorage write) and `persistTemplateTexture()`. While not causing the echo loop directly, it's wasteful. The `_fromJazz` flag is already set — the store methods should check it (or better: the bridge should use `setState` directly).

### 5. Version bump
**File:** `src/lib/version.ts` — bump to `0.7.149`

### 6. Save plan
**File:** `Plans/effect-network-sync-fix.md`

## Impact on External Services
**Jazz service** will see different CoList mutation patterns (upsert instead of clear-and-repush). No restart needed — this is purely client-side logic. **WebSocket server** is unaffected — effects don't use durable ops yet (per the effect-network-sync plan, durable ops are Phase 1 and not yet implemented).

## Technical Detail

The core fix replaces ~25 lines of clear-and-repush with ~60 lines of diff-based sync, following the exact pattern used for regions (lines 1582-1641) and mapObjects (lines 1644-1701). The key insight is that the clear-and-repush strategy is fundamentally incompatible with Jazz's reactive subscription model — the subscription fires on every mutation, including intermediate states during a multi-step operation.

