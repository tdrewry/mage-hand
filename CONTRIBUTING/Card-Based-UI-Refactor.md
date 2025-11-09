# Card-Based UI Refactor - Implementation Plan

## Overview

This document outlines the complete refactoring plan to transform the current VTT UI into a modular, card-based interface. Each card will be draggable, resizable, and minimizable, providing a flexible and modern user experience.

## Goals

- **Modularity**: Break down monolithic components into focused, reusable cards
- **Flexibility**: Allow users to arrange their workspace as they prefer
- **Scalability**: Make it easy to add new features as cards
- **Modern UX**: Provide a clean, organized interface that reduces clutter
- **Mobile-Ready**: Design cards to adapt to different screen sizes

---

## Phase 1: Card Infrastructure

**Goal**: Create the foundation for the card-based system

### Tasks

#### 1.1 Create Base Card Component
- [x] Create `src/components/cards/BaseCard.tsx`
  - [x] Implement draggable functionality using native drag API or library
  - [x] Add resize handles using `react-resizable-panels` or custom implementation
  - [x] Add minimize/maximize toggle
  - [x] Add close button (optional per card)
  - [x] Implement card header with title and controls
  - [x] Add z-index management for focused cards
  - [x] Style with semantic tokens from design system

#### 1.2 Create Card State Management
- [x] Create `src/stores/cardStore.ts`
  - [x] Define `CardState` interface (id, position, size, isMinimized, isVisible, zIndex)
  - [x] Implement `cards` array to track all card instances
  - [x] Add actions: `registerCard`, `unregisterCard`, `updateCardPosition`, `updateCardSize`
  - [x] Add actions: `toggleMinimize`, `toggleVisibility`, `bringToFront`
  - [x] Add actions: `saveLayout`, `loadLayout`, `resetLayout`
  - [x] Implement persistence with localStorage
  - [x] Add default positions and sizes for each card type

#### 1.3 Create Card Manager Component
- [x] Create `src/components/CardManager.tsx`
  - [x] Render all registered cards
  - [x] Handle card focus/blur events
  - [x] Manage card z-index stacking
  - [x] Provide context for card interactions
  - [x] Handle card collision detection (optional)

#### 1.4 Card Types Definition
- [x] Create `src/types/cardTypes.ts`
  - [x] Define `CardType` enum (MAP, MENU, ROSTER, TOOLS, FOG, LAYERS, TOKENS, etc.)
  - [x] Define `CardConfig` interface for default settings
  - [x] Define `CardPosition` and `CardSize` types

#### 1.5 Testing & Polish
- [x] Test drag functionality across different screen sizes
- [x] Test resize behavior and constraints
- [x] Ensure cards stay within viewport bounds
- [x] Test minimize/maximize animations
- [x] Verify z-index behavior when clicking cards
- [x] Test persistence (save/load layout)

---

## Phase 2: Convert Floating Elements

**Goal**: Migrate existing floating/modal UI elements to cards

### Tasks

#### 2.1 Convert Initiative Tracker to Roster Card
- [x] Create `src/components/cards/RosterCard.tsx`
  - [x] Wrap `InitiativeTracker` content in `BaseCard`
  - [x] Register card in `cardStore` with type `ROSTER`
  - [x] Set default position (right side) and size
  - [x] Update minimize behavior to use card system
  - [x] Remove old positioning logic from `InitiativeTracker.tsx`
  - [x] Update `PlayModeToolbar` to toggle roster card visibility
  - [x] Test in both combat and non-combat modes

#### 2.2 Convert Fog Control Modal to Card
- [x] Create `src/components/cards/FogControlCard.tsx`
  - [x] Extract content from `FogControlModal.tsx`
  - [x] Wrap in `BaseCard`
  - [x] Register card with type `FOG`
  - [x] Set default position and size
  - [x] Update trigger button to toggle card visibility
  - [x] Remove modal dialog wrapper

