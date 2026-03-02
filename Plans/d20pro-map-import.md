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

## 2. d20pro `GenericMapModel` → Magehand Data Model Mapping

### Map-Level Properties

| d20pro Property | Type | Magehand Target | Notes |
|---|---|---|---|
| `getName()` | String | `GameMap.name` | Map display name |
| `getSize()` | Dimension | `GameMap.bounds.width/height` | Canvas dimensions |
| `getCanvasColor()` | Color | `GameMap.backgroundColor` | Background fill |
| `getGridColor()` | Color | `GridRegion.gridColor` | Grid line color |
| `getGridStyle()` | String | `GridRegion.gridType` | Map to `'square'` / `'hex'` / `'none'` |
| `peekGridScale()` | int | `GridRegion.gridSize` | Pixels per grid cell |
| `peekURL()` | String | `CanvasRegion.backgroundImage` | Primary floor image URL/embedded |
| `peekFloorURLOffset()` | Point | `CanvasRegion.backgroundOffsetX/Y` | Floor image alignment |
| `isHideNegativeSpace()` | boolean | Fog store config | Whether unexplored areas are hidden |
| `isUseGradients()` | boolean | Fog effect settings | Gradient fog rendering |
| `isUseExplorationMode()` | boolean | Session/fog config | Progressive reveal mode |
| `isUseGlobalGrid()` | boolean | Region config | Single grid vs per-region |

### Floor Tiles → Region Background

| d20pro | Magehand |
|---|---|
| `peekFloor()` / `peekFloor0()` (tile matrix) | `CanvasRegion.backgroundImage` (composite or per-tile) |
| `accessBundle_AutoScalingImage()` | `CanvasRegion.backgroundScale` |
| `RES/FLR/*.jpg` embedded images | Stored in IndexedDB via texture system |

The tile matrix (`short[][]`) references floor tile IDs. For import, the embedded `RES/FLR/` images are the actual assets — the primary floor image is the most important.

### Creatures → Tokens

| d20pro Property | Magehand Target | Notes |
|---|---|---|
| `AbstractCreatureInPlay.position` | Token position | Grid coordinates → pixel coordinates |
| `AbstractCreatureInPlay.name` | Token label | Display name |
| `GenericCreatureModel` | Token metadata | Stats, HP, etc. |
| `RES/CTR/*.png` | Token image | Stored in IndexedDB |
| Creature size category | Token `footprint` | Map Medium/Large/Huge → grid cells |

### Walls → MapObjects (Wall)

| d20pro | Magehand |
|---|---|
| `GenericMapWall` list | `MapObject` with `category: 'wall'` |
| Wall start/end points | `wallPoints` array |
| Wall properties (blocks vision/movement) | `blocksVision`, `blocksMovement` |

### Fog of War

| d20pro | Magehand |
|---|---|
| `getFOWPolygons()` | Fog store polygon data |
| `peekEasyFOW()` (boolean grid) | Convert to polygon regions |
| `getPolygons()` | Negative space regions |
| `peekNegativeSpace()` (Area) | Fog mask geometry |

### Lights → MapObjects (Light)

| d20pro | Magehand |
|---|---|
| `Light.position` | `MapObject.position` |
| `Light.color` | `lightColor` |
| `Light.radius` | `lightRadius` (convert grid units → pixels) |
| `Light.intensity` | `lightIntensity` |
| `LIGHTS.manifest` | Batch creation of light MapObjects |

### Templates → MapObjects (Various)

| d20pro | Magehand |
|---|---|
| `MapTemplate` (spell areas, zones) | `MapObject` with appropriate category |
| Template shape/size | `width`, `height`, `customPath` |

### Map Markers → MapObjects (Annotation)

| d20pro | Magehand |
|---|---|
| `MapMarker.position` | `MapObject.position` |
| `MapMarker.text` | `annotationText` |
| `MapMarker.label` | `annotationReference` |

### Items → MapObjects (Custom)

| d20pro | Magehand |
|---|---|
| `PublicItemInPlay` | `MapObject` with `category: 'custom'` or `'decoration'` |

---

## 3. Magehand Import JSON Schema

The canonical intermediate format that both the Nashorn exporter and browser parser produce:

