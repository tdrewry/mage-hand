# DM Fog Tools Plan

## Feature 1: DM Fog Reveal Brush (explored polygon union)

**Concept:** DM selects a "Fog Reveal" tool, clicks/drags on the canvas to stamp circles into the `exploredArea` Paper.js polygon. Players see revealed terrain at `exploredOpacity` (dimmed fog). Does not affect token visibility — tokens still require real illumination to be seen.

### Implementation Steps — ✅ DONE (v0.4.92)
1. ✅ Added `fogRevealBrushActive` toggle in VerticalToolbar (play mode, DM-only, fog-enabled)
2. ✅ Mouse-down + drag paints circles at cursor position via `stampFogBrushCircle`
3. ✅ Each circle unioned into `exploredArea` via `addVisibleToExplored` (Paper.js)
4. ✅ Brush radius adjustable via scroll-wheel (10–300px range)
5. ✅ Canvas renders ghost circle (dashed outline + fill) at cursor with radius label
6. ✅ On mouse-up, serialized explored area committed + broadcast via `fog.reveal.preview`
7. ✅ `fog.cursor.preview` ephemeral op broadcasts brush position to players
8. ✅ `fog.reveal.preview` with `shape:"committed"` triggers remote redraw

### Undo Support
- Pre-paint snapshot captured in `fogBrushPreExploredRef` — TODO: wire to undoRedoManager

---

## Feature 1B: DM Region Reveal (mark region as explored)

**Concept:** DM selects a region, clicks "Mark as Explored" in the region context menu or control bar. The region's polygon shape is unioned into `exploredArea`. Players see that region's terrain at `exploredOpacity`.

### Implementation Steps
1. Add "Mark as Explored" button to `RegionControlBar` (DM-only, gated by role check)
2. On click, convert the region's path (pathPoints/bezier or rect) to a Paper.js `Path`
3. Union it into the existing `exploredArea` via `paper.unite()`
4. Serialize updated explored area (existing flow)
5. Support multi-select: "Mark Selected as Explored" for batch reveal
6. Optional: "Unmark as Explored" — subtract the region shape from `exploredArea` via `paper.subtract()`

### Undo Support
- Single undo step per action capturing explored polygon before/after

---

## Feature 2: DM Standalone Light Sources

**Concept:** DM can place light sources directly on the map (not attached to any token). These are full `IlluminationSource` objects that illuminate and reveal areas. DM-only visibility in the light list.

### Implementation Steps
1. Add a "Place Light" tool to DM toolbar (already partially exists as `lightPlacementMode`)
2. Clicking the canvas creates a standalone light in `lightStore`
3. Light has all standard properties: bright/dim range, color, animation
4. **New property:** `ignoreWalls: boolean` — when true, visibility polygon is not clipped by wall/door geometry (full circle illumination)
5. Standalone lights are flagged `isStandalone: true` to distinguish from token-attached lights
6. DM can select, move, resize, and delete standalone lights
7. Standalone lights contribute to both visible and explored area calculations
8. `ignoreWalls` lights skip the `computeVisibilityFromSegments` call and use a full circle polygon instead

### Wall-Ignore Behavior
- When `ignoreWalls` is true, the light's visibility polygon is simply `Path.Circle(pos, range)` — no raycasting
- This simulates a "flashlight on a 2D map" or "divine light" effect
- Can be toggled per-light in the light properties UI

---

## Ephemeral Ops
- `fog.cursor.preview` — repurposed for Feature 1 brush position broadcast
- `fog.reveal.preview` — repurposed for Feature 1 committed reveal shapes
- Standalone light placement/movement uses existing durable ops (not ephemeral)

## Order of Implementation
- Feature 1 first (simpler, self-contained)
- Feature 2 second (touches illumination pipeline)
