
# Plan: Token Movement Blocking System

## Overview

Implement a collision detection system that prevents tokens from being dragged through movement-blocking MapObjects (columns, closed doors) and optionally constrains tokens to remain within region boundaries.

## Current State Analysis

| Component | Current Behavior |
|-----------|-----------------|
| **`blocksMovement` on MapObjects** | Property exists but is **not enforced** - it's a placeholder |
| **Token dragging** | `useTokenInteraction.ts` directly updates position without collision checks |
| **Regions** | `regionStore.ts` defines playable areas but no movement constraint |
| **Collision detection** | `lineSegmentsIntersect()` exists in `visionPermissions.ts` for LoS |

## Proposed Architecture

### Core Concept: Path-Based Collision Detection

When a token is dragged from position A to position B, we check if the movement path intersects any blocking geometry:

```text
Token at A ─────────────────> Target B
                    │
                ┌───┼───┐
                │ COLUMN│  <- If path intersects, 
                │   ●   │     stop token at nearest
                └───────┘     valid position before collision
```

### Two Collision Modes

1. **MapObject Blocking**: Tokens cannot pass through objects with `blocksMovement: true`
2. **Region Constraint**: Tokens are constrained to stay within regions (optional toggle)

---

## Technical Implementation

### 1. New Collision Utility Module

**File: `src/lib/movementCollision.ts`**

Create a dedicated module for movement collision detection:

```typescript
// Core types
interface CollisionResult {
  blocked: boolean;
  validPosition: { x: number; y: number };  // Furthest valid position
  collidedWith?: string;  // ID of blocking object
}

// Main collision check function
export function checkMovementCollision(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  tokenRadius: number,
  blockingObjects: MapObject[],
  regions: CanvasRegion[],
  options: {
    enforceRegionBounds: boolean;
  }
): CollisionResult;

// Helper: Get movement-blocking geometry from MapObjects
export function getBlockingSegments(mapObjects: MapObject[]): LineSegment[];

// Helper: Check if movement line intersects circle (for columns)
export function lineIntersectsCircle(
  lineStart: Point,
  lineEnd: Point,
  circleCenter: Point,
  radius: number
): { intersects: boolean; nearestPoint?: Point };

// Helper: Check if movement line intersects rotated rectangle
export function lineIntersectsRectangle(
  lineStart: Point,
  lineEnd: Point,
  rect: { x: number; y: number; width: number; height: number; rotation?: number }
): { intersects: boolean; nearestPoint?: Point };

// Helper: Find the furthest valid position along movement path
export function findValidPositionAlongPath(
  start: Point,
  end: Point,
  blockingGeometry: LineSegment[],
  tokenRadius: number
): Point;
```

### 2. Movement Collision Integration

**File: `src/hooks/useTokenInteraction.ts`**

Modify `updateTokenDrag()` to check collisions before updating position:

```typescript
// In updateTokenDrag callback:
const updateTokenDrag = useCallback((worldX: number, worldY: number) => {
  if (!isDraggingToken || !draggedTokenId) return;

  const token = tokens.find(t => t.id === draggedTokenId);
  if (!token) return;

  const desiredX = worldX - dragOffset.x;
  const desiredY = worldY - dragOffset.y;

  // Get blocking objects and regions
  const blockingObjects = mapObjects.filter(obj => obj.blocksMovement);
  const regions = useRegionStore.getState().regions;
  
  // Calculate token radius for collision
  const tokenRadius = ((token.gridWidth || 1) * 40) / 2;

  // Check for collisions
  const collisionResult = checkMovementCollision(
    { x: token.x, y: token.y },
    { x: desiredX, y: desiredY },
    tokenRadius,
    blockingObjects,
    regions,
    { enforceRegionBounds }
  );

  // Use valid position (may be same as desired if no collision)
  const finalX = collisionResult.validPosition.x;
  const finalY = collisionResult.validPosition.y;

  // Optional: Show feedback when blocked
  if (collisionResult.blocked && collisionResult.collidedWith) {
    // Could trigger visual feedback here
  }

  setDragPath(prev => [...prev, { x: finalX, y: finalY }]);
  updateTokenPosition(draggedTokenId, finalX, finalY);
}, [...]);
```

