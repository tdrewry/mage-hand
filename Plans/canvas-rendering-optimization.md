# Canvas Rendering Optimization Plan

**File:** `src/components/SimpleTabletop.tsx`  
**Goal:** Resolve visual glitches, network-refresh rendering failures, and excess redraw load.

---

## Background

After a browser refresh or a Jazz session reconnect, entities (tokens, regions, map objects) become invisible despite being present in the store and remaining interactable via hit testing. Additionally, remote drag events and network sync operations trigger cascading full redraws that slow the rendering loop. The issues below were identified through a read-only audit of `SimpleTabletop.tsx`, `bridge.ts`, `useActiveMapFilter.ts`, and related hooks.

---

## Priority 1 — Critical: Refresh / Reconnect Rendering Failures

### 1A — `imageUrl` stripped by `sessionStore` persistence, never reloaded on reconnect

**Location:** `bridge.ts` ~L2151 / `sessionStore.ts` ~L590  
**Problem:** `sessionStore`'s `partialize` function deliberately strips `imageUrl` from every token before persisting to localStorage (to save quota). On a page refresh, tokens are rehydrated with `imageUrl: ''` but the `imageHash` intact. In `bridge.ts`, the Jazz subscription compares the Jazz-side `imageHash` with the local one; when they match, it skips adding the token to `tokensNeedingTextureResolve`. As a result, tokens are never reloaded from IndexedDB and render as invisible colored circles.

**Fix already applied (2025-03-17):** Added a fallback check in the token and map-object Jazz subscription callbacks: if `!existing.imageUrl && existing.imageHash`, push to the resolve queue unconditionally.

**Action:** Verify the fix covers **all** code paths by confirming `_resolveTokenTextures` is called after *every* inbound subscription event — even ones that detect no changes to hash. Add a targeted unit test or console assertion.

---

### 1B — `isEntityVisible` filters all entities when no map is marked `active` after reconnect

**Location:** `useActiveMapFilter.ts` L28–32 / `durableObjectRegistry.ts` maps hydrator  
**Problem:** `useActiveMapFilter` builds `activeMapIds` from `maps.filter(m => m.active)`. If Jazz reconnects before the maps DO-blob is hydrated, `maps` will be empty or contain maps where `active: undefined`. This makes `filteredTokens`, `filteredRegions`, and `filteredMapObjects` all empty, so `redrawCanvas` draws nothing.  
**Action (Block 1B):**  
1. In the maps hydrator (`durableObjectRegistry.ts`), after setting `useMapStore.setState`, immediately call `initMapFogSettings` for each map AND ensure that at least one map has `active: true` (fallback to first map if none are active). This is the safest guard.  
2. Add a defensive check in `useActiveMapFilter`: if `activeMapIds` is empty but `maps` is non-empty, treat all maps as visible rather than hiding everything.

---

### 1C — Wall decoration cache key includes stale `lights.length`

**Location:** `SimpleTabletop.tsx` ~L3316 (`generateWallDecorationCacheKey`)  
**Problem:** The wall cache is keyed partly on `lights.length`. Any light-source add/remove causes a full wall geometry rebuild (expensive `generateNegativeSpaceRegion` + `document.createElement('canvas')` + offscreen draw). This is especially disruptive after a reconnect when lights sync in incrementally.  
**Action (Block 1C):** Remove `lights.length` from the wall decoration cache key entirely. Wall geometry depends only on region shapes, not on how many lights exist. Light count changing should not bust the wall cache.

---

## Priority 2 — High: Cascading React Re-renders from Render Loop Side Effects

### 2A — `setImageLoadCounter` inside `img.onload` triggers a full React re-render per image

**Location:** `SimpleTabletop.tsx` ~L3091 and ~L6220  
**Problem:** `imageLoadCounter` is a `useState` variable. Its setter is called inside `img.onload` (in `getCachedImage`) and inside a second image load path at ~L6220. Every single image completing its load schedules a full React re-render of `SimpleTabletop`, which re-runs every derived value, memo, and subscription in the component. When 20 tokens load after a refresh, this causes 20 full re-renders in rapid succession.  
**Action (Block 2A):**  
Replace `setImageLoadCounter` with a ref-based counter + `scheduleRedraw()`:
```ts
// Replace useState with a ref counter
const imageLoadCounterRef = useRef(0);

// In img.onload:
imageLoadCounterRef.current += 1;
scheduleRedraw(); // already coalesces via rAF — no extra React re-renders
```
This schedules a single canvas repaint without creating a React render cycle.

---

### 2B — `remote.drag.update` uses bare `requestAnimationFrame(() => redrawCanvas())`, bypassing the coalescing guard

**Location:** `SimpleTabletop.tsx` ~L680  
**Problem:**  
```ts
const unsub = ephemeralBus.on("remote.drag.update", () => {
  requestAnimationFrame(() => redrawCanvas());  // ← not using scheduleRedraw
});
```
Every inbound remote drag event schedules its own rAF without checking if one is already pending. If 10 remote drag events fire in one frame, 10 `redrawCanvas` calls execute. The `scheduleRedraw()` helper already has a pending-guard — this call path skips it.  
**Action (Block 2B):** Replace `requestAnimationFrame(() => redrawCanvas())` with `scheduleRedraw()`.

