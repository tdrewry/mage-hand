/**
 * Z-Index Layer System for D20PRO Virtual Tabletop
 * 
 * Uses extended ranges to leverage 32-bit numbering space
 * Organized in layers from bottom (canvas) to top (critical overlays)
 * Each layer has ample room for sub-layering and future expansion
 */

export const Z_INDEX = {
  // Layer 0: Canvas base (0)
  CANVAS_BASE: 0,
  
  // Layer 1: Canvas elements (1000-29999) - 29,000 slots for game elements
  CANVAS_ELEMENTS: {
    BASE: 1000,
    MAX: 29999,
    
    // Sub-layers within canvas (1000 unit increments for flexibility)
    BACKGROUND_EFFECTS: 1000,      // Auras, area effects below tokens
    REGIONS: 5000,                 // Regions and zones
    TERRAIN: 10000,                // Terrain features
    WALLS: 15000,                  // Wall segments
    TOKENS_BASE: 20000,            // Token base layer
    TOKENS_MAX: 25000,             // Token max (5000 tokens possible)
    FOG_POST_PROCESSING: 25500,    // PixiJS fog blur/effects layer
    SELECTION_HIGHLIGHT: 26000,    // Selection visuals
    DRAG_GHOST: 27000,             // Dragging preview
    MEASUREMENT_TOOLS: 28000,      // Rulers, templates
    COMBAT_INDICATORS: 29000,      // Turn indicators, status markers
    CANVAS_UI_OVERLAY: 29500,      // Canvas-based UI (off-screen indicators)
  },
  
  // Layer 2: Fixed UI elements (30000-30999) - 1000 slots
  FIXED_UI: {
    BASE: 30000,
    MAX: 30999,
    
    BACKGROUND_PANELS: 30100,      // Side panels, backgrounds
    CONTROL_PANELS: 30300,         // Control panels
    SIDE_PANELS: 30500,            // Side panels
    TOOLBARS: 30700,               // Top/bottom toolbars
    FLOATING_MENUS: 30900,         // Circular menus, floating controls
  },
  
  // Layer 3: Draggable cards (31000-32999) - 2000 slots
  CARDS: {
    BASE: 31000,
    MAX: 32999,
  },
  
  // Layer 4: Modals & dialogs (34000-44999) - 11,000 slots
  MODALS: {
    BASE: 34000,
    MAX: 44999,
    
    OVERLAY: 34000,                // Modal overlay/backdrop
    CONTENT: 34100,                // Modal content
    NESTED_MODAL: 34500,           // Modals opened from modals
    ALERT_DIALOG: 35000,           // Alert/confirm dialogs
    FULLSCREEN_MODAL: 40000,       // Fullscreen takeover modals
  },
  
  // Layer 5: Dropdowns & context menus (45000-45999) - Must be above modals
  DROPDOWNS: {
    BASE: 45000,
    MAX: 45999,
    
    MENU: 45100,                   // Base context/dropdown menu
    SUBMENU: 45300,                // Nested submenus
    NESTED: 45500,                 // Deep nesting if needed
    COMMAND_PALETTE: 45700,        // Command palette, search
  },
  
  // Layer 6: Popovers & tooltips (46000-49999) - 4000 slots
  POPOVERS: {
    BASE: 46000,
    MAX: 49999,
    
    POPOVER: 46100,                // Standard popovers
    TOOLTIP: 46500,                // Tooltips
    HOVER_CARD: 46700,             // Hover cards with details
    CONTEXT_TOOLTIP: 47000,        // Context-sensitive help
  },
  
  // Layer 7: Critical overlays (50000+) - Highest priority
  CRITICAL: {
    BASE: 50000,
    
    LOADING_OVERLAY: 50000,        // Loading screens
    BLOCKER_OVERLAY: 50100,        // Movement lock, state blockers
    SYSTEM_ALERT: 50300,           // System-level alerts
    ERROR_BOUNDARY: 50500,         // Error boundaries, crash screens
    DEVELOPMENT_OVERLAY: 50700,    // Dev tools, debug overlays
  },
} as const;

/**
 * Helper to get a z-index value for a token within canvas range
 * Tokens use the 20000-25000 range (5000 possible tokens)
 */
export function getTokenZIndex(offset: number = 0): number {
  const zIndex = Z_INDEX.CANVAS_ELEMENTS.TOKENS_BASE + offset;
  return Math.min(zIndex, Z_INDEX.CANVAS_ELEMENTS.TOKENS_MAX);
}

/**
 * Helper to get a z-index value within card range
 * Cards can stack between BASE and MAX (2000 possible cards)
 */
export function getCardZIndex(offset: number = 0): number {
  const zIndex = Z_INDEX.CARDS.BASE + offset;
  return Math.min(zIndex, Z_INDEX.CARDS.MAX);
}

/**
 * Helper to ensure a z-index is within valid range
 */
export function clampZIndex(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get a region z-index (within regions sub-layer)
 */
export function getRegionZIndex(offset: number = 0): number {
  const base = Z_INDEX.CANVAS_ELEMENTS.REGIONS;
  const max = Z_INDEX.CANVAS_ELEMENTS.TERRAIN - 1;
  return Math.min(base + offset, max);
}
