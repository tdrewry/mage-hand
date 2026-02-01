
# Toolbar Consolidation & Movement Lock Cleanup Plan

## Executive Summary

The audit revealed redundant buttons and two parallel movement restriction systems causing user confusion. This plan consolidates the toolbars and clarifies the movement lock behavior.

---

## Current State Analysis

### Movement Lock Systems

| System | Store | Location | Purpose |
|--------|-------|----------|---------|
| `movementLocked` | sessionStore | Top bar (persistent) | Global lock (import/export) |
| `restrictMovement` | initiativeStore | Play mode toolbar | Turn-based combat restriction |

Both use the **Footprints** icon, creating confusion.

### Redundant Buttons

| Button | Top Bar (Persistent) | Play Mode Toolbar |
|--------|---------------------|-------------------|
| Roster | Yes | Yes (duplicate) |
| Movement Lock | Yes (global) | Yes (combat-specific) |

---

## Proposed Changes

### 1. Remove Duplicate Roster Button from Play Mode

The Roster button in the top bar is already persistent across modes. Remove it from the play mode left toolbar.

**File:** `src/components/VerticalToolbar.tsx`
- Remove the Roster ToolbarButton (lines 457-464) from play mode section

### 2. Remove Redundant Combat Movement Restriction Button

The `restrictMovement` toggle in play mode is combat-specific, but it overlaps with the persistent movement lock. Since combat mode already has "turn restriction" semantics built into the combat system itself, we can simplify:

- **Keep** the top bar movement lock as the master "prevent any movement" toggle
- **Remove** the play mode `restrictMovement` button from the toolbar
- **Behavior change:** When combat is active, movement is automatically restricted to the active token (this is already the default behavior when `restrictMovement: true` in initiativeStore defaults)

**File:** `src/components/VerticalToolbar.tsx`
- Remove the Footprints (restrictMovement) button from play mode (lines 475-486)

### 3. Update Top Bar Movement Lock Tooltip

Improve clarity by updating the tooltip on the persistent movement lock.

**File:** `src/components/CircularButtonBar.tsx`
- Change label from `"Lock Movement"` / `"Unlock Movement"` to include context:
  - `"Lock All Token Movement"` / `"Unlock Token Movement"`

### 4. Keep MovementLockIndicator for Global Lock

The red badge at the top already indicates when movement is globally locked. No changes needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/VerticalToolbar.tsx` | Remove duplicate Roster button and restrictMovement button from play mode |
| `src/components/CircularButtonBar.tsx` | Update movement lock button label for clarity |

---

## Final Toolbar Layout

### Top Bar (Persistent - Both Modes)
```
[ Menu | Play | Edit | Roster | Lock Movement ]
```

### Left Toolbar - Edit Mode
```
[ Map Manager ]
[ Tokens ]
─────────────
[ Add Region ]
[ Draw Polygon ]
[ Draw Freehand ]
─────────────
[ World Snap ]
[ Styles ]
[ Pause Animations ]
[ Regions On/Off ]
─────────────
[ Clear Tokens ]
[ Clear Regions ]
[ Import Dungeon ]
[ Manage Layers ]
─────────────
[ Undo ]
[ Redo ]
[ History ]
─────────────
[ Fit to View ]
```

### Left Toolbar - Play Mode
```
[ Styles ]
[ Pause Animations ]
[ Fog of War ]
[ Regions On/Off ]
─────────────
[ Start/End Combat ]
[ Background & Grid ]
[ Manage Layers ]
─────────────
[ Undo ]
[ Redo ]
[ History ]
─────────────
[ Fit to View ]
```

---

## Behavior Summary After Changes

| Action | Result |
|--------|--------|
| Top bar Lock Movement toggled ON | No tokens can be moved (except in Edit mode) |
| Combat started | Turn-based movement automatically enforced (only active token can move) |
| Combat ended | Free movement restored (unless Lock Movement is ON) |

---

## Testing Checklist

1. Toggle Lock Movement in top bar - verify tokens cannot be dragged in Play mode
2. Switch to Edit mode while locked - verify tokens CAN still be moved (DM editing)
3. Start combat - verify only the active token can be moved
4. End combat - verify free movement is restored
5. Verify Roster button only appears once in top bar
6. Verify no duplicate movement buttons in play mode toolbar
