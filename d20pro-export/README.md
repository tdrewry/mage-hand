# d20pro → Magehand Export Script

This Nashorn script runs inside **d20pro** and exports the current map to a `.magehand.json` file that can be imported into Magehand.

## Quick Start

1. Copy `magehand-export.js` into your d20pro scripts directory
2. Open the map you want to export in d20pro
3. Run the script from d20pro's scripting console
4. Find the exported `.magehand.json` file in your d20pro user directory (or `~/d20pro-exports/`)
5. In Magehand, open the **Import** card and drop the `.magehand.json` file

## What Gets Exported

| Feature | Status | Notes |
|---------|--------|-------|
| Map dimensions & grid | ✅ | Size, grid scale, grid type, colors |
| Floor image | ✅ | Via AutoScalingImageBundle (base64) or URL reference |
| Walls | ✅ | Geometry + vision/movement blocking flags |
| Lights | ✅ | Position, color, radius, intensity |
| FOW polygons | ✅ | Revealed regions |
| Negative space | ✅ | Permanent fog polygons |
| Easy FOW grid | ✅ | Cell-level boolean grid |
| Creatures | ✅ | Position, size, HP, render order |
| Map markers | ✅ | Position, label, text |
| Items | ✅ | Position, size |
| Overlay/Weather URLs | ⚠️ | URL reference only (not embedded) |
| Creature images | ⚠️ | Not yet embedded — needs RES/CTR/ access |
| Templates | ⚠️ | ID only — shape export TBD |

## Customization

The `main()` function at the bottom of the script assumes certain d20pro scripting globals (`currentMap`, `app`, `userDir`). If your d20pro version uses different names, edit the accessor lines in `main()`.

The `exportMap()` function accepts options:

```javascript
exportMap(map, {
  includeCreatures: true,   // Set false to skip creatures
  includeFloorImage: true,  // Set false to skip base64 floor image
  includeFOW: true          // Set false to skip fog data
});
```

## Adapting to Your d20pro Version

Several export functions use **multiple accessor patterns** (e.g., `wall.getStart()` vs `wall.getPoints()`) because the exact API depends on your d20pro version. The script logs warnings when a pattern doesn't match, so check the console output after running.

Key classes that may need accessor adjustments:
- `GenericMapWall` — wall geometry
- `com.mindgene.d20.common.geometry.Polygon` — FOW polygon points
- `com.mindgene.d20.common.geometry.Light` — light properties
- `MapMarker` — annotation data

## Output Schema

The export produces a `D20ProImportBundle` JSON object. See `Plans/d20pro-map-import.md` for the full schema definition and field mapping documentation.
