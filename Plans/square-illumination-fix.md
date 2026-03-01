# Square Illumination Clipping Fix

## Problem
Round illumination sources sometimes rendered as squares in the fog of war.

## Root Cause
The visibility engine (`visibilityEngine.ts`) creates a square bounding box at exactly `maxDistance` pixels when computing visibility polygons. When a token has no nearby walls, the visibility polygon IS this bounding box square.

In `fogPostProcessing.ts`, the rendering clips to both a circle (`applyClipShape`) and the visibility polygon (`ctx.clip(visibilityPolygon)`). The intersection should be circular — but illumination animations apply a `radiusMod` multiplier (up to ~1.2×) that expands the circle beyond the bounding box. The result: circle(1.2r) ∩ square(r) = a square with slightly rounded corners.

## Fix
Enlarged the visibility polygon bounding box from `1.0× maxDistance` to `1.4× maxDistance`. This ensures the square bounding box always fully contains the animated circle, so the circle clip dominates the intersection.

## Files Changed
- `src/lib/visibilityEngine.ts` — bounding box uses `maxDistance * 1.4`
- `src/lib/version.ts` — bumped to 0.5.6