#### 2.3 Convert Layer Stack Modal to Card
- [x] Create `src/components/cards/LayerStackCard.tsx`
  - [x] Extract content from `LayerStackModal.tsx`
  - [x] Wrap in `BaseCard`
  - [x] Register card with type `LAYERS`
  - [x] Set default position (left side) and size
  - [x] Update trigger to toggle card visibility
  - [x] Remove modal dialog wrapper

#### 2.4 Convert Token Panel Modal to Card
- [ ] Create `src/components/cards/TokenPanelCard.tsx`
  - [ ] Extract content from `TokenPanelModal.tsx`
  - [ ] Wrap in `BaseCard`
  - [ ] Register card with type `TOKENS`
  - [ ] Set default position and size
  - [ ] Update trigger to toggle card visibility
  - [ ] Remove modal dialog wrapper

#### 2.5 Convert Map Controls Modal to Card
- [ ] Create `src/components/cards/MapControlsCard.tsx`
  - [ ] Extract content from `MapControlsModal.tsx`
  - [ ] Wrap in `BaseCard`
  - [ ] Register card with type `MAP_CONTROLS`
  - [ ] Set default position (centered) and size
  - [ ] Update trigger to toggle card visibility
  - [ ] Remove modal dialog wrapper

#### 2.6 Convert Other Modals
- [ ] Convert `GroupManagerModal` → `GroupManagerCard`
- [ ] Convert `ProjectManagerModal` → `ProjectManagerCard`
- [ ] Convert `RegionControlPanel` → `RegionControlCard`
- [ ] Convert `WatabouImportModal` → `WatabouImportCard`
- [ ] Convert `BackgroundGridModal` → `BackgroundGridCard`

#### 2.7 Update References
- [ ] Update all components that trigger modals to use card visibility toggles
- [ ] Remove unused modal components
- [ ] Update imports across the codebase
- [ ] Test all converted cards

---

## Phase 3: Toolbar Consolidation

**Goal**: Combine toolbars into contextual cards

### Tasks

#### 3.1 Create Menu Card
- [ ] Create `src/components/cards/MenuCard.tsx`
  - [ ] Extract top-level actions from `Toolbar.tsx`
  - [ ] Include: Share, Players, Save, Load, Delete Project
  - [ ] Wrap in `BaseCard`
  - [ ] Register card with type `MENU`
  - [ ] Set default position (top-left or floating)
  - [ ] Add sections for Project, Session, Settings
  - [ ] Style as a compact menu card

#### 3.2 Create Tools Card
- [ ] Create `src/components/cards/ToolsCard.tsx`
  - [ ] Merge `EditModeToolbar` and `PlayModeToolbar`
  - [ ] Show/hide tools based on current mode
  - [ ] Wrap in `BaseCard`
  - [ ] Register card with type `TOOLS`
  - [ ] Set default position (left side or bottom)
  - [ ] Group tools by category (Draw, Select, Fog, etc.)
  - [ ] Add mode indicator (Edit vs Play)

#### 3.3 Update Mode Switching
- [ ] Move Edit/Play toggle to Menu Card
- [ ] Update mode switching logic
- [ ] Ensure Tools Card updates when mode changes
- [ ] Test all tool interactions in both modes

#### 3.4 Cleanup
- [ ] Remove `Toolbar.tsx` if fully migrated
- [ ] Remove `EditModeToolbar.tsx`
- [ ] Remove `PlayModeToolbar.tsx`
- [ ] Update `App.tsx` or main layout to remove toolbar references
- [ ] Test navigation and tool access

---

## Phase 4: Canvas Extraction (Map Card)

**Goal**: Refactor the monolithic `SimpleTabletop.tsx` into modular components

### Tasks

#### 4.1 Analyze SimpleTabletop.tsx
- [ ] Document all functionality in `SimpleTabletop.tsx`
- [ ] Identify distinct responsibilities (canvas, interaction, rendering, state)
- [ ] Map dependencies and state usage
- [ ] Identify code that can be extracted into hooks or utilities

#### 4.2 Extract Canvas Logic
- [ ] Create `src/hooks/useCanvas.ts`
  - [ ] Extract fabric canvas initialization
  - [ ] Extract canvas event handlers
  - [ ] Extract canvas state management
