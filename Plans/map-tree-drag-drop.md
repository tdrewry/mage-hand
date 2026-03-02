# Map Tree Drag & Drop

## Goal
Enable drag-and-drop for all entity types (tokens, regions, mapObjects, lights, groups) in the Map Tree card with multi-select support.

## Changes
1. **EntityRow**: Make all entity types draggable (remove mapObject-only restriction)
2. **Multi-select drag**: When dragging a selected entity, include all selected entities in the drag operation
3. **GroupNode drop target**: Drop entities on a group header to add them to that group
4. **Map node drop target**: Drop entities on a map header to reassign their mapId
5. **Visual indicators**: Highlight drop targets during drag
6. **Group dragging**: Groups themselves are draggable for tree reorder
