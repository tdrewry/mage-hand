# Aura Sync — Template Fallback Fix (v0.7.154)

## Problem
Auras (and all placed effects using custom templates) were only visible on the session that created them. Connected clients would silently drop the effect because `jazzToZustandPlacedEffect` returned `null` when the template lookup failed — a race condition where the placed effect arrived via Jazz before the custom template CoList had synced.

## Root Cause
The "strip and reconstruct" pattern intentionally excluded template data from placed effects in Jazz. Remote clients relied on `buildTemplateLookup()` using locally-synced custom templates. But custom templates sync via a separate Jazz CoList (`customTemplates`) that may arrive after the placed effects CoList, causing a timing gap where the template ID can't be resolved.

## Fix
1. **Schema**: Added `templateJson` (optional string) to `JazzPlacedEffect` — carries a stripped template snapshot as fallback
2. **Outbound**: `placedEffectToJazzInit()` now embeds `JSON.stringify(stripTemplateForSync(e.template))` in every placed effect
3. **Inbound**: `jazzToZustandPlacedEffect()` falls back to parsing the embedded `templateJson` when the local template lookup fails, then applies `computeScaledTemplate()` for level scaling

## Files Modified
- `src/lib/jazz/schema.ts` — added `templateJson` field to `JazzPlacedEffect`
- `src/lib/jazz/bridge.ts` — embed template in outbound, fallback in inbound
- `src/lib/version.ts` — bumped to 0.7.154

## Impact
- **Jazz service**: No restart needed. The new optional field is backwards-compatible — older CoValues without `templateJson` simply won't have the fallback (existing behavior).
- **WebSocket server**: Unaffected. Durable `effect.place` ops already carry full template snapshots.
- **Payload size**: Adds ~1-3KB per placed effect (stripped template JSON). Well within Jazz's 1MB limit.
