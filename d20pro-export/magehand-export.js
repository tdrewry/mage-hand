/**
 * Magehand Export Script for d20pro (Nashorn)
 * 
 * This script runs inside d20pro's Nashorn scripting engine and serializes
 * the current map (GenericMapModel) into a Magehand-compatible JSON bundle.
 * 
 * The output file (.magehand.json) can be imported directly into Magehand's
 * Import card.
 * 
 * Usage in d20pro:
 *   1. Place this file in your d20pro scripts directory
 *   2. Open the map you want to export
 *   3. Run the script via the scripting console
 *   4. The export file is written to the d20pro user directory
 * 
 * Schema version: 1
 * Target: D20ProImportBundle (see Plans/d20pro-map-import.md)
 */

// ─── Java type imports ───────────────────────────────────────────────────────

var File            = Java.type('java.io.File');
var FileWriter      = Java.type('java.io.FileWriter');
var BufferedWriter   = Java.type('java.io.BufferedWriter');
var ByteArrayOutputStream = Java.type('java.io.ByteArrayOutputStream');
var Base64          = Java.type('java.util.Base64');
var ImageIO         = Java.type('javax.imageio.ImageIO');
var Color           = Java.type('java.awt.Color');
var Point           = Java.type('java.awt.Point');

// ─── Utility: Java type → JS conversions ─────────────────────────────────────

/**
 * Convert java.awt.Color to hex string "#rrggbb" or "#rrggbbaa"
 */
function colorToHex(color) {
  if (color == null) return '#000000';
  var r = _pad(color.getRed());
  var g = _pad(color.getGreen());
  var b = _pad(color.getBlue());
  var a = color.getAlpha();
  if (a < 255) {
    return '#' + r + g + b + _pad(a);
  }
  return '#' + r + g + b;
}

function _pad(n) {
  var s = java.lang.Integer.toHexString(n & 0xFF);
  return s.length < 2 ? '0' + s : s;
}

/**
 * Convert java.awt.Point to { x, y }
 */
function pointToObj(pt) {
  if (pt == null) return { x: 0, y: 0 };
  return { x: pt.x, y: pt.y };
}

/**
 * Convert a Java List/ArrayList to a JS array, applying mapFn to each element.
 */
function javaListToArray(javaList, mapFn) {
  var arr = [];
  if (javaList == null) return arr;
  var it = javaList.iterator();
  while (it.hasNext()) {
    var item = it.next();
    arr.push(mapFn ? mapFn(item) : item);
  }
  return arr;
}

/**
 * Convert a Java short[][] to a JS number[][].
 */
