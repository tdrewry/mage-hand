# Lifecycle-Based Drag/Placement Previews (v0.7.155)

## Problem
TTL-based expiry was the primary mechanism for clearing drag/placement previews. This caused previews to vanish when the user paused mid-drag, requiring inflated TTL values (5000ms) as a workaround — fragile and wasteful.

## Solution
Switched to explicit lifecycle semantics: `begin` creates the preview, `update` refreshes it, `end`/`cancel` removes it. TTL is set to 0 (never expires) for lifecycle-managed ops — cleanup is driven entirely by explicit events and disconnect handling.

## Changes

### TTL config (`src/lib/net/ephemeral/types.ts`)
- `token.drag.begin`: `ttlMs: 0` (was 5000)
- `token.drag.update`: `ttlMs: 0` (was 5000)
- `token.drag.end`: kept at 400ms (termination signal)
- `effect.placement.preview`: `ttlMs: 0` (was 5000)

### Drag preview store (`src/stores/dragPreviewStore.ts`)
- Removed `expireStale()` method — no longer needed
- `endDrag()` and `clearUser()` remain as explicit cleanup paths

### SimpleTabletop (`src/components/SimpleTabletop.tsx`)
- Removed `setInterval` that called `expireStale(800)` every 500ms

### Effect placement cancel signal (`src/stores/effectStore.ts`)
- `cancelPlacement()` now emits `effect.placement.preview` with empty `templateId` to clear remote previews

### Effect handler (`src/lib/net/ephemeral/effectHandlers.ts`)
- Inbound handler treats empty/falsy `templateId` as a clear signal → calls `removeEffectPlacementPreview`
- Removed `onCacheChange` listener (TTL expiry no longer drives cleanup)

## Disconnect Safety Net
- `clearUser()` on presence disconnect handles crash/exit recovery for drag previews
- Effect placement previews cleared when the user's presence disconnects

## Impact on External Services
- **WebSocket server**: No changes needed — op kinds unchanged, server is kind-agnostic
- **Jazz service**: Unaffected — drag previews are ephemeral-only
