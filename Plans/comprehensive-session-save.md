# Comprehensive Session Save/Load

## Problem
Save Session and Load Session were not capturing/restoring all game state. Many stores were missing from the save pipeline, and the load pipeline (`applyAndLaunch`) only restored tokens, maps, regions, lights, and roles.

## Changes (v0.5.55)

### ProjectData Interface Extended
Added new optional fields:
- `illumination` — unified IlluminationSource lights + globalAmbientLight
- `creatures` — characters (DndBeyondCharacter[]) and monsters (Monster5eTools[])
- `hatching` — enabled flag + DysonHatchingOptions
- `viewportTransforms` — per-map viewport state

### Save (`createCurrentProjectData`)
Now includes:
- All existing fields (tokens, maps, regions, groups, initiative, roles, visionProfiles, fog, lights, cards, dungeon, mapObjects)
- **NEW**: illumination store (unified lights + ambient)
- **NEW**: creature store (characters + monsters)
- **NEW**: hatching store (enabled + options)
- **NEW**: viewport transforms per map
- **FIX**: dungeonData now includes `lightSources`, `renderingMode`, `enforceMovementBlocking`, `enforceRegionBounds`

### Load (`applyAndLaunch`)
Previously only restored: tokens, maps, regions, lights, roles.
Now restores ALL state:
- Groups (via `restoreGroup`)
- MapObjects
- Initiative (order, combat state, turn index, movement restriction)
- Fog of war (per-map settings, explored areas, realtime vision settings)
- Dungeon data (doors, walls, light sources, rendering mode, styles, movement blocking)
- Vision profiles
- Illumination store
- Creatures (characters + monsters)
- Hatching settings
- Viewport transforms
- Token/label visibility settings

### AutoSaveManager
- Subscribes to illumination, creature, and hatching stores
- Includes all new fields in auto-save data