---

### 2C — `cleanupDismissedEffects` and aura hit-testing run every frame inside the rAF loop

**Location:** `SimpleTabletop.tsx` ~L4373, ~L4378  
**Problem:** `redrawCanvas` (which runs every animation frame) calls:  
- `effectState.cleanupDismissedEffects()` — a Zustand state mutation in the render path  
- `tickAuras(...)` every 200ms via a throttle ref  

Calling a Zustand `setState` from within a canvas render function is hazardous: it can trigger downstream subscriptions that call `scheduleRedraw`, creating a re-entrant loop.  
**Action (Block 2C):**  
1. Move `cleanupDismissedEffects()` to a standalone `useEffect` with a `setInterval` (e.g., every 1–2 seconds). Remove it from the render loop entirely.  
2. Move `tickAuras` to a `useInterval` hook outside `redrawCanvas`. Emit the tick event and let the canvas pick up changes on the next normal redraw.

---

## Priority 3 — Medium: Canvas State Management and Global Side Effects

### 3A — Fog offscreen canvas stored as `window.__fogOffscreenCanvas`

**Location:** `SimpleTabletop.tsx` ~L4202  
**Problem:**  
```ts
let fogOffscreenCanvas = (window as any).__fogOffscreenCanvas as HTMLCanvasElement | undefined;
```
Using a global `window` property to cache a canvas is fragile:  
- Multiple component instances (e.g., during React StrictMode double-mount in dev) will share and corrupt the same canvas.  
- It leaks memory when the component unmounts.  
- It bypasses React's lifecycle management entirely.  
**Action (Block 3A):** Convert `__fogOffscreenCanvas` to a `useRef<HTMLCanvasElement | null>` declared at the top of `SimpleTabletop`. Add a cleanup in the unmount effect to `null` the ref.

---

### 3B — `applyFocusDim` creates closures inside `redrawCanvas` on every frame

**Location:** `SimpleTabletop.tsx` ~L3149  
**Problem:** Two functions, `applyFocusDim` and `restoreFocusDim`, are defined inside `redrawCanvas` using `const`. This means new function objects are created every time `redrawCanvas` executes.  
**Action (Block 3B):** Extract these as module-level or component-level stable helpers that accept `ctx`, `focusActive`, and `currentSelectedMapId` as arguments, rather than closing over them from inside the render function.

---

### 3C — Wall geometry extraBoundsPoints iterates all tokens every frame on a cache miss

**Location:** `SimpleTabletop.tsx` ~L3376  
**Problem:** On every cache miss (which happens every time the wall cache key changes), the code iterates `tokens`, `mapObjects`, and `lights` to build `extraBoundsPoints`. Token positions change on every drag event, so if a token is being dragged while the wall cache is cold (after a reconnect or light change), this loop runs on every frame.  
**Action (Block 3C):** Compute `extraBoundsPoints` only when token/object/light arrays change structurally (add/remove), not on every position update. Cache this computation in a separate ref keyed on entity counts and grid state, not on positions.

---

## Priority 4 — Low / DX: Code Clarity Improvements

### 4A — `redrawCanvas` is a 600+ line function — extract sub-renderers  
The function handles background, grid, regions, walls, fog, tokens, effects, overlay, and off-screen indicators all inline. Consider splitting into named sub-functions (e.g., `drawBackground`, `drawWallLayer`, `drawFogLayer`, `drawTokenLayer`) that each accept `ctx` and the props they need. This will make the logic easier to trace and test.

### 4B — Dual effectStore reads (once at L4359, once at L4435)  
`useEffectStore.getState()` is called twice in one `redrawCanvas` pass, once for below-token effects and once for above-token effects. Consolidate to a single read at the top of the effects rendering block for consistency.

### 4C — `offScreenTokens` uses `let` but is never reassigned  
`let offScreenTokens: any[] = []` at L3178 is declared with `let` but only ever `.push()`ed to. Changing to `const` avoids confusion about potential reassignment.

---

## Suggested Fix Order

| Block | Impact | Effort | Notes |
|-------|--------|--------|-------|
| 1A | Critical | Low | Already applied, needs verification |
| 1B | Critical | Low | Single guard condition + hydrator fallback |
| 2B | High | Trivial | One-line change |
| 2A | High | Low | Ref swap + scheduleRedraw call |
| 1C | High | Low | Remove lights.length from cache key |
| 2C | Medium | Medium | Extract to useEffect/setInterval |
| 3A | Medium | Low | useRef + cleanup in unmount |
| 3B | Low | Low | Extract helper functions |
| 3C | Low | Medium | Separate bounds-points cache |
| 4A–4C | DX/Low | Medium–High | Code cleanup only |
