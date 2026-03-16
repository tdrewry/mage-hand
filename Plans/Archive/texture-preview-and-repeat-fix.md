# Texture Preview & Repeat Fix Plan

## Changes (v0.6.61)

### 1. Preview Now Matches Renderer (Cover-Fit Default)
- ImageImportModal preview previously always tiled/repeated the image
- Now uses **cover-fit** by default: image scales to cover the shape, centered, with user scale & offset
- This matches the `drawTextureInPath` behavior in `effectRenderer.ts`

### 2. Tile/Repeat Toggle
- Added `textureRepeat?: boolean` field to `EffectTemplate`
- Added `repeat?: boolean` to `ImageImportResult`
- ImageImportModal gains `showRepeatToggle` and `initialRepeat` props
- When enabled, preview switches to tiling mode (multiple copies of the image fill the shape)
- EffectsCard enables the toggle via `showRepeatToggle` prop

### 3. Repeat Mode in Renderer
- `drawTextureInPath` now checks `template.textureRepeat`
- If true: tiles the image at `imgWidth * scale` × `imgHeight * scale` across the effect bounds
- If false (default): cover-fit centered with user scale & offset (unchanged behavior)

### Files Modified
- `src/types/effectTypes.ts` — Added `textureRepeat` to `EffectTemplate`
- `src/components/modals/ImageImportModal.tsx` — Cover-fit preview, repeat toggle, new props
- `src/components/cards/EffectsCard.tsx` — Wire `textureRepeat` through form, modal, and serialization
- `src/lib/effectRenderer.ts` — Support repeat/tile mode in `drawTextureInPath`
- `src/lib/version.ts` — Bumped to 0.6.61
