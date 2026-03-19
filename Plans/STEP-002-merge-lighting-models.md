# STEP-002 — Merge Lighting Models

## Overview

There are currently **two independent lighting systems**:

| System | Lives On | Features | Store | Jazz Sync |
|---|---|---|---|---|
| **Map Object Light** | `LightSource` (Map Object subtype) | Simple radius + color | `lightStore` | `JazzIlluminationSource` |
| **Token Illumination** | `Token.illuminationSources[]` | Full `IlluminationPreset` system: radius, inner radius, falloff, cone angle, color, intensity, castsShadows | `sessionStore` | Embedded in `JazzToken` |

Token Illumination is the richer system. Map Object Lights are effectively a stripped-down version. Maintaining both is redundant.

**Goal:** Migrate Map Object Light Sources to use the Token Illumination rendering pipeline directly, so all lights — whether attached to a token or placed freestanding — share one code path.

---

## Design Decision

Map Object Lights become **freestanding light emitters** — they use the full `IlluminationPreset` schema but are NOT attached to any token. They are positioned by their `LightSource.position` rather than a token's x/y.

The dd2vtt importer maps `light` entries from the vtt format → `IlluminationPreset` objects applied to newly-created freestanding light emitters (currently stored as `LightSource` objects, future: stored as `Item` entities per STEP-007).

---

## Architecture

### Illumination Renderer Changes
The fog/illumination computation currently iterates `Token.illuminationSources` to calculate visibility radii. Add a second pass: iterate `lightStore.lights` and treat each as an `IlluminationSource` at the light's `position`.

```
illuminationSources = [
  ...tokens.flatMap(t => t.illuminationSources.map(s => ({ ...s, x: t.x, y: t.y }))),
  ...lights.map(light => ({
    ...light.illuminationPreset,  // NEW: full preset
    x: light.position.x,
    y: light.position.y,
  }))
]
```

### LightSource Schema Update
> ✅ **No backward compatibility required** — test data will be purged. Replace the `LightSource` schema wholesale with `IlluminationPreset` as the light definition. Remove the `radius`/`color` simple fields entirely.

### Light Edit UX
Replace the current simple radius/color edit panel for Map Object Lights with a compact version of the `TokenIlluminationModal` component, reusing it directly.

### dd2vtt Importer
Map vtt light entries:
```json
{ "x": 100, "y": 200, "range": 30, "color": "#ffcc44" }
```
→ Create a `LightSource` with:
```ts
illuminationPreset: presetToIlluminationSource({
  name: "Imported Light",
  radius: range * GRID_SIZE,
  color: color,
  intensity: 1.0,
  falloff: "quadratic",
})
```

---

## Implementation Path
> ✅ **RESOLVED — No backward compatibility required.** Old `lightStore` and simple `radius`/`color` schema are deleted outright. No migration step needed.

1. Remove `radius`, `color` simple fields from `LightSource` type
2. Add `illuminationPreset: IlluminationPreset` as the sole light definition
3. Update renderer to read `illuminationPreset` (single code path, no fallback)
4. Replace light edit UI with compact `TokenIlluminationModal`
5. Note: Full `LightSource` type itself is later replaced by `CanvasItem` in STEP-007

---

## Outstanding Questions for User Review

1. **Freestanding lights in dd2vtt:** dd2vtt specifies light sources at fixed positions. Should these import as `LightSource` (pre-STEP-007) / `CanvasItem` (post-STEP-007) entities, or as invisible tokens? Invisible tokens let them participate in pickup mechanics — but add token management overhead for what is often purely environmental lighting.
2. ~~**Existing saved light data:**~~ ✅ **RESOLVED** — No backward compat needed. Test data will be purged.
3. **Light Source delete:** Deleting a `LightSource`/`CanvasItem` must immediately trigger a fog/illumination recompute. Verify the renderer subscribes to `itemStore` deletions.
4. **Cone/directional lights:** The token illumination system supports cone angles. Should freestanding lights support directionality, or stay omnidirectional for now?

---

## Verification
- Place a Map Object Light → edit in illumination panel → verify fog updates with new radius/color/falloff
- Import a dd2vtt map with lights → verify lights appear as `LightSource` entities with correct position/radius
- Token with illumination + nearby freestanding light → verify both contribute to fog visibility
- Delete a freestanding light → verify fog contracts immediately
