

# Plan: Enhanced Watabou-Style Terrain Rendering

## Overview

This plan improves the rendering of Watabou terrain features to match the authentic One Page Dungeon aesthetic, based on your clarifications:

1. **Water**: Shore ripple lines that follow the water boundary curve (not horizontal waves)
2. **Debris**: Unfilled squares and small circles (not stippling/crosshatching)
3. **Stairs**: New MapObject type for parallel lines indicating direction

## Analysis of Current State

| Feature | Current | Target |
|---------|---------|--------|
| **Water** | Horizontal sine waves across the area | Concentric ripple lines following the shore boundary |
| **Debris** | Stippled dots pattern | Unfilled squares (with diagonal lines) and small circles |
| **Columns** | Already correct | No changes needed |
| **Doors** | Already correct | No changes needed |
| **Stairs** | Not implemented | MapObjects with parallel lines |

---

## Technical Changes

### 1. Enhanced Water Rendering with Shore Ripples

**File: `src/lib/dungeonRenderer.ts`**

Replace the current horizontal wave pattern with concentric ripple lines that follow the water boundary:

```text
Current rendering:
+------------------+
|   ~~~~~~~~~~~~   |  <- horizontal sine waves
|   ~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~   |
+------------------+

Target rendering:
+------------------+
|     /~~~~\       |  <- lines follow the
|    /      \      |     shore boundary
|   |        |     |     getting smaller toward
|    \      /      |     the center
|     \____/       |
+------------------+
```

**Implementation approach:**
- Use the `fluidBoundary` path (already computed via marching squares)
- Create offset/inset versions of the boundary path at decreasing distances
- Draw each inset path as a ripple line
- Clip all rendering to the containing region

```typescript
function renderWaterTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  dungeonMapMode: boolean,
  style: WatabouStyle,
  regions: CanvasRegion[],
  fluidBoundary?: { x: number; y: number }[]
) {
  if (dungeonMapMode && fluidBoundary && fluidBoundary.length > 2) {
    // Fill with water color
    ctx.fillStyle = style.colorWater;
    // ... fill the boundary path
    
    // Draw shore ripples - concentric lines following boundary
    const rippleSpacing = 8; // pixels between ripple lines
    const maxRipples = 5;
    
    for (let i = 1; i <= maxRipples; i++) {
      const insetPath = computeInsetPath(fluidBoundary, rippleSpacing * i);
      if (insetPath.length < 3) break; // Stop if inset collapses
      
      ctx.beginPath();
      ctx.moveTo(insetPath[0].x, insetPath[0].y);
      for (const point of insetPath) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.strokeStyle = style.colorInk;
      ctx.globalAlpha = 0.3 - (i * 0.04); // Fade toward center
      ctx.stroke();
    }
  }
}
```

### 2. Authentic Debris Rendering

**File: `src/lib/dungeonRenderer.ts`**

Update `renderDebrisTiles()` to draw unfilled squares and circles instead of stippling:

```text
Current rendering:
+------------------+
|   · ··  ·  ·· ·  |  <- stippled dots
|   ·  · ··   · ·  |
+------------------+

Target rendering:
+------------------+
|   □  ○  □        |  <- unfilled squares with
|      ○     □     |     diagonal lines + circles
|   □     ○    □   |
+------------------+
```

**Implementation:**
```typescript
function renderDebrisTiles(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  zoom: number,
  dungeonMapMode: boolean,
  style: WatabouStyle,
  regions: CanvasRegion[]
) {
  if (dungeonMapMode) {
    tiles.forEach((tile) => {
      ctx.strokeStyle = style.colorInk;
      ctx.lineWidth = style.strokeThin / zoom;
      
      // Use seeded random for consistent rendering
      const seed = tile.x * 1000 + tile.y;
      const rand = seededRandom(seed);
      
      // Place 2-4 debris items per tile
      const itemCount = 2 + Math.floor(rand() * 3);
      
      for (let i = 0; i < itemCount; i++) {
        const x = tile.x + 8 + rand() * 34;
        const y = tile.y + 8 + rand() * 34;
        const size = 4 + rand() * 6;
        
        if (rand() > 0.5) {
          // Square with optional diagonal lines
          ctx.strokeRect(x - size/2, y - size/2, size, size);
          if (rand() > 0.5) {
            // Add diagonal line
            ctx.beginPath();
            ctx.moveTo(x - size/2, y - size/2);
            ctx.lineTo(x + size/2, y + size/2);
            ctx.stroke();
          }
        } else {
          // Small circle
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
  }
}
```

