# d20pro `.d20_map` Import Plan

## 1. Container Format: `~oGBo~`

### Observed Structure
The `.d20_map` file is a custom binary container with:
- **Magic bytes**: `~oGBo~` (6 bytes)
- **Header**: Contains entry count and a file table / manifest of embedded resources
- **Entries** (observed in sample file):
  | Path | Purpose |
  |------|---------|
  | `maps/000<MapName>.d20_map` | Core map data (Java XMLEncoder XML, likely deflate-compressed) |
  | `RES/CTR/<creature>.png` | Creature token images |
  | `RES/FLR/<floor>.jpg` | Floor/background tile images |
  | `RES/manifests/CTR.manifest` | Creature resource manifest |
  | `RES/manifests/FLR.manifest` | Floor resource manifest |
  | `RES/manifests/LIGHTS.manifest` | Light configuration manifest |

### Parsing Strategy
Each entry in the file table likely has: path string (length-prefixed or null-terminated), offset, and compressed size. The core map payload is Java `XMLEncoder` XML (same format found in `.obj` files).

**Two viable approaches:**

#### A. Browser-Side Parser (Recommended for UX)
- Read the file as `ArrayBuffer` in the browser
- Parse the `~oGBo~` header to extract the file table
- Decompress each entry (likely raw deflate — test with `DecompressionStream` or a JS inflate lib)
- Parse the XML map payload into a DOM tree
- Extract image blobs for tokens and floor tiles

#### B. d20pro Nashorn Export Script
- Run inside d20pro's scripting engine
- Serialize the map model directly to a Magehand-compatible JSON bundle
- Bundle images as base64 or separate files in a ZIP
- **Pro**: No reverse-engineering needed; access to live Java objects
- **Con**: Requires users to have d20pro installed and run the script manually

#### Recommendation
Implement **both**: Browser-side parser for drag-and-drop UX, Nashorn script as a validated reference / fallback. Start with the Nashorn script to establish the canonical JSON schema, then build the browser parser against that schema.

---

## 2. d20pro `PublicMapModel` → Magehand Data Model Mapping

### Serialized Fields (from `PublicMapModel`)

The `PublicMapModel` is the serializable form (`java.io.Serializable`) sent from DM to PCs. Its fields represent the complete map state that would be encoded in the `.d20_map` container. The `transient` fields (`_listCreatures`, `_creatureToFront`, `_negativeSpace`) are NOT serialized — creatures are transported separately and assigned post-deserialization.

### Map-Level Properties

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_name` | String | `GameMap.name` | Map display name |
| `_floor[0].length` × `_floor.length` | short[][] dimensions | `GameMap.bounds.width/height` | Size in **grid cells**, multiply by `_gridScale` for pixels |
| `_canvasColor` | Color (RGBA) | `GameMap.backgroundColor` | Convert `java.awt.Color` → hex string |
| `_gridColor` | Color | `GridRegion.gridColor` / `CanvasRegion.color` | Grid line color |
| `_gridStyle` | String | `GridRegion.gridType` | Map `""` → `'square'`, `"hex"` → `'hex'`, etc. |
| `_gridScale` | int (min 1) | `GridRegion.gridSize` / `CanvasRegion.gridSize` | Pixels per grid cell |
| `_floorURL` | String | `CanvasRegion.backgroundImage` | Primary floor image (URL or embedded path) |
| `_overlayURL` | String | Secondary region or overlay layer | Optional overlay image |
| `_weatherURL` | String | Not yet mapped | Weather effect layer (future) |
| `_floorURLOffset` | Point | `CanvasRegion.backgroundOffsetX/Y` | Floor image alignment offset |
| `_shiftURLOffset` | Point | — | Additional shift (combine with floor offset) |
| `_warpURLOffset` | Point | — | Warp offset (combine or ignore) |
| `_maskColor` | Color | Fog tint color | Color of unexplored/masked areas |
| `_hideNegativeSpace` | boolean | Fog store config | Whether to render negative space as hidden |
| `_useGradients` | boolean | Fog effect settings | Gradient vs hard-edge fog |
| `_useExplorationMode` | boolean | Session/fog config | Progressive reveal (darkness returns vs permanent reveal) |
| `_useGlobalGrid` | boolean | Region config | Single grid across entire map |
| `_useAutoElevation` | boolean | — | Not mapped (3D elevation feature) |
| `_showStatusMarkers` | String | Token rendering config | Status marker display mode |
| `_UIN` | Long | Import metadata (internal ID) | Unique map identifier for cross-referencing |

### Floor System

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_floor` | short[][] | — | Tile ID matrix (rows × cols). Each `short` is a tile graphic ID. |
| `_floor0` | short[][] | — | Underlayer tile matrix (drawn beneath `_floor` and ASI) |
| `_floorURL` | String | `CanvasRegion.backgroundImage` | **Primary**: If set, this single image replaces the tile matrix |
| `_bundleASI` | AutoScalingImageBundle | `CanvasRegion.backgroundImage` + `backgroundScale` | Auto-scaling background image (alternative to tiles) |
| `RES/FLR/*.jpg` | embedded images | IndexedDB via texture system | Physical image assets |

