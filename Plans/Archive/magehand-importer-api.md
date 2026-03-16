# Magehand Map Importer API Specification

## Overview

This document specifies the **Magehand Map Import Bundle** — a JSON-based interchange format that any external application (d20pro, Foundry, Roll20, custom tools) can produce to import maps into Magehand.

The approach is **API-first**: Magehand publishes a formal JSON Schema, and the source application (e.g. d20pro) implements a Java-side exporter that serializes its internal model into a conforming bundle. This eliminates guesswork about accessor patterns and gives d20pro developers full control over serialization.

### JSON Schema

The canonical machine-readable schema is published at:

```
public/schemas/magehand-map-import-v1.schema.json
```

The schema is also hosted at the preview URL for remote validation:
`https://<app-url>/schemas/magehand-map-import-v1.schema.json`

---

## Design Principles

1. **Pixel coordinates everywhere** — all positions, sizes, and radii are in pixels. The exporter multiplies grid coordinates by `gridSizePx` before writing.
2. **Assets are optional** — images can be embedded as base64 in `assets`, referenced by URL via `originalUrl`, or omitted entirely. Magehand gracefully degrades.
3. **Minimal required fields** — only `version`, `source`, and `map` (with `name`, `widthPx`, `heightPx`, `gridSizePx`) are required. Everything else is additive.
4. **Source-agnostic** — the schema is not d20pro-specific. Any VTT can produce a valid bundle.
5. **Forward-compatible** — unknown properties in `metadata` are preserved. Future schema versions will be additive (new optional fields, never removing required ones).

---

## d20pro → Magehand Field Mapping

This section maps `PublicMapModel` fields to bundle properties for the d20pro Java exporter.

### Map Properties → `map`

| d20pro Accessor | Bundle Field | Conversion |
|---|---|---|
| `getName()` | `map.name` | Direct string |
| `getSize().width` × `peekGridScale()` | `map.widthPx` | cols × gridScale |
| `getSize().height` × `peekGridScale()` | `map.heightPx` | rows × gridScale |
| `peekGridScale()` | `map.gridSizePx` | Direct int (min 1) |
| `getGridStyle()` | `map.gridType` | `""` → `"square"`, `"hex"` → `"hex-row"` |
| `getGridColor()` | `map.gridColor` | `colorToHex(Color)` |
| `getCanvasColor()` | `map.backgroundColor` | `colorToHex(Color)` |
| `getMaskColor()` | `map.fogMaskColor` | `colorToHex(Color)` |
| `isUseExplorationMode()` | `map.explorationMode` | Direct boolean |
| `isHideNegativeSpace()` | `map.hideNegativeSpace` | Direct boolean |
| `isUseGradients()` | `map.useGradientFog` | Direct boolean |

### Floor Image → `floor` + `assets`

Priority chain (use the first that succeeds):

1. **`peekURL()`** — if non-null, use as `floor.assetId` reference
2. **`accessBundle_AutoScalingImage()`** — extract `BufferedImage` via `getImage()`, encode as base64 JPEG
3. **`peekFloor()` tile matrix** — composite into a single image (advanced, not required for v1)

```java
// Java exporter pseudocode
String floorUrl = map.peekURL();
if (floorUrl != null && !floorUrl.isEmpty()) {
    bundle.floor = new FloorImage("floor-main", combineOffsets(map), 1.0);
    bundle.assets.put("floor-main", new Asset(null, null, floorUrl));
}
AutoScalingImageBundle asi = map.accessBundle_AutoScalingImage();
if (asi != null && asi.getImage() != null) {
    String b64 = encodeBase64(asi.getImage(), "jpg");
    bundle.assets.put("floor-main", new Asset(b64, "image/jpeg", null));
}
```

Offset combination:
```java
int offsetX = 0, offsetY = 0;
Point fOff = map.peekFloorURLOffset();
Point sOff = map.peekShiftURLOffset();
if (fOff != null) { offsetX += fOff.x; offsetY += fOff.y; }
if (sOff != null) { offsetX += sOff.x; offsetY += sOff.y; }
// warpURLOffset is typically ignored for static export
```

