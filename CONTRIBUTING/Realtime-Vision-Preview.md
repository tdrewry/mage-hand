# Real-Time Vision Preview During Token Drag

## Status: SHELVED (Partial Implementation)

## Overview
This feature provides a live preview of a token's vision/illumination while dragging, allowing players to see what areas will be revealed before dropping the token.

## Current State
- **Feature flag**: `realtimeVisionDuringDrag` in fogStore (default: true)
- **Throttle**: Configurable via `realtimeVisionThrottleMs` (default: 50ms)

### What's Implemented
1. Vision range calculation during drag (uses region's gridSize for proper unit conversion)
2. Visibility polygon computation from wall segments
3. Circular fallback when no walls present
4. Integration with both Canvas 2D and PixiJS post-processing paths
5. Position tracking via `dragPreviewPosition` state

### Known Issues
1. **Vision preview not rendering during drag** - The illumination source is being added to the post-processing pipeline, but the visual update is not appearing until token drop. Likely causes:
   - PixiJS post-processing layer may be caching or not updating properly during drag
   - The visibility polygon (Path2D) may need additional handling in the GPU pipeline
   - Canvas 2D fallback path works but post-processing path does not

2. **Coordinate system** - Uses world-space coordinates; verified working correctly

3. **Range calculation** - Fixed to use region's gridSize for proper grid-to-pixel conversion

## Files Involved
- `src/components/SimpleTabletop.tsx` - Main implementation (drag handler + render integration)
- `src/stores/fogStore.ts` - Feature flags and settings
- `src/lib/visibilityEngine.ts` - Visibility polygon computation

## Debug Logging
Debug logging is currently enabled in the drag handler. Search for `[DRAG VISION]` to find relevant console output.

## Next Steps (When Resumed)
1. Investigate why PixiJS post-processing layer doesn't update during drag
2. Consider whether the drag preview should bypass post-processing and render directly on Canvas 2D
3. Test with post-processing disabled to isolate the issue
4. Remove debug logging once feature is working
