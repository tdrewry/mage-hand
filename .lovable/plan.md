

# DD2VTT (Dungeondraft Universal VTT) Import Support

## Overview

Add support for importing `.dd2vtt` files alongside the existing Watabou One-Page-Dungeon JSON importer. The dd2vtt format, created by the Dungeondraft team, is a widely adopted universal VTT exchange format that includes a map image, wall geometry, doors (portals), lights, and environment settings.

## What Gets Imported

| dd2vtt Data | Maps To |
|---|---|
| `image` (base64 PNG) | Region background texture |
| `line_of_sight` (wall polylines) | Wall segments for vision/fog system |
| `portals` (doors) | MapObjects with door category |
| `lights` | LightSource entries in lightStore |
| `environment.ambient_light` | Global ambient light level |
| `resolution` | Map dimensions, grid size |

## dd2vtt Format Summary

The format uses **grid-unit coordinates** (not pixels). A `pixels_per_grid` value (e.g. 70 or 50) defines how to convert to pixel space. Key sections:

- **resolution**: map_origin, map_size (grid units), pixels_per_grid
- **line_of_sight**: arrays of polylines defining walls (each polyline is an array of {x,y} points in grid coords)
- **objects_line_of_sight**: additional vision-blocking lines from placed objects
- **portals**: doors with position, bounds (two endpoints), rotation, closed/open state, freestanding flag
- **lights**: position, range (grid units), intensity, color (ARGB hex string like "ffeccd8b"), shadows flag
- **environment**: baked_lighting flag, ambient_light color
- **image**: base64-encoded PNG of the rendered map

## Implementation Plan

### 1. Type Definitions -- `src/lib/dd2vttTypes.ts` (new file)

Define TypeScript interfaces for the dd2vtt JSON structure:
- `DD2VTTFile` (root type)
- `DD2VTTResolution` (map_origin, map_size, pixels_per_grid)
- `DD2VTTPortal` (position, bounds, rotation, closed, freestanding)
- `DD2VTTLight` (position, range, intensity, color, shadows)
- `DD2VTTEnvironment` (baked_lighting, ambient_light)

### 2. Importer Module -- `src/lib/dd2vttImporter.ts` (new file)

Core conversion logic:

- **`parseDD2VTTFile(file: File)`** -- Read file, parse JSON, validate required fields (resolution, line_of_sight, portals, lights)
- **`importDD2VTTMap(json: DD2VTTFile)`** -- Main conversion function returning:
  - A single `CanvasRegion` covering the full map with the embedded image as background texture
  - Wall segments extracted from `line_of_sight` + `objects_line_of_sight`, converted from grid coords to pixel coords (multiply by `pixels_per_grid`)
  - Portals converted to `DoorConnection`-compatible objects for MapObject door creation
  - Lights converted to `LightSource` format
  - Environment/ambient light settings

**Coordinate conversion**: All dd2vtt coordinates are in grid units. Multiply by `pixels_per_grid` to get pixel positions.

**Portal-to-door conversion**: Each portal has two bound points defining the doorway endpoints. Use the midpoint as position, the distance between bounds as door length, and the `rotation` field for orientation. The `closed` flag maps to `isOpen: !closed`.

**Light color conversion**: dd2vtt uses ARGB hex strings (e.g. "ffeccd8b"). Parse to standard `#RRGGBB` format, extracting alpha separately for intensity modulation.

**Wall segments**: Each polyline in `line_of_sight` becomes a series of connected line segments. These feed into the existing wall geometry system used by the fog/vision engine.

### 3. Update Import UI -- `src/components/cards/WatabouImportCard.tsx`

- Rename the card concept to "Map Import" (or keep as-is and add a format selector)
- Accept both `.json` (Watabou) and `.dd2vtt` files
- Update the file input `accept` attribute to `.json,.dd2vtt`
- Auto-detect format based on file extension
- Route to the appropriate parser (`parseWatabouFile` vs `parseDD2VTTFile`)
- For dd2vtt imports:
  - Store the base64 image as the region's background texture (via textureStorage/IndexedDB)
  - Import wall segments into the region store or wall geometry system
  - Import portals as door MapObjects using existing `convertDoorsToMapObjects`
  - Import lights into the lightStore
  - Apply ambient light setting
- Update the help text to mention both supported formats

### 4. Wall Segment Integration

The dd2vtt `line_of_sight` data provides explicit wall segments, unlike Watabou which derives walls from room geometry. These segments need to feed into the existing vision/fog system:

- Convert polylines to pairs of endpoints (wall segments)
- Store as region wall data or inject into the wall geometry system that `computeVisibilityFromSegments` already consumes
- The existing `wallGeometry.ts` system should work since it already processes line segments

### 5. Image Handling

The base64 PNG image from the dd2vtt file:
- Decode from base64
- Store in IndexedDB via the existing `textureStorage` system (same flow as region background textures)
- Assign the texture hash to the created region
- The region dimensions match the full map size: `map_size.x * pixels_per_grid` by `map_size.y * pixels_per_grid`

---

## Technical Details

### File: `src/lib/dd2vttTypes.ts`
```text
Interfaces:
- DD2VTTFile { format, resolution, line_of_sight, objects_line_of_sight, portals, environment, lights, image }
- DD2VTTResolution { map_origin: {x,y}, map_size: {x,y}, pixels_per_grid: number }
- DD2VTTPortal { position, bounds[2], rotation, closed, freestanding }
- DD2VTTLight { position, range, intensity, color, shadows }
- DD2VTTEnvironment { baked_lighting, ambient_light }
```

### File: `src/lib/dd2vttImporter.ts`
```text
Functions:
- parseDD2VTTFile(file: File) -> DD2VTTFile (validate + parse)
- importDD2VTTMap(json: DD2VTTFile) -> ImportedDD2VTTMap
- convertPortalToDoor(portal, pixelsPerGrid) -> DoorConnection-compatible
- convertDD2VTTLight(light, pixelsPerGrid) -> LightSource
- parseARGBColor(argbHex: string) -> { r, g, b, a }
- extractWallSegments(lineOfSight, pixelsPerGrid) -> {start, end}[]
```

### File: `src/components/cards/WatabouImportCard.tsx`
```text
Changes:
- Accept .dd2vtt files alongside .json
- Auto-detect format by extension
- Add dd2vtt-specific import flow (image storage, wall segments, lights)
- Update UI text to reflect both formats
```

### Stores touched:
- `regionStore` -- Add single full-map region with background image
- `mapObjectStore` -- Add door MapObjects from portals
- `lightStore` -- Add light sources
- `dungeonStore` -- Store wall segment data (if needed)