**Import priority**: `_floorURL` (if present) → `_bundleASI` → tile matrix composite. Most modern d20pro maps use `_floorURL`.

### Creatures (Transient — Transported Separately)

Creatures are NOT in the serialized map data (`transient` field). They are assigned post-deserialization via `setCreatures()`. In `.d20_map` exports, creature data may be in a separate entry or the `RES/CTR/` manifest.

| d20pro | Magehand Target | Notes |
|---|---|---|
| `PublicCreatureInPlay.getFootprint()` | Token position + size | Footprint is a Rectangle in grid space |
| `PublicCreatureInPlay.getMapUIN()` | — | Links creature to its map |
| `GenericCreatureModel.getSize()` | Token footprint | `byte` size category (0=Fine..8=Colossal) |
| `GenericCreatureModel.getHP()` | Token HP | Current hit points |
| `_naturalCreatureOrder` | Token z-order | List of creature UINs in render order |
| `RES/CTR/*.png` | Token image | Stored in IndexedDB |

### Walls → MapObjects (Wall)

| d20pro Field | Magehand Target | Notes |
|---|---|---|
| `_listWalls` (ArrayList\<GenericMapWall\>) | `MapObject` with `category: 'wall'` | Need `GenericMapWall` class definition for field details |
| Wall start/end or polyline | `wallPoints` array | Coordinate format TBD |

### Fog of War

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_fow` | LinkedList\<Polygon\> | Fog store — revealed polygons | FOW reveal regions |
| `_polygons` | LinkedList\<Polygon\> | Negative space / fog mask | Permanent fog polygons |
| `_easyFOW` | boolean[][] | Convert to polygon regions | Grid-based FOW (cell-by-cell). `null` if not used. |
| `_negativeSpace` | Area (transient) | — | Computed at runtime from `_fow`, not serialized |

**`Polygon` class** (from `com.mindgene.d20.common.geometry.Polygon`): Need definition — likely wraps `int[]` xpoints/ypoints arrays in grid coordinates.

### Lights → MapObjects (Light)

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_lights` | LinkedList\<Light\> | `MapObject` with `category: 'light'` | |
| `Light.position` | Point | `MapObject.position` | Grid coords → pixels (× gridScale) |
| `Light.color` | Color/String | `lightColor` | |
| `Light.radius` | int/double | `lightRadius` | Grid units → pixels |
| `Light.intensity` | double | `lightIntensity` | 0–1 range |

### Templates → MapObjects (Various)

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_listTemplates` | ArrayList\<MapTemplate\> | `MapObject` with appropriate category | Spell areas, zones |
| `MapTemplate.id` | String | — | Used for creature-under-template queries |

### Map Markers → MapObjects (Annotation)

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_listMarkers` | ArrayList\<MapMarker\> | `MapObject` with `category: 'annotation'` | |
| `MapMarker.position` | Point | `MapObject.position` | |
| `MapMarker.text` | String | `annotationText` | |
| `MapMarker.label` | String | `annotationReference` | |

### Items → MapObjects (Custom)

| d20pro Field | Java Type | Magehand Target | Notes |
|---|---|---|---|
| `_listItems` | ArrayList\<PublicItemInPlay\> | `MapObject` with `category: 'custom'` or `'decoration'` | Physical items on the map |
| `PublicItemInPlay.getFootprint()` | Rectangle | Position + size | |

---

## 3. Java Type Conversion Reference

These Java types appear throughout the serialized XML and need JS converters:

