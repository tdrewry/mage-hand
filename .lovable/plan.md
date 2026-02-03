

# Token Movement Collision Debugging Plan

## Investigation Findings

### Root Cause Identified
The collision detection code IS executing correctly. The console logs show:
```
handleMouseUp - Token drag ended {
  "enforceMovementBlocking": false,
  "enforceRegionBounds": false,
  ...
}
```

**Both collision enforcement toggles are disabled**, so the collision check block is skipped entirely. The code at line 5809 requires:
```typescript
if (shouldEnforceCollisions && (enforceMovementBlocking || enforceRegionBounds))
```

Since both values are `false`, no toasts appear.

### How Movement Path Drawing Works
1. **Path starts**: When token drag begins, `setDragPath([{ x: token.x, y: token.y }])` initializes the path
2. **Path grows**: During `handleMouseMove`, points are added every 10 world units
3. **Path renders**: `drawDragPathOnly()` checks `isDraggingToken && draggedTokenId` before drawing
4. **Path ends**: When drag ends, `setIsDraggingToken(false)` and `setDragPath([])` clear everything

### Unused Code Identified
| File | Status | Action |
|------|--------|--------|
| `src/hooks/useTokenInteraction.ts` | **Completely unused** - never imported anywhere | Should be deleted |

This hook duplicates all the token interaction logic that already exists in `SimpleTabletop.tsx`:
- Its own `isDraggingToken`, `dragPath`, `dragStartPos` state
- Its own collision detection in `endTokenDrag()`
- Its own global mouseup listener

---

## Proposed Changes

### Task 1: Add Always-Visible Debug Toast
Add a simple toast that fires every time a drag ends, regardless of collision settings. This will confirm the event handler is being reached.

**File**: `src/components/SimpleTabletop.tsx`

**Change**: In `handleMouseUp` (around line 5795), add a toast BEFORE any conditional checks:
```typescript
if (isDraggingToken && draggedTokenId && !tokensMovedByRegion.includes(draggedTokenId)) {
  const token = tokens.find((t) => t.id === draggedTokenId);
  if (token) {
    // ALWAYS show this toast to confirm drag end is firing
    toast.info(`Drag ended: obstacle=${enforceMovementBlocking}, bounds=${enforceRegionBounds}`, {
      duration: 1500
    });
    // ... rest of collision logic
```

### Task 2: Delete Unused Hook
Remove the unused `useTokenInteraction.ts` file to prevent confusion.

**File to delete**: `src/hooks/useTokenInteraction.ts`

---

## Technical Details

### Movement Path State Flow
```text
Token Mousedown             Token Mousemove              Token Mouseup
      │                           │                            │
      ▼                           ▼                            ▼
setIsDraggingToken(true)    setDragPath([...prev,       setIsDraggingToken(false)
setDragPath([startPos])       {x: newX, y: newY}])      setDragPath([])
setDragStartPos(pos)                                    Collision check runs
```

### Why Two Mouseup Handlers Exist
1. **Global listener** (lines 571-676): Catches mouseups outside the canvas
2. **Canvas handler** (lines 5795-5920): Handles normal canvas mouseups

Both contain collision detection code, but only the canvas handler logs are appearing in console.

### Collision Toggle Location
The toggles are controlled by:
- `useDungeonStore.enforceMovementBlocking` 
- `useDungeonStore.enforceRegionBounds`

These default to `false` (line 236-237 of dungeonStore.ts) and must be enabled via the toolbar.

