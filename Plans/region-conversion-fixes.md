# Region Conversion Fixes (v0.5.51)

## Changes

### 1. Wall Position Fix
- Wall `wallPoints` use absolute coordinates, so `position` is now `{x:0, y:0}` instead of duplicating the first point's coordinates (which caused double-offset rendering).

### 2. Undo/Redo for Region Conversions
- New `ConvertRegionToMapObjectCommand` in `regionCommands.ts`
- On undo: removes the created MapObject and restores the original region
- On redo: removes the region and re-creates the MapObject with the same ID
- Uses `undoRedoManager.push()` (action already executed, just registering for undo)

### 3. Convert Popover Menu
- Replaced individual Portal/Walls/Obstacle/Furniture/Water buttons with a single "Convert" button that opens a Popover menu
- Uses the same pattern as illumination selection in the toolbar
- Portal option only shown for single-region selections