- [ ] Create `src/hooks/useCanvasInteraction.ts`
  - [ ] Extract mouse/touch event handlers
  - [ ] Extract pan/zoom logic
  - [ ] Extract selection logic

#### 4.3 Extract Rendering Logic
- [ ] Create `src/hooks/useMapRenderer.ts`
  - [ ] Extract grid rendering
  - [ ] Extract region rendering
  - [ ] Extract fog rendering
  - [ ] Extract token rendering
  - [ ] Extract wall rendering
- [ ] Create `src/hooks/useCanvasLayers.ts`
  - [ ] Extract layer management
  - [ ] Extract layer ordering
  - [ ] Extract layer visibility

#### 4.4 Create Focused Components
- [ ] Create `src/components/canvas/CanvasContainer.tsx`
  - [ ] Handle canvas element lifecycle
  - [ ] Manage canvas dimensions
- [ ] Create `src/components/canvas/MapCanvas.tsx`
  - [ ] Use extracted hooks
  - [ ] Focus on rendering the map
  - [ ] Handle canvas updates
- [ ] Create `src/components/canvas/InteractionLayer.tsx`
  - [ ] Handle user interactions
  - [ ] Manage tool states
  - [ ] Handle context menus

#### 4.5 Create Map Card
- [ ] Create `src/components/cards/MapCard.tsx`
  - [ ] Wrap `MapCanvas` in `BaseCard`
  - [ ] Register card with type `MAP`
  - [ ] Set default position (centered, full-size)
  - [ ] Allow maximize to fill viewport
  - [ ] Ensure card can be minimized but defaults to maximized

#### 4.6 Integration & Testing
- [ ] Replace `SimpleTabletop` usage with `MapCard`
- [ ] Test all canvas interactions
- [ ] Test all rendering (grids, tokens, fog, regions, walls)
- [ ] Test pan, zoom, select, draw tools
- [ ] Test performance with large maps
- [ ] Verify no regressions in functionality

#### 4.7 Cleanup
- [ ] Archive or remove `SimpleTabletop.tsx` if fully replaced
- [ ] Remove unused imports and dead code
- [ ] Update documentation
- [ ] Refactor remaining complex components if needed

---

## Technical Considerations

### Drag & Drop
- Consider using `react-dnd` or `@dnd-kit/core` for robust drag-and-drop
- Alternative: Use native HTML5 drag API with custom state management
- Ensure cards snap to grid or edges for cleaner layout (optional)

### Resize Handling
- Use `react-resizable-panels` for advanced resize behavior
- Alternative: Custom resize handles with mouse events
- Set minimum/maximum dimensions per card type
- Handle resize constraints based on content

### Mobile Responsiveness
- Cards should stack vertically on small screens
- Consider a "tab" mode for mobile where cards become tabs
- Minimize cards by default on mobile
- Ensure touch gestures work for drag/resize

### Performance
- Use `React.memo` for card components to prevent unnecessary re-renders
- Debounce position/size updates during drag/resize
- Lazy load card content when first opened
- Optimize z-index calculations

### State Management
- Keep card state separate from feature state
- Use Zustand stores for card management (already using Zustand elsewhere)
- Persist card layout preferences per user/session
- Provide "reset layout" functionality

### Accessibility
- Ensure cards are keyboard navigable
- Add ARIA labels for card controls
- Support keyboard shortcuts for common card actions
- Ensure focus management when opening/closing cards

---

## Testing Strategy

### Unit Tests
- [ ] Test card state management (store actions)
- [ ] Test card position/size calculations
- [ ] Test card visibility toggles
- [ ] Test z-index management

### Integration Tests
- [ ] Test card interactions with other cards
- [ ] Test card + feature integration (e.g., Roster Card + Initiative)
- [ ] Test layout persistence and restoration
- [ ] Test mode switching with cards

### E2E Tests
- [ ] Test full user workflows with card-based UI
- [ ] Test drag & resize across different screen sizes
- [ ] Test card behavior during combat
- [ ] Test card behavior in edit mode

