# Cursor / Fog Repaint Fix Plan

## Root Cause: Jazz Token Subscription Creates False-Positive Changes

The Jazz→Zustand token subscription (`bridge.ts` ~line 1749) calls `jazzToZustandToken()` on every callback, which parses `extras` JSON and creates **new object references** for array/object fields like `illuminationSources`, `appearanceVariants`, `entityRef`, etc.

The change-detection at line 1757-1759 uses `!==` reference comparison:
```typescript
if (incoming[key] !== existing[key]) { hasNonPosChange = true; break; }
```

Since `JSON.parse()` always returns new references, this comparison **always reports changes** for tokens with illumination sources. This triggers `store.setTokens()` on every Jazz callback, which:
1. Creates a new `tokens` array reference
2. Triggers `filteredTokens` to update
3. Triggers the fog useEffect (depends on `filteredTokens`)
4. Fog recomputes (100ms debounce, but fires repeatedly)
5. Fog re-renders via `redrawCanvas()`

**Why cursors make it worse**: Cursor network traffic over the same WebSocket connection increases event-loop contention and may trigger Jazz sync callbacks more frequently through transport churn.

**Why edit mode is better**: Edit mode skips fog computation entirely (the fog useEffect early-exits when `fogEnabled` is false or `fogRevealAll` is true), so the token store churn has no visible impact.

## Fixes

### Fix 1: Deep-compare complex token fields in Jazz subscription (PRIMARY)
In the Jazz→Zustand token subscription, replace the simple `!==` with deep comparison for known object/array fields:

```typescript
// Before:
for (const key of Object.keys(incoming) as (keyof Token)[]) {
  if (key === 'id' || key === 'x' || key === 'y' || key === 'imageUrl') continue;
  if (incoming[key] !== existing[key]) { hasNonPosChange = true; break; }
}

// After:
for (const key of Object.keys(incoming) as (keyof Token)[]) {
  if (key === 'id' || key === 'x' || key === 'y' || key === 'imageUrl') continue;
  const inVal = incoming[key];
  const exVal = existing[key];
  if (inVal === exVal) continue;
  // Deep-compare objects/arrays via JSON to avoid false positives from parsed extras
  if (typeof inVal === 'object' && inVal !== null && typeof exVal === 'object' && exVal !== null) {
    if (JSON.stringify(inVal) === JSON.stringify(exVal)) continue;
  }
  hasNonPosChange = true;
  break;
}
```

### Fix 2: Guard cursor emission behind sharing check
Line 8946 in SimpleTabletop.tsx emits `cursor.update` on **every** mousemove regardless of sharing state. Guard it:

```typescript
// Before:
ephemeralBus.emit("cursor.update", { pos: { x: worldCursorPos.x, y: worldCursorPos.y } });

// After:
if (useCursorStore.getState().cursorSharingEnabled) {
  ephemeralBus.emit("cursor.update", { pos: { x: worldCursorPos.x, y: worldCursorPos.y } });
}
```

### Fix 3: Guard cursor reception behind sharing check
In cursorHandlers.ts, skip store updates when sharing is disabled on the receiving side:

```typescript
ephemeralBus.on("cursor.update", (data: CursorUpdatePayload, userId) => {
  if (!useCursorStore.getState().cursorSharingEnabled) return;
  useCursorStore.getState().setCursor(userId, { ... });
});
```

### Fix 4: Same deep-compare for region/mapObject/effect Jazz subscriptions (SECONDARY)
Apply the same pattern to region, mapObject, and effect inbound subscriptions to prevent false-positive store churn for those entity types too.

## Files to Change
| File | Change |
|------|--------|
| `src/lib/jazz/bridge.ts` | Fix 1 (deep compare tokens), Fix 4 (deep compare other entities) |
| `src/components/SimpleTabletop.tsx` | Fix 2 (guard cursor emission) |
| `src/lib/net/ephemeral/cursorHandlers.ts` | Fix 3 (guard cursor reception) |
| `src/lib/version.ts` | Bump version |

## Impact on External Services
None — all changes are client-side. No WebSocket server or Jazz service changes needed.
