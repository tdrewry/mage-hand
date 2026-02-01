
# Animated GIF Support for Canvas Rendering

## Status: ✅ IMPLEMENTED

## Problem Analysis

Currently, animated GIFs work in React components (InitiativeCard, TokenContextMenu) because:
- CSS `background-image: url(...)` naturally animates GIFs
- The browser handles GIF frame decoding automatically

However, on the canvas:
- **Tokens**: Use `HTMLImageElement` via `getCachedImage()` which loads GIFs as static images
- **Regions**: Use `CanvasPattern` via `TexturePatternCache` which also captures only the first frame

Canvas `drawImage()` and `createPattern()` only capture the **current frame** at the moment they're called - they don't automatically animate.

## Solution Implemented

### New File: `src/lib/animatedTextureManager.ts`

A singleton service that:
1. **Detects animated images**: Checks for GIF magic bytes in data URLs
2. **Decodes frames using WebCodecs ImageDecoder API**: Extracts all frames as ImageBitmaps
3. **Tracks playback state**: Current frame index, timing based on elapsed time
4. **Provides frame access**: `getCurrentFrame(url)` returns the right ImageBitmap for the current time
5. **Memory efficient**: Limits max frames (100) and resolution (512px)

### Changes to `src/components/SimpleTabletop.tsx`

**Token rendering changes:**
- `getCachedImage()` now checks `animatedTextureManager.getCurrentFrame()` first
- Falls back to static image cache for non-animated images
- Preloads GIFs when first encountered

**Region rendering changes:**
- `drawRegionBackground()` now handles animated textures specially
- For animated GIFs: Uses tiled `drawImage()` calls instead of CanvasPattern
- For static images: Continues using cached patterns for performance

**Animation loop integration:**
- Added `hasAnimatedTextures` check to animation loop conditions
- Ensures continuous redraws when animated textures are present

### Changes to `src/lib/texturePatternCache.ts`

- Added `shouldBypassCache()` method to check if an image is animated
- Animated textures bypass pattern caching (patterns don't animate)

---

## Browser Compatibility

The `ImageDecoder` API is part of WebCodecs:
- Chrome/Edge 94+ (2021) ✅
- Safari 17+ (2023) ✅
- Firefox: Not yet supported - falls back to static rendering

Since the app already requires WebGL2 (GPU mandatory), this compatibility is acceptable.

---

## Performance Considerations

1. **Memory**: Each GIF stores frames as ImageBitmaps (capped at 100 frames, 512px max)
2. **Decode cost**: Initial decode is async (brief delay before animation starts)
3. **Draw cost**: Animated regions use per-frame tiled drawing instead of cached patterns
4. **Animation loop**: Throttled to ~30 FPS to reduce CPU usage

---

## Testing Checklist

- [ ] Import animated GIF as token image - verify animation plays on canvas
- [ ] Import animated GIF as region background texture - verify animation plays
- [ ] Test with multiple animated tokens simultaneously
- [ ] Test performance with 5+ animated textures visible
- [ ] Verify static PNG/JPEG images continue to work normally
- [ ] Test pattern caching still works for static region textures
- [ ] Test texture synchronization (multiplayer) with animated textures