### Walls → `walls[]`

Each `GenericMapWall` becomes a `Wall` object:

| d20pro | Bundle Field | Notes |
|---|---|---|
| Wall geometry | `points[]` | Extract start/end or polyline vertices, multiply by gridScale |
| Vision blocking flag | `blocksVision` | Default `true` if accessor unavailable |
| Movement blocking flag | `blocksMovement` | Default `true` if accessor unavailable |
| Door state (if applicable) | `doorState` | Map to `"none"` / `"closed"` / `"open"` / `"locked"` / `"secret"` |

### Lights → `lights[]`

Each `com.mindgene.d20.common.geometry.Light` becomes a `LightSource`:

| d20pro | Bundle Field | Notes |
|---|---|---|
| Position | `x`, `y` | Grid coords × gridScale |
| Color | `color` | `colorToHex()` |
| Radius | `radiusPx` | Grid units × gridScale |
| Bright radius | `brightRadiusPx` | `radiusPx × 0.5` if not explicitly available |
| Intensity | `intensity` | 0–1 range |
| Enabled | `enabled` | Default `true` |

### Creatures → `tokens[]`

Creatures are **transient** in `PublicMapModel` (assigned via `setCreatures()`). The exporter must access them after transport:

| d20pro | Bundle Field | Notes |
|---|---|---|
| `getUIN()` | `id` | Converted to string |
| `getName()` | `name` | |
| `getFootprint().x` × gridScale | `x` | Top-left pixel position |
| `getFootprint().y` × gridScale | `y` | |
| `getTemplate().getSize()` | `sizeGridCells` | Size byte → grid cells mapping below |
| `getTemplate().getHP()` | `hp.current` | |
| `getTemplate().getMaxHP()` | `hp.max` | |
| Creature image | `imageAssetId` | Key into `assets` — embed from RES/CTR/ |
| `getNaturalCreatureOrder()` | `tokenRenderOrder` | UIN list as strings |

**Size byte → grid cells mapping:**

| Byte | Size | Grid Cells |
|---|---|---|
| 0 | Fine | 0.5 |
| 1 | Diminutive | 0.5 |
| 2 | Tiny | 0.5 |
| 3 | Small | 1 |
| 4 | Medium | 1 |
| 5 | Large | 2 |
| 6 | Huge | 3 |
| 7 | Gargantuan | 4 |
| 8 | Colossal | 6 |

### FOW → `fog`

| d20pro | Bundle Field | Notes |
|---|---|---|
| `getFOWPolygons()` | `fog.polygons[]` with `type: "revealed"` | Each Polygon → points array × gridScale |
| `getPolygons()` | `fog.polygons[]` with `type: "negative-space"` | Permanent fog mask regions |
| `peekEasyFOW()` | `fog.gridReveal.grid` + `cellSizePx` | Cell-level boolean reveal grid |

Both polygon and grid FOW can coexist in the bundle. Magehand merges them on import.

### Markers → `annotations[]`

| d20pro | Bundle Field |
|---|---|
| Position | `x`, `y` (× gridScale) |
| Label | `label` |
| Text | `text` |

### Items → `objects[]`

| d20pro | Bundle Field |
|---|---|
| Name | `name` |
| `getFootprint()` | `x`, `y`, `widthPx`, `heightPx` (× gridScale) |
| Category | `category: "item"` |

### Templates → `templates[]`

| d20pro | Bundle Field |
|---|---|
| `getId()` | `id` |
| Shape/geometry | `shape`, `radiusPx`, `lengthPx`, etc. |

Template shape export depends on `MapTemplate` class definition — export `id` and shape type at minimum.

---

## Java Exporter Implementation Guide

### Recommended Class Structure

