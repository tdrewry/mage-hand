

# Token Movement Path Styling with Footprints

## Overview
This plan adds customizable movement path visualization for tokens, including a **footprint trail** option that draws actual footprints (bare feet, boot prints, paw prints, etc.) along the drag path. A new **Style** tab in the Edit Token modal consolidates visual styling controls.

## Key Features
1. **Footprint Path Style**: Draw alternating left/right footprints along the movement path
2. **Multiple Footprint Types**: Bare feet, boots, paws, hooves, claws
3. **New Style Tab**: Consolidate token color and path styling in one place
4. **Live Preview**: Small canvas showing the selected path style

---

## Visual Reference

The footprint trail will alternate left and right prints along the curved path, similar to this pattern:

```text
Movement Direction →

    🦶        🦶        🦶
  🦶        🦶        🦶
    🦶        🦶        🦶
  🦶        🦶        🦶
```

Each footprint is:
- Rotated to face the direction of movement
- Offset left/right to simulate a walking gait
- Faded from start (transparent) to end (opaque)

---

## Data Model

### New Token Properties

```text
Token
├── color: string              (existing - moves to Style tab)
├── pathStyle: 'dashed' | 'solid' | 'footprint' | 'none'
├── pathColor: string          (defaults to token.color or white)
├── pathWeight: number         (1-5, affects line thickness or footprint size)
├── pathOpacity: number        (0.3-1.0, default 0.7)
└── footprintType: 'barefoot' | 'boot' | 'paw' | 'hoof' | 'claw'
```

### Footprint Types

| Type | Description | Use Case |
|------|-------------|----------|
| barefoot | Human/humanoid bare feet | Default for most characters |
| boot | Boot/shoe prints | Armored characters, adventurers |
| paw | Animal paw prints (4 toes + pad) | Wolves, cats, bears, Wild Shape |
| hoof | Hoofprints | Horses, centaurs, mounted tokens |
| claw | Bird/dinosaur talons | Dragons, aarakocra, raptors |

---

## UI Design: New Style Tab

The Edit Token modal gets a 4th tab between Label and Appearance:

```text
[Label] [Style] [Appearance] [Details]
```

### Style Tab Layout

```text
┌─────────────────────────────────────────┐
│  TOKEN COLOR                            │
│  ┌─────┐                                │
│  │ ▓▓▓ │  #FF6B6B  [color picker]       │
│  └─────┘                                │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┐             │
│  │██│██│██│██│██│██│██│██│ Quick Colors │
│  └──┴──┴──┴──┴──┴──┴──┴──┘             │
├─────────────────────────────────────────┤
│  MOVEMENT PATH                          │
│                                         │
│  Style: ┌──────────────────────────┐    │
│         │ Footprint             ▾  │    │
│         └──────────────────────────┘    │
│                                         │
│  Footprint Type: (only if footprint)    │
│  ┌───────┐ ┌───────┐ ┌───────┐         │
│  │  🦶   │ │  👢   │ │  🐾   │         │
│  │Barefoot│ │ Boot  │ │  Paw  │         │
│  └───────┘ └───────┘ └───────┘         │
│  ┌───────┐ ┌───────┐                    │
│  │  🐴   │ │  🦅   │                    │
│  │ Hoof  │ │ Claw  │                    │
│  └───────┘ └───────┘                    │
│                                         │
│  Path Color: [picker] ☑ Use token color │
│  Size:    ═══○═══════  3                │
│  Opacity: ═══════○═══  0.7              │
├─────────────────────────────────────────┤
│  PREVIEW                                │
│  ┌─────────────────────────────────────┐│
│  │  🦶    🦶    🦶    🦶    →          ││
│  │    🦶    🦶    🦶                   ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## Footprint Rendering System

### SVG Path Data for Each Footprint Type

Instead of using images, we'll use Canvas 2D path drawing for crisp rendering at any scale:

**Barefoot**: Oval heel + ball + 5 toe circles
```text
Heel (ellipse at bottom)
Ball (larger ellipse at top)
Toes: 5 small circles in an arc
```

**Boot**: Rectangular sole with heel
```text
Rounded rectangle for sole
Smaller rectangle for heel indent
```

**Paw**: Central pad + 4 toe pads
```text
Heart-shaped central pad
4 oval toe pads above
Optional: small claw marks
```

**Hoof**: U-shape with split
```text
U-shaped outline
Vertical line for cleft
```

**Claw**: 3 forward toes with talons
```text
3 elongated toe shapes
Pointed tips for claws
Smaller rear toe
```

### Rendering Algorithm

```text
function drawFootprintPath(ctx, dragPath, token):
  1. Calculate total path length
  2. Determine stride length based on token size
     stride = token.gridWidth * gridSize * 0.4
  
  3. For each stride interval:
     a. Calculate position on path using interpolation
     b. Calculate direction (angle to next point)
     c. Determine left/right foot (alternating)
     d. Apply gait offset (left foot slightly left, right slightly right)
     e. Calculate opacity (gradient from 0.3 to pathOpacity)
     f. Draw footprint:
        - Translate to position
        - Rotate to face movement direction
        - Mirror for left/right foot
        - Scale based on pathWeight
        - Draw footprint shape using Canvas paths
