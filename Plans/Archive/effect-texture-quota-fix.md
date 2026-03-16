# Effect Texture Quota Fix (v0.6.58)

## Problem
Effect templates with textures (data URIs) were being persisted to localStorage via:
1. `vtt-effect-store` (zustand persist) — `placedEffects` contained full template snapshots with texture data URIs
2. `magehand-custom-effect-templates` — custom templates saved directly to localStorage with full texture data

This caused `QuotaExceededError` (5MB localStorage limit) after each update.

## Solution
- **Strip texture data URIs** from localStorage persistence, keeping only `textureHash`
- **Store textures in IndexedDB** via the existing `canvas-textures-db` (shared with region/token textures)
- **Rehydrate textures** from IndexedDB on store initialization using `textureHash`

## Architecture
- `textureHash` field added to `EffectTemplate` type
- `fastHash()` — synchronous FNV-1a hash for immediate use before async SHA-256
- `persistTemplateTexture()` — saves texture to IndexedDB, sets hash synchronously
- `stripTextureData()` — removes data URI, preserves hash for recovery
- `rehydrateTemplateTexture()` — loads from IndexedDB by hash on startup
- `saveCustomTemplates()` — strips textures before writing to localStorage
- `partialize()` — strips textures from placed effects before zustand persistence
- `onRehydrateStorage()` — reloads textures from IndexedDB asynchronously

## Files Changed
- `src/types/effectTypes.ts` — added `textureHash` to `EffectTemplate`
- `src/stores/effectStore.ts` — all persistence/rehydration logic
- `src/lib/version.ts` — bumped to 0.6.58
