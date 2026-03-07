# Token Drag Performance Fix

## Problem
Token dragging was stuttered and janky across all transport layers (local, OpBridge, Jazz).
Three root causes identified:

### 1. `dragPath` as React State (PRIMARY)
`dragPath` was a `useState` variable in the 12K-line SimpleTabletop component. Every 10px of
mouse movement triggered `setDragPath(prev => [...prev, point])`, causing a full React
re-render of the entire component. This added frame delay to every drag tick.

### 2. Stale Path Emission
`emitDragUpdate` at the network emission site read `dragPath` (the stale pre-setState value)
instead of the newly updated path. Remote clients received outdated path data.

### 3. Jazz Bridge Subscription Cascade
Every `updateTokenPosition` call creates a new tokens array in Zustand, which fires the
Jazz bridge subscription. Even with the fast-path bail-out (added in v0.7.61), the subscription
still runs per mouse-move frame.

## Fix
- Converted `dragPath` from `useState` to `useRef` — updates are instant with zero re-renders
- Canvas already redraws imperatively via `redrawCanvas()` triggered by token position changes
- Drawing functions read `dragPathRef.current` directly for always-fresh data
- Network emissions now send the current (just-updated) path, not stale state

## Files Changed
- `src/components/SimpleTabletop.tsx` — dragPath state → ref, all setDragPath → ref mutation
- `src/lib/version.ts` — bumped to 0.7.63
