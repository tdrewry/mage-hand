# Codebase Audit & Cleanup Plan

## Date: 2026-03-03

## Findings

### 1. Deprecated Terrain Stubs (dungeonStore.ts)
- `addTerrainFeature`, `updateTerrainFeature`, `removeTerrainFeature`, `clearTerrainFeatures`, `setTerrainFeatures` are no-op stubs with zero consumers
- **Action:** Remove from interface and implementation

### 2. Deprecated `onOpenMapManager` Prop
- Present in VerticalToolbar (marked `@deprecated`), SimpleTabletop (passes `undefined`), cardTypes.ts (ToolsCardProps), ToolsCard.tsx
- Map Manager now uses card system exclusively
- **Action:** Remove prop from all locations

### 3. Stale "Sync happens automatically" Comments
- 220+ instances across sessionStore, mapStore, regionStore, lightStore, initiativeStore
- syncPatch is a no-op passthrough stub — these comments are misleading
- **Action:** Remove all instances

### 4. Deprecated Card Types
- `CardType.TOOLS` — replaced by VerticalToolbar, renders `null`
- `CardType.LAYERS` — replaced by Map Tree, renders `null`
- `CardType.BACKGROUND_GRID` — removed in multi-map architecture, renders `null`
- Keep enum values (used in deprecation filter in cardStore.ts) but remove default configs and null render cases
- Remove `ToolsCardProps` from cardTypes.ts (ToolsCard has its own interface)
- Remove `toolsCardProps` from CardManager

### 5. Stale Comments in SimpleTabletop
- Line 14: `// MapManager import removed — now uses card system exclusively`
- Line 152: `// showMapManager state removed — Map Manager now uses the card system exclusively`

### 6. Future Consideration (NOT in this pass)
- SimpleTabletop.tsx is 10,776 lines — needs major decomposition but is too risky for a cleanup pass
- Consider extracting: token rendering, fog rendering, region interaction, input handling