### Manual Testing Checklist
- [ ] All cards can be opened/closed
- [ ] All cards can be minimized/maximized
- [ ] All cards can be dragged to new positions
- [ ] All cards can be resized (where applicable)
- [ ] Card layout persists across page reloads
- [ ] Cards work on mobile devices
- [ ] Cards work on tablets
- [ ] No performance regressions
- [ ] All original functionality preserved

---

## Migration Path

### Step-by-step rollout:

1. **Week 1-2**: Complete Phase 1 (Infrastructure)
   - Build and test card foundation
   - Set up state management
   - Create demo cards for testing

2. **Week 3-4**: Complete Phase 2 (Convert Floating Elements)
   - Migrate one card at a time
   - Test each conversion thoroughly
   - Gather user feedback on each card

3. **Week 5-6**: Complete Phase 3 (Toolbar Consolidation)
   - Combine toolbars into cards
   - Update navigation patterns
   - Refine card interactions

4. **Week 7-10**: Complete Phase 4 (Canvas Extraction)
   - Most complex phase
   - Requires careful refactoring
   - Extensive testing needed

5. **Week 11-12**: Polish & Optimization
   - Performance tuning
   - Bug fixes
   - Documentation
   - User guide for new UI

---

## Success Metrics

- [ ] All existing functionality preserved
- [ ] No performance degradation (measure FPS, interaction latency)
- [ ] Reduced component file sizes (better modularity)
- [ ] Improved user satisfaction (gather feedback)
- [ ] Easier to add new features (measure development time for new cards)
- [ ] Better mobile experience (usability testing)

---

## Future Enhancements (Post-Refactor)

- [ ] Card templates/presets (save custom layouts)
- [ ] Card docking system (snap cards together)
- [ ] Card transparency/opacity controls
- [ ] Card themes (different visual styles per card)
- [ ] Collaborative card sharing (multiplayer)
- [ ] Card workspace presets (DM view, Player view, etc.)
- [ ] Floating action buttons for quick card access
- [ ] Card search/command palette

---

## Notes

- **Backward Compatibility**: Consider providing a migration for users' existing layouts
- **Feature Flags**: Consider using feature flags to roll out phases gradually
- **User Communication**: Update users about UI changes and provide tutorials
- **Documentation**: Update all documentation to reflect new card-based UI

---

## Questions & Decisions

- **Q**: Should cards have a unified design or varied styles per card type?
  - **A**: TBD - Start unified, allow customization later

- **Q**: Should there be a maximum number of open cards?
  - **A**: TBD - Monitor performance, set soft limits if needed

- **Q**: How to handle card overflow on small screens?
  - **A**: TBD - Test tab mode vs stacking vs carousel

- **Q**: Should card positions be saved per project or globally?
  - **A**: TBD - Likely per project for better flexibility

---

## Progress Tracking

### Phase 1: Card Infrastructure
**Status**: ✅ Complete  
**Progress**: 5/5 sections complete

- ✅ Created BaseCard component with drag, resize, minimize functionality
- ✅ Created cardStore with Zustand for state management and localStorage persistence
- ✅ Created CardManager component to render all registered cards
- ✅ Defined CardType enum and interfaces in cardTypes.ts
- ✅ Successfully tested with RosterCard proof-of-concept

### Phase 2: Convert Floating Elements
**Status**: 🚧 In Progress  
**Progress**: 3/7 sections complete

- ✅ Converted InitiativeTracker to RosterCard
- ✅ Converted FogControlModal to FogControlCard
- ✅ Converted LayerStackModal to LayerStackCard
- ⏳ Convert Token Panel Modal to Card
- ⏳ Convert Map Controls Modal to Card
- ⏳ Convert other modals
- ⏳ Update all references and test

### Phase 3: Toolbar Consolidation
**Status**: Not Started  
**Progress**: 0/4 sections complete

### Phase 4: Canvas Extraction
**Status**: Not Started  
**Progress**: 0/7 sections complete

---

**Last Updated**: 2025-11-09  
**Document Version**: 1.1