| Java Type | XML Representation | JS Conversion |
|---|---|---|
| `java.awt.Color` | `<object class="java.awt.Color"><int>r</int><int>g</int><int>b</int><int>a</int></object>` | `rgb(r,g,b)` or `#rrggbb` hex |
| `java.awt.Point` | `<object class="java.awt.Point"><int>x</int><int>y</int></object>` | `{ x, y }` |
| `java.awt.Dimension` | `<object class="java.awt.Dimension"><int>w</int><int>h</int></object>` | `{ width, height }` |
| `java.awt.geom.Area` | Complex path data | Not serialized (transient) |
| `short[][]` | `<array class="[S" length="N">...</array>` | `number[][]` |
| `boolean[][]` | `<array class="[Z" length="N">...</array>` | `boolean[][]` |
| `LinkedList<T>` | `<object class="java.util.LinkedList">...</object>` | `T[]` |
| `ArrayList<T>` | `<object class="java.util.ArrayList">...</object>` | `T[]` |
| `Long` | `<long>value</long>` | `number` or `string` (for UINs) |

---

## 4. Magehand Import JSON Schema

The canonical intermediate format that both the Nashorn exporter and browser parser produce:

```typescript
interface D20ProImportBundle {
  version: 1;
  source: 'd20pro';
  sourceMapUIN: string;     // Original d20pro map UIN for reference
  
  map: {
    name: string;
    width: number;          // pixels (grid cells × gridScale)
    height: number;         // pixels
    backgroundColor: string; // hex color from _canvasColor
    maskColor: string;       // hex color from _maskColor
    gridSize: number;        // pixels per cell (_gridScale)
    gridType: 'square' | 'hex' | 'none';
    gridColor: string;       // hex color from _gridColor
    explorationMode: boolean;
    hideNegativeSpace: boolean;
    useGradients: boolean;
    showStatusMarkers: string;
  };
  
  // Base64-encoded images keyed by original path
  assets: Record<string, {
    data: string;       // base64
    mimeType: string;   // 'image/png' | 'image/jpeg'
    role: 'floor' | 'creature' | 'overlay' | 'weather';
  }>;
  
  floorImage?: {
    assetKey: string;   // key into assets (from _floorURL or _bundleASI)
    offsetX: number;    // from _floorURLOffset + _shiftURLOffset
    offsetY: number;
    scale: number;
  };

  overlayImage?: {
    assetKey: string;   // from _overlayURL
  };
  
  creatures: Array<{
    name: string;
    x: number;           // pixel position
    y: number;
    size: number;         // footprint in grid cells
    imageAssetKey?: string;
    hp?: { current: number; max: number };
    uin: string;          // original UIN for ordering
  }>;
  creatureRenderOrder: string[]; // UINs in front-to-back render order
  
  walls: Array<{
    points: Array<{ x: number; y: number }>; // pixel coordinates
    blocksVision: boolean;
    blocksMovement: boolean;
  }>;
  
  lights: Array<{
    x: number;
    y: number;
    color: string;
    radius: number;       // pixels
    brightRadius: number; // pixels (default: radius * 0.5)
    intensity: number;    // 0-1
    enabled: boolean;
  }>;
  
  fogPolygons: Array<{
    points: Array<{ x: number; y: number }>; // pixel coordinates
    type: 'revealed' | 'hidden';
  }>;

  negativeSpacePolygons: Array<{
    points: Array<{ x: number; y: number }>;
  }>;

  easyFOW?: {
    grid: boolean[][];   // cell-level reveal state
    cellSize: number;    // gridScale for mapping to pixels
  };
  
  markers: Array<{
    x: number;
    y: number;
    label: string;
    text: string;
  }>;

  items: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    imageAssetKey?: string;
  }>;

  templates: Array<{
    id: string;
    // Shape/size TBD pending MapTemplate class definition
  }>;
}
```

---

## 5. Implementation Phases

### Phase 1: Container Parser
- Reverse-engineer `~oGBo~` binary format using the sample file
- Build a TypeScript parser that extracts the file table and entry blobs
- Validate by extracting known images (`RES/FLR/`, `RES/CTR/`)

### Phase 2: XML Map Data Parser  
- Decompress the `maps/000*.d20_map` entry
- Parse Java XMLEncoder XML into a JS object tree
- Build converters for `java.awt.Color`, `java.awt.Point`, `short[][]`, `boolean[][]`
- Map bean properties to the `D20ProImportBundle` schema