### 3. Global Movement Blocking Toggle

**File: `src/stores/dungeonStore.ts`**

Add a global toggle for movement blocking (only active in Play mode):

```typescript
interface DungeonStore {
  // ... existing fields
  enforceMovementBlocking: boolean;
  enforceRegionBounds: boolean;
  
  setEnforceMovementBlocking: (enforce: boolean) => void;
  setEnforceRegionBounds: (enforce: boolean) => void;
}
```

### 4. UI Controls

**File: `src/components/cards/ToolsCard.tsx`** (or similar controls location)

Add toggles to the DM controls:

```tsx
<div className="space-y-2">
  <Label>Movement Constraints</Label>
  <div className="flex items-center justify-between">
    <span className="text-sm">Block through obstacles</span>
    <Switch 
      checked={enforceMovementBlocking}
      onCheckedChange={setEnforceMovementBlocking}
    />
  </div>
  <div className="flex items-center justify-between">
    <span className="text-sm">Constrain to regions</span>
    <Switch 
      checked={enforceRegionBounds}
      onCheckedChange={setEnforceRegionBounds}
    />
  </div>
</div>
```

---

## Collision Detection Algorithm

### For Circle-Shaped Objects (Columns)

```text
1. Calculate movement vector from start to end
2. Find closest point on movement line to circle center
3. If distance < (tokenRadius + columnRadius), collision detected
4. Find intersection point and calculate safe stop position
```

### For Rectangle-Shaped Objects (Doors, Furniture)

```text
1. Convert rectangle to 4 line segments (respecting rotation)
2. Check if movement line intersects any segment
3. Find first intersection point along movement path
4. Calculate safe stop position (back off by tokenRadius)
```

### For Region Boundary Constraint

```text
1. Check if end position is inside any region
2. If not, find intersection with region boundary
3. Clamp position to stay within region
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/movementCollision.ts` | **NEW** - Core collision detection utilities |
| `src/hooks/useTokenInteraction.ts` | Integrate collision checks in `updateTokenDrag()` |
| `src/stores/dungeonStore.ts` | Add `enforceMovementBlocking` and `enforceRegionBounds` toggles |
| `src/components/cards/ToolsCard.tsx` | Add UI toggles for movement blocking |
| `src/components/MapObjectContextMenu.tsx` | Remove "Blocks Movement" toggle if it clutters UI, or keep for per-object control |

---

## Behavior Specification

### When Movement Blocking is Enabled

1. **Columns** (`blocksMovement: true`, shape: circle)
   - Token cannot pass through the column's radius
   - Token stops at the edge if attempting to cross

2. **Closed Doors** (`blocksMovement: false` by default, but can be enabled)
   - Door's `blocksMovement` can be linked to `isOpen` state
   - Closed door blocks, open door allows passage

3. **Furniture/Obstacles** (`blocksMovement: true`)
   - Token cannot overlap with the object's bounding box

### When Region Bounds Enforcement is Enabled

1. Token cannot be dragged outside of any region boundary
2. Token "slides" along region edges rather than escaping
3. Path-based regions use polygon containment check

### Edit Mode vs Play Mode

- **Edit Mode**: Movement blocking is **bypassed** (DM can freely arrange tokens)
- **Play Mode**: Movement blocking is **enforced** when toggles are enabled

---

## Visual Feedback (Optional Enhancement)

When a token is blocked during drag:

1. Brief red flash on the blocking object
2. Token "snaps back" to last valid position smoothly
3. Optional toast notification for first-time blocking

---

## Performance Considerations

1. **Caching**: Cache blocking geometry when MapObjects don't change
2. **Spatial partitioning**: For maps with many objects, use grid-based lookup
3. **Early exit**: Skip collision check if movement distance is zero

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Token starts inside blocking object | Allow movement outward, block re-entry |
| Multiple blocking objects in path | Stop at first collision |
| Token larger than gap between objects | Block if token radius exceeds gap |
| Region with hole (path-based) | Treat hole as blocking boundary |
| Rotated rectangles | Apply rotation transform before intersection test |
