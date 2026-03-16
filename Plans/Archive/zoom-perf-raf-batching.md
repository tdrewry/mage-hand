# Zoom Performance: rAF Batching Fix (v0.7.113)

## Problem
Canvas zoom was extremely slow on both host and client. Every mouse wheel tick:
1. Updated `transform` state in React
2. Triggered `useEffect → redrawCanvas()` synchronously (no frame batching)
3. Tore down and recreated the animation loop (which also depended on `transform`)
4. The animation loop's `redrawCanvas` used stale `transform` from closure

## Fix

### 1. rAF-batched transform redraws
Changed the `useEffect([transform, ...])` to use `requestAnimationFrame` batching. Multiple wheel events within a single frame now coalesce into one `redrawCanvas()` call.

### 2. Animation loop no longer depends on `transform`
Removed `transform` from the animation loop's dependency array. Previously every zoom tick tore down the `requestAnimationFrame` loop and recreated it, adding overhead.

### 3. `redrawCanvas` reads `transformRef` instead of closure
`redrawCanvas` now reads `const transform = transformRef.current` at the top, so animation loops and rAF callbacks always use the latest transform without stale closures.

## Files Changed
- `src/components/SimpleTabletop.tsx` — rAF batching on transform useEffect, removed transform from animation deps, redrawCanvas reads transformRef
- `src/lib/version.ts` — 0.7.113

## Impact
- **WebSocket server**: No impact
- **Jazz service**: No impact
