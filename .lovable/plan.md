
# Plan: Support Non-Uniform Token Dimensions

## Overview
Enable tokens to render with their actual gridWidth and gridHeight proportions instead of always being circular. This will support rectangular tokens (e.g., 2×1 wagons, 1×3 snakes) while maintaining circular rendering for uniform dimensions.

## Key Concepts

### Token Shape Logic
Tokens will be rendered based on a new concept of "token shape":
- **Circular**: When `gridWidth === gridHeight` (current default behavior)
- **Elliptical**: When `gridWidth !== gridHeight` (new behavior for non-uniform dimensions)

For decorated tokens (with images), the image will be clipped to an ellipse or rounded rectangle matching the token's proportions.

For undecorated tokens (color fill only), a filled ellipse or rounded rectangle will be drawn.

---

## Technical Changes

### 1. Update Token Rendering in SimpleTabletop.tsx

**Current behavior (line ~2224):**
```typescript
const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
const radius = tokenSize / 2;
```

**New behavior:**
```typescript
const tokenWidth = (token.gridWidth || 1) * baseTokenSize;
const tokenHeight = (token.gridHeight || 1) * baseTokenSize;
const isUniform = tokenWidth === tokenHeight;
const radiusX = tokenWidth / 2;
const radiusY = tokenHeight / 2;
```

Replace all `arc(x, y, radius, ...)` calls with `ellipse(x, y, radiusX, radiusY, ...)` for:
- Main token fill/image clipping
- Selection highlight
- Hover glow
- Combat highlight
- Hostile pulse indicator

### 2. Update Hit Detection in useTokenInteraction.ts

**Current behavior:**
```typescript
const maxRadius = Math.max(tokenWidth, tokenHeight) / 2;
const distance = Math.sqrt(Math.pow(worldX - token.x, 2) + Math.pow(worldY - token.y, 2));
if (distance <= maxRadius) { return token; }
```

**New behavior (ellipse hit test):**
```typescript
const radiusX = tokenWidth / 2;
const radiusY = tokenHeight / 2;
// Point-in-ellipse test: (x/a)² + (y/b)² <= 1
const normalizedX = (worldX - token.x) / radiusX;
const normalizedY = (worldY - token.y) / radiusY;
if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) { return token; }
```

### 3. Update Image Import Shape Configuration

When opening the ImageImportModal for token images, pass the shape config based on token dimensions:

```typescript
const shapeConfig: ShapeConfig = {
  type: gridWidthValue === gridHeightValue ? 'circle' : 'rectangle', // or 'ellipse' if we add that
  width: gridWidthValue * baseSize,
  height: gridHeightValue * baseSize
};
```

### 4. Add Non-Uniform Size Presets (Optional Enhancement)

Extend `SIZE_PRESETS` in TokenContextMenu.tsx to include common non-uniform sizes:

```typescript
const SIZE_PRESETS = [
  { name: 'Tiny', gridWidth: 0.5, gridHeight: 0.5 },
  { name: 'Small/Medium', gridWidth: 1, gridHeight: 1 },
  { name: 'Large', gridWidth: 2, gridHeight: 2 },
  { name: 'Huge', gridWidth: 3, gridHeight: 3 },
  { name: 'Gargantuan', gridWidth: 4, gridHeight: 4 },
  // Non-uniform presets
  { name: 'Long (2×1)', gridWidth: 2, gridHeight: 1 },
  { name: 'Tall (1×2)', gridWidth: 1, gridHeight: 2 },
  { name: 'Wide (3×1)', gridWidth: 3, gridHeight: 1 },
] as const;
```

### 5. Update Token Visibility/LoS Calculations

In SimpleTabletop.tsx, update any visibility checks that use token radius to account for elliptical tokens. The center point remains the reference for LoS calculations.

### 6. Update Hex Grid Token Patterns

The hex occupancy calculations (lines ~1380-1495) for different creature sizes should continue to work as-is since they already handle `gridWidth` and `gridHeight` independently.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/SimpleTabletop.tsx` | Update `drawTokenToContext()` to use ellipses for non-uniform tokens |
| `src/hooks/useTokenInteraction.ts` | Update `getTokenAtPosition()` with ellipse hit detection |
| `src/components/TokenContextMenu.tsx` | Optionally add non-uniform size presets, update image import shape |
| `src/components/modals/ImageImportModal.tsx` | Potentially add ellipse shape support |

---

## Visual Behavior Summary

| Token Type | gridWidth = gridHeight | gridWidth ≠ gridHeight |
|------------|------------------------|------------------------|
| Undecorated (color) | Circle fill | Ellipse fill |
| Decorated (image) | Circular clip | Elliptical clip |
| Selection ring | Circle | Ellipse |
| Combat highlight | Circle | Ellipse |

---

## Considerations

1. **Rotation**: This plan does not add rotation support. Tokens remain axis-aligned.
2. **Backwards Compatibility**: All existing tokens with uniform dimensions will render identically.
3. **Image Aspect Ratio**: The image import modal already handles positioning/scaling within arbitrary shapes.
4. **Performance**: `ellipse()` has the same performance characteristics as `arc()` in canvas 2D.
