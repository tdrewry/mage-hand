# Texture Import Expansion Plan

## Summary

Extend the existing reusable `ImageImportModal` component to support texture imports for **effect templates**, **map objects**, and **portals**. The modal already handles upload/URL input, pan/zoom/scale positioning, and shape-aware preview — it just needs to be wired into new consumers.

## Current State

| Consumer | Status | Component Used | Shape |
|----------|--------|----------------|-------|
| Region backgrounds | ✅ Done | `ImageImportModal` | rectangle / path |
| Token images | ✅ Done | `ImageImportModal` | circle |
| Map images | ✅ Done | `MapImageImportModal` (specialized) | rectangle + grid overlay |
| **Effect templates** | ❌ Planned | `ImageImportModal` | matches effect shape |
| **Map objects** | ❌ Planned | `ImageImportModal` | rectangle |
| **Portals** | ❌ Planned | `ImageImportModal` | circle or rectangle |

## Reusable Component

`ImageImportModal` (`src/components/modals/ImageImportModal.tsx`) is already fully reusable:
- Accepts `ShapeConfig` (circle / rectangle / path with dimensions)
- Configurable `title` and `description`
- Supports initial values for scale, offsetX, offsetY
- Returns `ImageImportResult`: `{ imageUrl, scale, offsetX, offsetY }`

No modifications to the modal itself are needed.

## Phase 1: Effect Template Textures

**Data model changes (`src/types/effectTypes.ts`):**
- Add `textureScale?: number` (default 1)
- Add `textureOffsetX?: number` (default 0)
- Add `textureOffsetY?: number` (default 0)

**Form changes (`src/components/cards/EffectsCard.tsx`):**
- Add `textureScale`, `textureOffsetX`, `textureOffsetY` to `TemplateFormData`
- Replace raw text `<Input>` for texture with an "Import Image" button
- Button opens `ImageImportModal` with shape matching the effect shape
- On confirm: store `imageUrl` → `texture`, `scale/offsetX/offsetY` → new fields
- Show thumbnail preview + clear button when texture is set

**Rendering (`src/lib/effectRenderer.ts`):**
- When `template.texture` is set, draw the texture as a clipped fill within the effect shape
- Use `textureScale` and offset for positioning

**Template serialization:**
- `texture` is already included in the template snapshot for `effect.place` ops
- New scale/offset fields travel with the template automatically

## Phase 2: Map Object Textures

**Data model (`src/types/mapObjectTypes.ts`):**
- Add optional `texture`, `textureScale`, `textureOffsetX`, `textureOffsetY` to map object type

**UI:**
- Add "Set Texture" option to map object context menu or control bar
- Opens `ImageImportModal` with rectangle shape matching object dimensions

**Rendering (`src/lib/mapObjectRenderer.ts`):**
- Draw texture fill within object bounds when present

## Phase 3: Portal Textures

**Data model:**
- Add optional texture fields to portal type (once portal system is formalized)

**UI:**
- Add texture import to portal configuration dialog
- Shape config: circle for circular portals, rectangle for door-type portals

## Dependencies

- Phases are independent and can be implemented in any order
- All phases reuse `ImageImportModal` without modification
- Phase 1 is highest priority (explicitly requested)
