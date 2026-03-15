# Z-Index Layer System

## Overview
D20PRO uses a systematic z-index layer system with extended ranges to prevent UI stacking conflicts and allow for future expansion.

## Layer Structure

| Layer | Range | Slots | Purpose | Examples |
|-------|-------|-------|---------|----------|
| 0 | 0 | 1 | Canvas Base | Map background |
| 1 | 1000-29999 | 29,000 | Canvas Elements | Tokens, regions, walls, effects |
| 2 | 30000-30999 | 1,000 | Fixed UI | Toolbars, panels, controls |
| 3 | 31000-32999 | 2,000 | Draggable Cards | All card components |
| 4 | 33000-33999 | 1,000 | Dropdowns & Menus | Context menus, command palette |
| 5 | 34000-44999 | 11,000 | Modals & Dialogs | Confirmation dialogs, alerts |
| 6 | 45000-49999 | 5,000 | Popovers & Tooltips | Helper text, hover cards |
| 7 | 50000+ | ∞ | Critical Overlays | Loading screens, error boundaries |

## Canvas Elements Sub-Layers (1000-29999)

The canvas layer has extensive sub-layering for game elements:

| Sub-Layer | Z-Index | Purpose |
|-----------|---------|---------|
| Background Effects | 1000 | Auras, area effects below tokens |
| Regions | 5000 | Regions and zones |
| Terrain | 10000 | Terrain features |
| Walls | 15000 | Wall segments |
| Tokens | 20000-25000 | Token layer (5000 tokens possible) |
| Selection Highlights | 26000 | Selection visuals |
| Drag Ghosts | 27000 | Dragging previews |
| Measurement Tools | 28000 | Rulers, templates |
| Combat Indicators | 29000 | Turn indicators, status markers |

## Usage

### In TypeScript/React
```typescript
import { Z_INDEX } from '@/lib/zIndex';

// Direct usage
<div style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}>

// For tokens with offset
import { getTokenZIndex } from '@/lib/zIndex';
<div style={{ zIndex: getTokenZIndex(tokenOffset) }}>
```

### In Tailwind Classes
```tsx
<div className="z-toolbars">
<div className="z-modals">
<div className="z-critical">
```

### For Dynamic Elements

**Cards**: Cards use a dynamic range (31000-32999). The cardStore manages incrementing z-index within this range automatically.

**Tokens**: Use `getTokenZIndex(offset)` helper to get a z-index within the token range (20000-25000).

**Regions**: Use `getRegionZIndex(offset)` helper for regions (5000-9999 range).

## Rules

1. **Always use Z_INDEX constants** - Never use arbitrary z-index values
2. **Respect layer boundaries** - Each layer has a specific purpose
3. **Use helper functions for dynamic elements** - `getTokenZIndex()`, `getCardZIndex()`, etc.
4. **Cards and tokens self-manage** - Stores handle z-index for these elements
5. **Critical overlays are truly critical** - Only use Layer 7 for blocking, system-level UI
6. **Document exceptions** - If you must deviate, document why in code comments

## Benefits of Extended Ranges

- **Canvas flexibility**: 29,000 slots allow complex game states with hundreds of elements
- **Future-proof gaps**: Large gaps between layers (e.g., 11,000 between modals/popovers) allow for new layer types
- **Clear separation**: Each layer is clearly separated with no overlap
- **Sub-layer room**: Each major layer has room for 100+ sub-layers if needed
- **Token capacity**: 5,000 possible token z-indices for precise ordering

## Adding New Sub-Layers

If you need a new sub-layer within an existing layer:

1. Choose an appropriate base value within the layer's range
2. Update `src/lib/zIndex.ts` with the new constant
3. Add helper function if dynamic assignment is needed
4. Update this documentation
5. Consider if it fits existing sub-layers first

## Performance Considerations

- Z-index values don't impact performance - modern browsers handle large values efficiently
- Extended ranges are "free" - no performance cost vs. smaller numbers
- More important: minimize z-index changes during runtime (cards/tokens store manages this)
