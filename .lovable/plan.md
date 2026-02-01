

# Fix: Dim Illumination Zones Not Rendering

## Problem Analysis

The dim illumination zones are not rendering because of a fundamental issue in the fog rendering pipeline:

### Current Flow (Broken)
1. Fog masks are computed excluding the visible area entirely
2. `unexploredMask` = Canvas minus Explored areas
3. `exploredOnlyMask` = Explored minus Visible areas
4. **Visible area receives NO fog at all**
5. `destination-out` gradient tries to cut fog that was never drawn
6. Result: The entire visible area appears at full brightness

### Expected Flow (Correct)
1. Draw fog to the entire visible area first
2. Then use `destination-out` with gradients to create bright center and dim outer ring
3. The gradient alpha controls how much fog is removed at each distance from the light source

---

## Solution

Modify `fogPostProcessing.ts` to first fill the visibility areas with fog at the appropriate opacity, THEN apply the `destination-out` gradient to cut through it proportionally.

### File: `src/lib/fogPostProcessing.ts`

**Change the rendering order in `applyFogPostProcessing`:**

1. Draw `unexploredMask` with `fogOpacity` (unchanged)
2. Draw `exploredOnlyMask` with `exploredOpacity` (unchanged)
3. **NEW: Draw visibility polygons with `exploredOpacity`** (so visible areas start with fog)
4. Apply `destination-out` gradients to create bright/dim zones

```
Before:
  [unexplored: dark fog] [explored-only: lighter fog] [visible: NO FOG]
  
After:  
  [unexplored: dark fog] [explored-only: lighter fog] [visible: gradient from bright to dim]
```

### Code Changes

In `applyFogPostProcessing()`, after drawing the fog masks and before applying `destination-out` gradients:

```javascript
// First fill ALL visibility areas with explored opacity fog
// This provides a base for the destination-out gradients to work against
if (illuminationData && illuminationData.sources.length > 0) {
  for (const source of illuminationData.sources) {
    if (!source.enabled || !source.visibilityPolygon) continue;
    
    // Draw fog in visibility area - this will be partially cleared by gradient
    fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
    fogCtx.save();
    fogCtx.clip(source.visibilityPolygon);
    fogCtx.beginPath();
    const pos = source.position;
    const rangePixels = source.range;
    fogCtx.arc(pos.x, pos.y, rangePixels, 0, Math.PI * 2);
    fogCtx.fill();
    fogCtx.restore();
  }
}
```

Then the existing `destination-out` gradient code will properly cut through this fog layer.

---

## Technical Details

### Why This Works

The `destination-out` composite operation removes pixels from the destination (fog) based on the source's alpha:
- Alpha 0.8 (brightIntensity) removes 80% of fog → Only 20% fog remains (bright zone)
- Alpha 0.4 (dimIntensity) removes 40% of fog → 60% fog remains (dim zone)

For this to work, there must BE fog to remove. The current code skips drawing fog in visible areas entirely, so there's nothing for the gradient to cut through.

### Gradient Stops Explanation

With `brightZone = 0.1`, `brightIntensity = 0.8`, `dimIntensity = 0.4`:

| Radius % | Fog Removal | Remaining Fog |
|----------|-------------|---------------|
| 0-9%     | 80%         | 20% (bright)  |
| 10%      | 60%         | 40% (transition) |
| 20-100%  | 40%         | 60% (dim)     |

---

## Testing Checklist

1. Create a token with illumination settings:
   - Range: 3 units
   - Bright Zone: 10%
   - Bright Intensity: 80%
   - Dim Intensity: 40%
   
2. Verify the visible area shows:
   - Very bright center (10% of radius)
   - Dimmer outer ring (remaining 90% of radius)
   - Clear transition between zones

3. Test with different settings to ensure gradients work at various configurations