```java
package com.d20pro.export.magehand;

public class MagehandExporter {
    
    /**
     * Export a GenericMapModel to a Magehand-compatible JSON string.
     * 
     * @param map       The map model to export
     * @param creatures Creature list (transient, must be provided separately)
     * @param options   Export configuration
     * @return          JSON string conforming to magehand-map-import-v1.schema.json
     */
    public static String exportToJson(
        GenericMapModel map,
        List<AbstractCreatureInPlay> creatures,
        ExportOptions options
    ) {
        // 1. Build MapProperties from map.getName(), getSize(), peekGridScale(), etc.
        // 2. Export floor image from accessBundle_AutoScalingImage() or peekURL()
        // 3. Convert walls via getWalls() → Wall[]
        // 4. Convert lights via getLights() → LightSource[]
        // 5. Convert creatures → Token[]
        // 6. Convert FOW via getFOWPolygons(), getPolygons(), peekEasyFOW()
        // 7. Convert markers via accessMarkers() → Annotation[]
        // 8. Convert items via getItems() → MapObject[]
        // 9. Serialize to JSON
    }
}

public class ExportOptions {
    public boolean includeCreatures = true;
    public boolean embedFloorImage = true;   // base64 vs URL-only
    public boolean embedTokenImages = false; // base64 creature images
    public boolean includeFog = true;
    public String  imageFormat = "jpg";      // "jpg" or "png"
    public int     imageQuality = 85;        // JPEG quality 0-100
}
```

### Utility Methods Needed

```java
/** Convert java.awt.Color to "#rrggbb" or "#rrggbbaa" */
public static String colorToHex(Color c) {
    if (c == null) return "#000000";
    if (c.getAlpha() < 255) {
        return String.format("#%02x%02x%02x%02x", 
            c.getRed(), c.getGreen(), c.getBlue(), c.getAlpha());
    }
    return String.format("#%02x%02x%02x", 
        c.getRed(), c.getGreen(), c.getBlue());
}

/** Encode a BufferedImage to base64 */
public static String imageToBase64(BufferedImage img, String format) {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    ImageIO.write(img, format, baos);
    return Base64.getEncoder().encodeToString(baos.toByteArray());
}

/** Map grid style string to schema enum */
public static String mapGridType(String gridStyle) {
    if (gridStyle == null || gridStyle.isEmpty()) return "square";
    String s = gridStyle.toLowerCase().trim();
    if (s.contains("hex")) return "hex-row";
    if (s.equals("none") || s.equals("off")) return "none";
    return "square";
}
```

### Output File

The exporter should write a `.magehand.json` file. For bundles with embedded images > 50MB, consider a `.magehand.zip` containing `bundle.json` + `assets/` directory (future schema version).

---

## Magehand Import Pipeline (Browser Side)

When a user drops a `.magehand.json` file into Magehand:

1. **Parse & validate** JSON against the schema (reject if `version` ≠ 1)
2. **Hydrate assets** — store embedded base64 images into IndexedDB via the texture system; queue URL fetches for `originalUrl` references
3. **Create map region** — `CanvasRegion` from `map.*` properties + `floor` background
4. **Create walls** — `MapObject[]` with `category: 'wall'` from `walls[]`
5. **Create lights** — `MapObject[]` with `category: 'light'` from `lights[]`
6. **Place tokens** — Token store entries from `tokens[]` with size/position/image
7. **Restore fog** — Fog store from `fog.polygons[]` and/or `fog.gridReveal`
8. **Place annotations** — `MapObject[]` with `category: 'annotation'` from `annotations[]`
9. **Place objects** — `MapObject[]` from `objects[]`
10. **Group everything** under a single group named after the map

---

## Validation

Exporters can validate their output using:

```bash
# Using ajv-cli
npx ajv validate -s magehand-map-import-v1.schema.json -d exported-map.magehand.json
```

Or in Java:
```java
// Using networknt/json-schema-validator or everit-org/json-schema
```

---

## Versioning

- Schema version is locked at `1` for the initial release
- Future versions will be **additive only** (new optional fields)
- Breaking changes will increment the version number
- Magehand will support importing older versions indefinitely