### 3. Stairs as MapObjects

Since the Watabou JSON doesn't include stairs in the standard export, we'll add stairs as a manual MapObject category that users can place.

**File: `src/types/mapObjectTypes.ts`**

Add a new `'stairs'` category and shape:

```typescript
export type MapObjectShape = 'circle' | 'rectangle' | 'custom' | 'door' | 'stairs';

export type MapObjectCategory = 
  | 'column'
  | 'statue'
  | 'furniture'
  | 'debris'
  | 'trap'
  | 'decoration'
  | 'obstacle'
  | 'door'
  | 'stairs'  // NEW
  | 'custom';

// Add to MAP_OBJECT_PRESETS
stairs: {
  shape: 'stairs',
  width: 50,  // One grid cell wide
  height: 100, // Two grid cells long
  fillColor: 'transparent',
  strokeColor: '#2C241D', // Ink color
  strokeWidth: 1.5,
  opacity: 1,
  castsShadow: false,
  blocksMovement: false,
  blocksVision: false,
  revealedByLight: true,
},

// Add to MAP_OBJECT_CATEGORY_LABELS
stairs: 'Stairs',
```

**File: `src/lib/mapObjectRenderer.ts`** (or wherever MapObjects are rendered)

Add rendering logic for stairs:

```typescript
function renderStairsMapObject(
  ctx: CanvasRenderingContext2D,
  obj: MapObject,
  zoom: number
) {
  ctx.save();
  ctx.translate(obj.position.x, obj.position.y);
  if (obj.rotation) {
    ctx.rotate((obj.rotation * Math.PI) / 180);
  }
  
  // Draw parallel lines across the stair width
  const numLines = Math.floor(obj.height / 8); // ~6px spacing
  ctx.strokeStyle = obj.strokeColor;
  ctx.lineWidth = obj.strokeWidth / zoom;
  
  for (let i = 0; i < numLines; i++) {
    const y = -obj.height/2 + (i + 0.5) * (obj.height / numLines);
    ctx.beginPath();
    ctx.moveTo(-obj.width/2, y);
    ctx.lineTo(obj.width/2, y);
    ctx.stroke();
  }
  
  ctx.restore();
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/dungeonRenderer.ts` | Update `renderWaterTiles()` with shore ripple algorithm; update `renderDebrisTiles()` with squares/circles |
| `src/types/mapObjectTypes.ts` | Add `'stairs'` to shape and category types; add stairs preset |
| `src/lib/mapObjectRenderer.ts` | Add stairs rendering logic (parallel lines) |

---

## Visual Reference

Based on the Watabou original:

```text
WATER (shore ripples):
    ___________
   /           \
  /   _______   \    <- concentric lines
 |   /       \   |      following the
 |  |         |  |      water boundary
 |   \_______/   |
  \             /
   \___________/

DEBRIS (room 9 style):
  □     ○
    □      ○
  ○    □
     □   ○      <- unfilled geometric shapes
                   squares may have diagonal

STAIRS (new MapObject):
  ─────────────
  ─────────────    <- parallel horizontal lines
  ─────────────       (rotation determines direction)
  ─────────────
```

---

## Implementation Notes

1. **Seeded Random**: For debris, use a seeded random based on tile position so patterns are consistent across re-renders

2. **Path Inset Algorithm**: For water ripples, implement a simple polygon inset by moving each point toward the centroid, or use a proper polygon offset algorithm

3. **Stairs Rotation**: Stairs use the existing `rotation` property to orient in any direction (0° = horizontal stairs, 90° = vertical stairs)

4. **No Changes to Doors/Columns**: These are working correctly per your feedback

