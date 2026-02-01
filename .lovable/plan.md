
# Animated GIF Support for Canvas Rendering

## Problem Analysis

Currently, animated GIFs work in React components (InitiativeCard, TokenContextMenu) because:
- CSS `background-image: url(...)` naturally animates GIFs
- The browser handles GIF frame decoding automatically

However, on the canvas:
- **Tokens**: Use `HTMLImageElement` via `getCachedImage()` which loads GIFs as static images
- **Regions**: Use `CanvasPattern` via `TexturePatternCache` which also captures only the first frame

Canvas `drawImage()` and `createPattern()` only capture the **current frame** at the moment they're called - they don't automatically animate.

## Solution Architecture

```text
                    ┌──────────────────────────────┐
                    │    AnimatedTextureManager    │
                    │    (New Singleton Service)   │
                    └──────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌──────────┐ ┌───────────┐ ┌───────────┐
              │ Token 1  │ │  Token 2  │ │  Region 1 │
              │ (GIF)    │ │  (Static) │ │   (GIF)   │
              └──────────┘ └───────────┘ └───────────┘
                    │                           │
                    ▼                           ▼
              ┌──────────────────────────────────────┐
              │ ImageDecoder API (WebCodecs)         │
              │ - Decode all GIF frames              │
              │ - Track frame durations              │
              │ - Return current frame ImageBitmap   │
              └──────────────────────────────────────┘
```

### Approach: WebCodecs ImageDecoder API

Use the modern `ImageDecoder` API (available in Chrome/Edge 94+, Firefox behind flag):

1. Detect if an image URL is an animated GIF
2. Decode all frames using `ImageDecoder`
3. Track frame timing and current frame index
4. Provide `getCurrentFrame()` method that returns the right `ImageBitmap` for the current time
5. Integrate with existing animation loop

---

## Technical Implementation

### New File: `src/lib/animatedTextureManager.ts`

This service will:

1. **Detect animated images**: Check for GIF magic bytes or use `ImageDecoder.tracks.selectedTrack.frameCount > 1`
2. **Decode frames lazily**: Only decode when first needed
3. **Track playback state**: Current frame index, timing, last update timestamp
4. **Provide frame access**: `getFrame(url)` returns current `ImageBitmap` or `null` if static

```typescript
interface AnimatedTexture {
  decoder: ImageDecoder;
  frames: ImageBitmap[];
  frameDurations: number[];  // ms per frame
  totalDuration: number;
  currentFrame: number;
  lastFrameTime: number;
}

class AnimatedTextureManager {
  private textures: Map<string, AnimatedTexture | null> = new Map();
  private pending: Map<string, Promise<AnimatedTexture | null>> = new Map();
  
  async loadAnimatedTexture(url: string): Promise<AnimatedTexture | null>;
  getCurrentFrame(url: string): ImageBitmap | null;
  isAnimated(url: string): boolean;
  updateAnimations(): void;  // Called each frame
}
```

### Modify: `src/components/SimpleTabletop.tsx`

**Token rendering changes:**

```typescript
// In getCachedImage or new helper
const getTokenImage = (url: string): ImageBitmap | HTMLImageElement | null => {
  // Check if this is an animated texture first
  const animatedFrame = animatedTextureManager.getCurrentFrame(url);
  if (animatedFrame) return animatedFrame;
  
  // Fall back to static image cache
  return getCachedImage(url);
};
```

**Region rendering changes:**

For animated region textures, we can't use `CanvasPattern` (patterns don't animate). Instead:
- Detect if region texture is animated
- For animated textures, draw using tiled `drawImage()` calls each frame
- For static textures, continue using cached patterns (better performance)

**Animation loop integration:**

```typescript
// Check if there are animated textures
const hasAnimatedTextures = tokens.some(t => 
  t.imageUrl && animatedTextureManager.isAnimated(t.imageUrl)
) || regions.some(r => 
  r.backgroundImage && animatedTextureManager.isAnimated(r.backgroundImage)
);

// Add to existing animation conditions
if (!hasHostileTokens && !hoveredTokenId && !hasAnimatedIllumination && !hasAnimatedTextures) return;
```

### Modify: `src/lib/texturePatternCache.ts`

Add method to check if an image URL should bypass pattern caching:

```typescript
shouldBypassCache(imageUrl: string): boolean {
  return animatedTextureManager.isAnimated(imageUrl);
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/animatedTextureManager.ts` | **New file** - Animated GIF decoder and frame manager |
| `src/components/SimpleTabletop.tsx` | Update token/region rendering to use animated frames; extend animation loop conditions |
| `src/lib/texturePatternCache.ts` | Add bypass check for animated textures |

---

## Browser Compatibility Note

The `ImageDecoder` API is part of WebCodecs and has good support:
- Chrome/Edge 94+ (2021)
- Safari 17+ (2023)
- Firefox: Not yet (requires polyfill or fallback)

**Fallback strategy**: If `ImageDecoder` is unavailable:
1. Use a library like `gifuct-js` (pure JS GIF decoder)
2. Or fall back to static first-frame rendering

Since this app already requires WebGL2 (GPU mandatory), the browser compatibility for ImageDecoder is likely acceptable.

---

## Performance Considerations

1. **Memory**: Each animated GIF stores all frames as ImageBitmaps - could be memory-intensive for large GIFs with many frames
2. **Decode cost**: Initial decode is async and may cause brief delay before animation starts
3. **Draw cost**: Animated region textures require per-frame tiled drawing instead of cached patterns

**Mitigations**:
- Limit max frames decoded (e.g., cap at 100 frames)
- Limit max texture resolution for animated images
- Only decode visible/nearby animated textures
- Throttle animation updates to 15-20 FPS for GIFs

---

## Testing Checklist

1. Import animated GIF as token image - verify animation plays on canvas
2. Import animated GIF as region background texture - verify animation plays
3. Test with multiple animated tokens simultaneously
4. Test performance with 5+ animated textures visible
5. Verify static PNG/JPEG images continue to work normally
6. Test pattern caching still works for static region textures
7. Test texture synchronization (multiplayer) with animated textures