```typescript
interface D20ProImportBundle {
  version: 1;
  source: 'd20pro';
  
  map: {
    name: string;
    width: number;          // pixels
    height: number;         // pixels
    backgroundColor: string; // hex color
    gridSize: number;        // pixels per cell
    gridType: 'square' | 'hex' | 'none';
    gridColor: string;       // hex color
    explorationMode: boolean;
    hideNegativeSpace: boolean;
  };
  
  // Base64-encoded images keyed by original path
  assets: Record<string, {
    data: string;       // base64
    mimeType: string;   // 'image/png' | 'image/jpeg'
    role: 'floor' | 'creature' | 'overlay';
  }>;
  
  floorImage?: {
    assetKey: string;   // key into assets
    offsetX: number;
    offsetY: number;
    scale: number;
  };
  
  creatures: Array<{
    name: string;
    x: number;           // pixel position
    y: number;
    size: number;         // footprint in grid cells
    imageAssetKey?: string;
    hp?: { current: number; max: number };
  }>;
  
  walls: Array<{
    points: Array<{ x: number; y: number }>;
    blocksVision: boolean;
    blocksMovement: boolean;
  }>;
  
  lights: Array<{
    x: number;
    y: number;
    color: string;
    radius: number;       // pixels
    brightRadius: number; // pixels
    intensity: number;    // 0-1
    enabled: boolean;
  }>;
  
  fogPolygons: Array<{
    points: Array<{ x: number; y: number }>;
    type: 'revealed' | 'hidden';
  }>;
  
  markers: Array<{
    x: number;
    y: number;
    label: string;
    text: string;
  }>;
}
```

---

## 4. Implementation Phases

### Phase 1: Container Parser
- Reverse-engineer `~oGBo~` binary format using the sample file
- Build a TypeScript parser that extracts the file table and entry blobs
- Validate by extracting known images (`RES/FLR/`, `RES/CTR/`)

### Phase 2: XML Map Data Parser  
- Decompress the `maps/000*.d20_map` entry
- Parse Java XMLEncoder XML into a JS object tree
- Map bean properties to the `D20ProImportBundle` schema

### Phase 3: Nashorn Reference Exporter (Parallel)
- Write a d20pro script that serializes `GenericMapModel` to the JSON bundle schema
- Use this as ground truth to validate the browser parser
- Distribute as a `.js` file users drop into d20pro's script folder

### Phase 4: Magehand Importer
- Add `.d20_map` to the Import card's accepted formats
- Wire the parser → bundle → store hydration pipeline:
  - Floor image → `CanvasRegion` with background
  - Walls → `MapObject[]` (category: `'wall'`)
  - Lights → `MapObject[]` (category: `'light'`)
  - Creatures → Token store entries
  - Markers → `MapObject[]` (category: `'annotation'`)
  - FOW polygons → Fog store
- Group all imported entities under a single group named after the map

### Phase 5: Validation & Polish
- Test with multiple real d20pro map exports
- Handle edge cases (missing assets, unusual grid scales, legacy format versions)
- Add progress feedback for large imports
- Document the import workflow for users

---

## 5. Open Questions

1. **Container compression**: Is each entry individually deflate-compressed, or is there a different scheme? Need to test with the sample file.
2. **Tile matrix**: Do we need to reconstruct composite floor images from the `short[][]` tile grid, or is the `peekURL()` image sufficient for most maps?
3. **Creature stats**: How much creature data should we import? Just position + image, or full stat blocks?
4. **FOW format**: Are the FOW polygons in world-space pixels or grid-space coordinates?
5. **Multi-map campaigns**: Does d20pro export multiple maps in one file, or is each `.d20_map` a single map?
6. **Wall format**: Does `GenericMapWall` use start/end points, or polyline vertices?

---

## 6. Risk Assessment

| Risk | Mitigation |
|---|---|
| Binary format varies across d20pro versions | Test with exports from multiple versions; version-detect in header |
| XMLEncoder output has Java-specific types | Build a generic bean-to-JS mapper; handle `java.awt.Color`, `java.awt.Point`, etc. |
| Large floor images exceed browser memory | Stream/chunk image processing; use OffscreenCanvas for compositing |
| Token images reference external URLs | Fall back to placeholder; log warnings |