```

---

## File Changes

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/footprintShapes.ts` | Canvas path functions for each footprint type |
| `src/components/TokenPathPreviewCanvas.tsx` | Preview canvas for Style tab |

### Files to Modify

| File | Changes |
|------|---------|
| `src/stores/sessionStore.ts` | Add `pathStyle`, `pathColor`, `pathWeight`, `pathOpacity`, `footprintType` to Token interface |
| `src/components/TokenContextMenu.tsx` | Add Style tab with color picker (moved) and path controls |
| `src/components/SimpleTabletop.tsx` | Update `drawDragPath()` to use token path settings and render footprints |
| `src/lib/commands/tokenCommands.ts` | Add undo/redo support for style property changes |

---

## Technical Implementation

### 1. Footprint Shape Library (`src/lib/footprintShapes.ts`)

```typescript
export type FootprintType = 'barefoot' | 'boot' | 'paw' | 'hoof' | 'claw';

export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  type: FootprintType,
  x: number,
  y: number,
  size: number,
  rotation: number,
  isLeftFoot: boolean,
  color: string,
  opacity: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  if (isLeftFoot) ctx.scale(-1, 1); // Mirror for left foot
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  
  switch (type) {
    case 'barefoot':
      drawBarefootPrint(ctx, size);
      break;
    case 'boot':
      drawBootPrint(ctx, size);
      break;
    // ... etc
  }
  
  ctx.restore();
}
```

### 2. Path Rendering in SimpleTabletop

The `drawDragPath` function will check `token.pathStyle`:

- **'none'**: Skip path rendering entirely
- **'solid'/'dashed'**: Draw high-contrast line (existing + enhanced)
- **'footprint'**: Call new `drawFootprintPath()` function

### 3. Token Property Defaults

Tokens without explicit path settings use these defaults:
- `pathStyle: 'dashed'`
- `pathColor: undefined` (uses token.color)
- `pathWeight: 3`
- `pathOpacity: 0.7`
- `footprintType: 'barefoot'`

---

## Edge Cases

1. **Very short paths**: Don't draw footprints if path is shorter than 1 stride
2. **Sharp turns**: Rotate footprints to follow the curve smoothly
3. **Large tokens**: Scale footprint size with token size, cap at reasonable maximum
4. **Multi-select**: Style changes apply to all selected tokens
5. **Sync**: Path style properties sync via JSON Patch (small data, no images)

---

## Summary

This enhancement adds expressive movement visualization with actual footprint icons that:
- Follow the curved drag path naturally
- Alternate left/right like real walking
- Support multiple creature types (humanoid, beast, mount)
- Remain crisp at any zoom level (Canvas 2D drawing, not images)
- Consolidate all token styling in one convenient tab