function shortMatrixToArray(matrix) {
  if (matrix == null) return null;
  var rows = [];
  for (var r = 0; r < matrix.length; r++) {
    var row = [];
    for (var c = 0; c < matrix[r].length; c++) {
      row.push(matrix[r][c]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Convert a Java boolean[][] to a JS boolean[][].
 */
function boolMatrixToArray(matrix) {
  if (matrix == null) return null;
  var rows = [];
  for (var r = 0; r < matrix.length; r++) {
    var row = [];
    for (var c = 0; c < matrix[r].length; c++) {
      row.push(!!matrix[r][c]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Encode a BufferedImage to base64 PNG string.
 */
function imageToBase64(bufferedImage, format) {
  if (bufferedImage == null) return null;
  format = format || 'png';
  var baos = new ByteArrayOutputStream();
  ImageIO.write(bufferedImage, format, baos);
  baos.flush();
  var bytes = baos.toByteArray();
  baos.close();
  return Base64.getEncoder().encodeToString(bytes);
}

/**
 * Determine grid type string from d20pro's gridStyle.
 */
function mapGridStyle(gridStyle) {
  if (gridStyle == null) return 'square';
  var s = ('' + gridStyle).toLowerCase().trim();
  if (s === 'hex' || s.indexOf('hex') >= 0) return 'hex';
  if (s === 'none' || s === 'off') return 'none';
  return 'square';
}

/**
 * Map d20pro creature size byte to grid-cell footprint.
 * 0=Fine(0.5), 1=Diminutive(0.5), 2=Tiny(0.5), 3=Small(1), 4=Medium(1),
 * 5=Large(2), 6=Huge(3), 7=Gargantuan(4), 8=Colossal(6)
 */
function sizeToGridCells(sizeByte) {
  var map = { 0: 0.5, 1: 0.5, 2: 0.5, 3: 1, 4: 1, 5: 2, 6: 3, 7: 4, 8: 6 };
  return map[sizeByte] || 1;
}

// ─── Export functions ────────────────────────────────────────────────────────

/**
 * Export a d20pro Polygon (com.mindgene.d20.common.geometry.Polygon) to
 * a points array in pixel coordinates.
 * 
 * NOTE: The exact Polygon API needs verification. Common patterns:
 *   - polygon.xpoints / polygon.ypoints (int arrays)
 *   - polygon.npoints (count)
 * Adjust accessors below based on actual class definition.
 */
function exportPolygon(polygon, gridScale) {
  var points = [];
  try {
    // Attempt 1: java.awt.Polygon-style API
    var n = polygon.npoints || 0;
    var xp = polygon.xpoints;
    var yp = polygon.ypoints;
    for (var i = 0; i < n; i++) {
      points.push({
        x: xp[i] * gridScale,
        y: yp[i] * gridScale
      });
    }
  } catch (e) {
    // Attempt 2: custom Polygon with getPoints() or similar
    try {
      var pts = polygon.getPoints();
      var it = pts.iterator();
      while (it.hasNext()) {
        var pt = it.next();
        points.push({ x: pt.x * gridScale, y: pt.y * gridScale });
      }
    } catch (e2) {
      print('[WARN] Could not extract polygon points: ' + e2);
    }
  }
  return points;
}

/**
 * Export a Light (com.mindgene.d20.common.geometry.Light).
 * 
 * NOTE: Light field accessors need verification. Adjust based on actual class.
 */
function exportLight(light, gridScale) {
  var result = {
    x: 0, y: 0,
    color: '#fbbf24',
    radius: 60,
    brightRadius: 30,
    intensity: 1.0,
    enabled: true
  };

  try {
    // Try common accessor patterns
    if (light.getPosition) {
      var pos = light.getPosition();
      result.x = pos.x * gridScale;
      result.y = pos.y * gridScale;
    } else if (light.x !== undefined) {
      result.x = light.x * gridScale;
      result.y = light.y * gridScale;
    }

    if (light.getColor) {
      result.color = colorToHex(light.getColor());
    } else if (light.color) {
      result.color = colorToHex(light.color);
    }

    if (light.getRadius) {
      var r = light.getRadius();
      result.radius = r * gridScale;
      result.brightRadius = (r * gridScale) * 0.5;
    } else if (light.radius !== undefined) {
      result.radius = light.radius * gridScale;
      result.brightRadius = (light.radius * gridScale) * 0.5;
    }

    if (light.getIntensity) {
      result.intensity = light.getIntensity();
    } else if (light.intensity !== undefined) {
      result.intensity = light.intensity;
    }

    if (light.isEnabled) {
      result.enabled = light.isEnabled();
    }
  } catch (e) {
    print('[WARN] Light export fallback: ' + e);
  }

  return result;
}

/**
 * Export a GenericMapWall.
 * 
 * NOTE: Wall accessor patterns need verification. Common shapes:
 *   - start/end Point pairs
 *   - polyline vertex lists
 *   - blocksVision / blocksMovement flags
 */
function exportWall(wall, gridScale) {
  var result = {
    points: [],
    blocksVision: true,
    blocksMovement: true
  };

  try {
    // Pattern 1: start/end points
    if (wall.getStart && wall.getEnd) {
      var s = wall.getStart();
      var e = wall.getEnd();
      result.points = [
        { x: s.x * gridScale, y: s.y * gridScale },
        { x: e.x * gridScale, y: e.y * gridScale }
      ];
    }
    // Pattern 2: polyline points
    else if (wall.getPoints) {
      result.points = javaListToArray(wall.getPoints(), function(pt) {
        return { x: pt.x * gridScale, y: pt.y * gridScale };
      });
    }
    // Pattern 3: vertices array
    else if (wall.getVertices) {
      result.points = javaListToArray(wall.getVertices(), function(pt) {
        return { x: pt.x * gridScale, y: pt.y * gridScale };
      });
    }

    // Property flags
    if (wall.blocksVision !== undefined) result.blocksVision = !!wall.blocksVision;
    if (wall.isBlocksVision) result.blocksVision = wall.isBlocksVision();
    if (wall.blocksMovement !== undefined) result.blocksMovement = !!wall.blocksMovement;
    if (wall.isBlocksMovement) result.blocksMovement = wall.isBlocksMovement();
  } catch (e) {
    print('[WARN] Wall export fallback: ' + e);
  }

  return result;
}

/**
 * Export a MapMarker.
 */
function exportMarker(marker, gridScale) {
  var result = { x: 0, y: 0, label: '', text: '' };

  try {
    if (marker.getPosition) {
      var pos = marker.getPosition();
      result.x = pos.x * gridScale;
      result.y = pos.y * gridScale;
    } else if (marker.position) {
      result.x = marker.position.x * gridScale;
      result.y = marker.position.y * gridScale;
    }

    result.label = '' + (marker.getLabel ? marker.getLabel() : (marker.label || ''));
    result.text = '' + (marker.getText ? marker.getText() : (marker.text || ''));
  } catch (e) {
    print('[WARN] Marker export fallback: ' + e);
  }

  return result;
}

/**
 * Export a creature (AbstractCreatureInPlay / PublicCreatureInPlay).
 */
function exportCreature(creature, gridScale) {
  var result = {
    name: '',
    x: 0,
    y: 0,
    size: 1,
    uin: '0',
    hp: null
  };

  try {
    result.name = '' + (creature.getName ? creature.getName() : (creature.name || 'Unknown'));
    result.uin = '' + (creature.getUIN ? creature.getUIN() : '0');

    // Position from footprint or direct location
    if (creature.getFootprint) {
      var fp = creature.getFootprint();
      result.x = fp.x * gridScale;
      result.y = fp.y * gridScale;
    } else if (creature.getLocation) {
      var loc = creature.getLocation();
      result.x = loc.x * gridScale;
      result.y = loc.y * gridScale;
    }

    // Size from template
    if (creature.getTemplate) {
      var tmpl = creature.getTemplate();
      if (tmpl) {
        result.size = sizeToGridCells(tmpl.getSize());
        try {
          result.hp = {
            current: tmpl.getHP(),
            max: tmpl.getMaxHP ? tmpl.getMaxHP() : tmpl.getHP()
          };
        } catch (ignore) {}
      }
    }
  } catch (e) {
    print('[WARN] Creature export fallback: ' + e);
  }

  return result;
}

/**
 * Export an item (PublicItemInPlay).
 */
function exportItem(item, gridScale) {
  var result = { name: '', x: 0, y: 0, width: 0, height: 0 };

  try {
    result.name = '' + (item.getName ? item.getName() : (item.name || 'Item'));

    if (item.getFootprint) {
      var fp = item.getFootprint();
      result.x = fp.x * gridScale;
      result.y = fp.y * gridScale;
      result.width = fp.width * gridScale;
      result.height = fp.height * gridScale;
    }
  } catch (e) {
    print('[WARN] Item export fallback: ' + e);
  }

  return result;
}

// ─── Main export function ────────────────────────────────────────────────────

/**
 * Export the given GenericMapModel to a D20ProImportBundle JSON object.
 * 
 * @param {GenericMapModel} map - The map model to export
 * @param {object} options - Optional configuration
 * @param {boolean} options.includeCreatures - Include creature data (default: true)
 * @param {boolean} options.includeFloorImage - Attempt to export floor image as base64 (default: true)
 * @param {boolean} options.includeFOW - Include fog-of-war data (default: true)
 * @returns {object} D20ProImportBundle
 */
function exportMap(map, options) {
  options = options || {};
  var includeCreatures = options.includeCreatures !== false;
  var includeFloorImage = options.includeFloorImage !== false;
  var includeFOW = options.includeFOW !== false;

  var gridScale = Math.max(map.peekGridScale(), 1);
  var size = map.getSize(); // Dimension: width = cols, height = rows

  var bundle = {
    version: 1,
    source: 'd20pro',
    sourceMapUIN: '' + (map.getUIN() || '0'),
    exportedAt: new Date().toISOString(),

    map: {
      name: '' + map.getName(),
      width: size.width * gridScale,
      height: size.height * gridScale,
      backgroundColor: colorToHex(map.getCanvasColor()),
      maskColor: colorToHex(map.getMaskColor()),
      gridSize: gridScale,
      gridType: mapGridStyle(map.getGridStyle()),
      gridColor: colorToHex(map.getGridColor()),
      explorationMode: !!map.isUseExplorationMode(),
      hideNegativeSpace: !!map.isHideNegativeSpace(),
      useGradients: !!map.isUseGradients(),
      showStatusMarkers: '' + map.isShowStatusMarkers()
    },

    assets: {},

    floorImage: null,
    overlayImage: null,

    creatures: [],
    creatureRenderOrder: [],

    walls: [],
    lights: [],

    fogPolygons: [],
    negativeSpacePolygons: [],
    easyFOW: null,

    markers: [],
    items: [],
    templates: []
  };

  // ── Floor image ──────────────────────────────────────────────────────────

  var floorURL = map.peekURL ? map.peekURL() : null;
  if (floorURL) {
    bundle.floorImage = {
      assetKey: 'floor:url',
      offsetX: 0,
      offsetY: 0,
      scale: 1
    };

    // Combine offsets
    var floorOff = map.peekFloorURLOffset ? map.peekFloorURLOffset() : null;
    var shiftOff = map.peekShiftURLOffset ? map.peekShiftURLOffset() : null;
    if (floorOff) {
      bundle.floorImage.offsetX += floorOff.x;
      bundle.floorImage.offsetY += floorOff.y;
    }
    if (shiftOff) {
      bundle.floorImage.offsetX += shiftOff.x;
      bundle.floorImage.offsetY += shiftOff.y;
    }

    // If the floor URL points to an embedded resource, try to export as base64
    if (includeFloorImage) {
      try {
        var asi = map.accessBundle_AutoScalingImage();
        if (asi != null && asi.getImage) {
          var img = asi.getImage();
          if (img != null) {
            var b64 = imageToBase64(img, 'jpg');
            if (b64) {
              bundle.assets['floor:url'] = {
                data: b64,
                mimeType: 'image/jpeg',
                role: 'floor'
              };
            }
          }
        }
      } catch (e) {
        print('[INFO] Could not export floor image as base64: ' + e);
        print('[INFO] Floor URL reference preserved: ' + floorURL);
      }
    }

    // Store the original URL as metadata even if we couldn't embed the image
    if (!bundle.assets['floor:url']) {
      bundle.assets['floor:url'] = {
        data: '',
        mimeType: 'image/jpeg',
        role: 'floor',
        originalURL: '' + floorURL
      };
    }
  }

  // Overlay
  var overlayURL = map.peekOverlayURL ? map.peekOverlayURL() : null;
  if (overlayURL) {
    bundle.overlayImage = { assetKey: 'overlay:url' };
    bundle.assets['overlay:url'] = {
      data: '',
      mimeType: 'image/png',
      role: 'overlay',
      originalURL: '' + overlayURL
    };
  }

  // ── Walls ────────────────────────────────────────────────────────────────

  bundle.walls = javaListToArray(map.getWalls(), function(wall) {
    return exportWall(wall, gridScale);
  });

  // ── Lights ───────────────────────────────────────────────────────────────

  bundle.lights = javaListToArray(map.getLights(), function(light) {
    return exportLight(light, gridScale);
  });

  // ── FOW ──────────────────────────────────────────────────────────────────

  if (includeFOW) {
    // FOW reveal polygons
    bundle.fogPolygons = javaListToArray(map.getFOWPolygons(), function(poly) {
      return {
        points: exportPolygon(poly, gridScale),
        type: 'revealed'
      };
    });

    // Negative space polygons
    bundle.negativeSpacePolygons = javaListToArray(map.getPolygons(), function(poly) {
      return {
        points: exportPolygon(poly, gridScale)
      };
    });

    // Easy FOW grid
    var easyFOW = map.peekEasyFOW ? map.peekEasyFOW() : null;
    if (easyFOW != null) {
      bundle.easyFOW = {
        grid: boolMatrixToArray(easyFOW),
        cellSize: gridScale
      };
    }
  }

  // ── Markers ──────────────────────────────────────────────────────────────

  if (map.accessMarkers) {
    bundle.markers = javaListToArray(map.accessMarkers(), function(marker) {
      return exportMarker(marker, gridScale);
    });
  }

  // ── Templates ────────────────────────────────────────────────────────────

  bundle.templates = javaListToArray(map.getTemplates(), function(tmpl) {
    var result = { id: '' + tmpl.getId() };
    // TODO: Export template shape, size, position once MapTemplate class is known
    return result;
  });

  // ── Creatures ────────────────────────────────────────────────────────────

  if (includeCreatures) {
    var creatures = map.getCreatures();
    bundle.creatures = javaListToArray(creatures, function(creature) {
      return exportCreature(creature, gridScale);
    });

    // Build render order from creature list order (last = front)
    bundle.creatureRenderOrder = [];
    for (var i = 0; i < bundle.creatures.length; i++) {
      bundle.creatureRenderOrder.push(bundle.creatures[i].uin);
    }
  }

  // ── Items ────────────────────────────────────────────────────────────────

  bundle.items = javaListToArray(map.getItems(), function(item) {
    return exportItem(item, gridScale);
  });

  return bundle;
}

// ─── File output ─────────────────────────────────────────────────────────────

/**
 * Serialize the bundle to a JSON string (Nashorn-compatible).
 * Uses Java's built-in JSON support or manual serialization.
 */
function toJSON(obj) {
  // Nashorn supports JSON.stringify
  return JSON.stringify(obj, null, 2);
}

/**
 * Write a string to a file.
 */
function writeFile(path, content) {
  var writer = new BufferedWriter(new FileWriter(new File(path)));
  writer.write(content);
  writer.flush();
  writer.close();
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Main entry point. Call this from d20pro's scripting console.
 * 
 * Expected globals (provided by d20pro's scripting context):
 *   - currentMap: GenericMapModel (the currently active map)
 *   - app: AbstractApp (the application instance)
 *   - userDir: String (path to user's d20pro directory)
 * 
 * If these globals don't exist, adjust the variable names below
 * to match d20pro's actual scripting API.
 */
function main() {
  print('=== Magehand Export Script v1.0 ===');

  // ── Obtain the map model ──────────────────────────────────────────────────
  // Adjust these accessors to match d20pro's scripting API:
  var map;
  try {
    // Try common d20pro scripting globals
    if (typeof currentMap !== 'undefined') {
      map = currentMap;
    } else if (typeof app !== 'undefined' && app.getMapModel) {
      map = app.getMapModel();
    } else if (typeof app !== 'undefined' && app.getCurrentMap) {
      map = app.getCurrentMap();
    } else {
      print('[ERROR] Cannot find the map model.');
      print('  Expected one of: currentMap, app.getMapModel(), app.getCurrentMap()');
      print('  Please check d20pro scripting API and adjust this script.');
      return;
    }
  } catch (e) {
    print('[ERROR] Failed to access map model: ' + e);
    return;
  }

  if (map == null) {
    print('[ERROR] No map is currently loaded.');
    return;
  }

  var mapName = '' + map.getName();
  print('Exporting map: ' + mapName);

  // ── Export ────────────────────────────────────────────────────────────────

  var bundle;
  try {
    bundle = exportMap(map, {
      includeCreatures: true,
      includeFloorImage: true,
      includeFOW: true
    });
  } catch (e) {
    print('[ERROR] Export failed: ' + e);
    e.printStackTrace();
    return;
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  print('Export summary:');
  print('  Map size: ' + bundle.map.width + ' x ' + bundle.map.height + ' px');
  print('  Grid: ' + bundle.map.gridType + ' @ ' + bundle.map.gridSize + 'px');
  print('  Walls: ' + bundle.walls.length);
  print('  Lights: ' + bundle.lights.length);
  print('  Creatures: ' + bundle.creatures.length);
  print('  FOW polygons: ' + bundle.fogPolygons.length);
  print('  Neg. space polygons: ' + bundle.negativeSpacePolygons.length);
  print('  Markers: ' + bundle.markers.length);
  print('  Items: ' + bundle.items.length);
  print('  Assets: ' + Object.keys(bundle.assets).length);

  // ── Write file ───────────────────────────────────────────────────────────

  // Sanitize map name for filename
  var safeName = mapName.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
  var filename = safeName + '.magehand.json';

  // Determine output path
  var outputDir;
  try {
    if (typeof userDir !== 'undefined') {
      outputDir = '' + userDir;
    } else {
      outputDir = java.lang.System.getProperty('user.home') + '/d20pro-exports';
    }
  } catch (e) {
    outputDir = '.';
  }

  var outputPath = outputDir + '/' + filename;

  try {
    // Ensure output directory exists
    var dir = new File(outputDir);
    if (!dir.exists()) dir.mkdirs();

    var json = toJSON(bundle);
    writeFile(outputPath, json);
    print('');
    print('✓ Exported to: ' + outputPath);
    print('  File size: ~' + Math.round(json.length / 1024) + ' KB');
    print('');
    print('To import in Magehand:');
    print('  1. Open the Import card');
    print('  2. Drop or select the .magehand.json file');
  } catch (e) {
    print('[ERROR] Failed to write file: ' + e);
    print('  Attempted path: ' + outputPath);

    // Fallback: try current directory
    try {
      writeFile(filename, toJSON(bundle));
      print('  Fallback: wrote to current directory: ' + filename);
    } catch (e2) {
      print('  Fallback also failed: ' + e2);
    }
  }
}

// Run
main();