### Phase 3: Nashorn Reference Exporter (Parallel)
- Write a d20pro script that serializes `PublicMapModel` fields to the JSON bundle schema
- Include creature data from `setCreatures()` context
- Export floor image as base64 from `_bundleASI` or `_floorURL`
- Use this as ground truth to validate the browser parser
- Distribute as a `.js` file users drop into d20pro's script folder

### Phase 4: Magehand Importer
- Add `.d20_map` to the Import card's accepted formats
- Wire the parser → bundle → store hydration pipeline:
  - Floor image → `CanvasRegion` with background (use `_floorURL` or `_bundleASI`)
  - Walls → `MapObject[]` (category: `'wall'`)
  - Lights → `MapObject[]` (category: `'light'`)
  - Creatures → Token store entries (position × gridScale, footprint mapping)
  - Markers → `MapObject[]` (category: `'annotation'`)
  - FOW polygons → Fog store (both `_fow` and `_polygons`)
  - EasyFOW grid → Convert to fog polygons or use cell-level fog
  - Items → `MapObject[]` (category: `'custom'`)
  - Canvas/mask colors → Map store + fog store config
- Group all imported entities under a single group named after the map

### Phase 5: Validation & Polish
- Test with multiple real d20pro map exports
- Handle edge cases (missing assets, unusual grid scales, legacy format versions)
- Add progress feedback for large imports
- Document the import workflow for users

---

## 6. Remaining Class Definitions Needed

To complete the field-level mapping, we need these d20pro class definitions:

| Class | Purpose | Priority |
|---|---|---|
| `GenericMapWall` | Wall segment geometry and properties | **High** — walls are critical for vision/fog |
| `com.mindgene.d20.common.geometry.Polygon` | FOW/negative space polygon format | **High** — fog import |
| `com.mindgene.d20.common.geometry.Light` | Light source properties | **High** — lighting import |
| `MapMarker` | Annotation marker properties | Medium |
| `MapTemplate` | Spell/zone template shape | Medium |
| `PublicItemInPlay` / `GenericMapObject` | Item properties and footprint | Medium |
| `AutoScalingImageBundle` | Background image scaling/positioning | Medium |
| `PublicCreatureInPlay` | Creature position, size, stats | Medium |

---

## 7. Coordinate System Notes

- **d20pro coordinates**: Grid-cell based. A point `(3, 5)` means column 3, row 5.
- **Magehand coordinates**: Pixel-based. Need to multiply by `_gridScale`.
- **Floor matrix**: `_floor[row][col]` — rows = height, cols = width. `getSize()` returns `Dimension(cols, rows)`.
- **Creature footprint**: `getFootprint()` returns a `Rectangle` in grid space. Size category (byte 0–8) maps to Fine(1/4)→Colossal(6+) grid cells.

---

## 8. Open Questions

1. **Container compression**: Is each entry individually deflate-compressed, or is there a different scheme?
2. **Tile matrix**: Do we need to reconstruct composite floor images from `short[][]`, or is `_floorURL` / `_bundleASI` sufficient for most maps?
3. **Creature stats**: How much creature data should we import? Just position + image, or full stat blocks?
4. **FOW coordinate space**: Are `Polygon` points in grid cells or pixels?
5. **Multi-map campaigns**: Does d20pro export multiple maps in one `.d20_map`, or is it always single-map?
6. **Wall format**: Does `GenericMapWall` use start/end points, polyline vertices, or grid-edge segments?
7. **Creature images**: Are creature images always in `RES/CTR/` or can they reference external URLs?
8. **EasyFOW vs polygon FOW**: Can both coexist on the same map, or is it one or the other?

---

## 9. Risk Assessment

| Risk | Mitigation |
|---|---|
| Binary format varies across d20pro versions | Test with exports from multiple versions; version-detect in header |
| XMLEncoder output has Java-specific types | Build generic bean-to-JS mapper for Color, Point, Dimension, arrays |
| Large floor images exceed browser memory | Stream/chunk image processing; use OffscreenCanvas for compositing |
| Token images reference external URLs | Fall back to placeholder; log warnings |
| Creature data not in serialized map | Parse `RES/CTR/` manifest or require Nashorn export for full creature data |
| Grid-to-pixel coordinate conversion errors | Validate with known grid positions from sample maps |
