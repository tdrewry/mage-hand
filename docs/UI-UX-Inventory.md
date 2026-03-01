# UI/UX Component Inventory

> **Purpose:** Catalogue every card, modal, menu, toolbar, and button in the application, organized by user-experience category. Each item notes whether it currently has role-based permission gating.
>
> **Last updated:** 2026-03-01 · App version 0.5.8

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Has role permission gating |
| ❌ | No role permission gating yet |
| 🔶 | Partially gated (some actions inside are gated, container is not) |

---

## 1. Entry & Session Setup

These components appear before or at the start of a session.

### 1.1 Landing Screen (`LandingScreen.tsx`) ❌

The first screen the user sees. Provides options to:

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **New Session** | Creates a blank session and enters the tabletop | ❌ |
| **Load Project** | Opens a file picker to load a saved `.json` project | ❌ |
| **Quick Start** | Jumps straight into a session with defaults | ❌ |
| **About / Info** | Shows version and project info dialog | ❌ |

### 1.2 Role Selection Modal (`modals/RoleSelectionModal.tsx`) ✅

Appears on first entry. Asks the user to choose a username and select one or more roles. First user is auto-assigned **DM**; subsequent users default to **Player**.

- Auto-assigns based on player count
- Uses `roleStore` and `sessionStore`

---

## 2. Top-Level Navigation & Mode Switching

### 2.1 Circular Button Bar (`CircularButtonBar.tsx`) 🔶

Fixed horizontal toolbar at the top of the canvas. Primary navigation hub.

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Menu** | Toggles the Menu Card visibility | ❌ |
| **Play Mode** | Switches canvas to Play rendering mode | ❌ |
| **Edit Mode** | Switches canvas to Edit rendering mode | ❌ |
| **Roster** | Toggles the Roster Card | ❌ |
| **Lock Token Movement** | Globally locks/unlocks all token movement (initiative-based) | ❌ |
| **Follow DM** *(player only)* | Camera follows DM's viewport pan | ❌ (shown only for non-DM) |
| **Raise Hand** *(player only)* | Sends ephemeral hand-raise event | ❌ (shown only for non-DM) |

### 2.2 Menu Card (`cards/MenuCard.tsx`) 🔶

The primary settings/navigation card. Contains grouped sections:

#### Session Info Section ❌
- Displays session ID, token count, region count as badges

#### UI Mode Section ✅
- **DM / Play toggle** — Switches between DM and Play UI modes
- Gated: uses `canManageFog` permission to determine if user can broadcast mode changes
- Locked badge shown when DM has locked the mode

#### Rendering Mode Section ❌
- **Edit/Play Mode toggle** — Switches the rendering pipeline between edit and play

#### Multiplayer Section ❌
| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Connect to Session** | Opens Session Manager modal | ❌ |
| **Sync to Players / Request Sync** | DM broadcasts state; players request it | 🔶 (label changes by role, action not gated) |
| **Network Demo** | Opens Network Demo Card | ❌ |

#### Session Section ❌
| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Share** | Copies session URL to clipboard | ❌ |
| **Players** | Opens Connected Users Panel | ❌ |

#### Project Section ❌
| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Save** | Opens Project Manager Card | ❌ |
| **Load** | Opens Project Manager Card | ❌ |
| **Map Controls** | Toggles Map Controls Card | ❌ |
| **Map Manager** | Toggles Map Manager Card | ❌ |
| **Background & Grid** | Toggles Background Grid Card | ❌ |
| **Vision Profiles** | Toggles Vision Profile Manager Card | ❌ |
| **Role Manager** | Toggles Role Manager Card | ❌ |
| **Map Objects** | Toggles Map Objects Card | ❌ |
| **Storage Manager** | Opens Storage Manager Modal | ❌ |
| **Creature Library** | Toggles Creature Library Card | ❌ |
| **Map Tree** | Toggles Map Tree Card | ❌ |
| **Dice Box** | Toggles Dice Box Card | ❌ |

#### Danger Zone ❌
| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Delete All Data** | Clears localStorage and all session data (with confirmation dialog) | ❌ |

---

## 3. Vertical Toolbar (Left Side) (`VerticalToolbar.tsx`) 🔶

Context-sensitive toolbar that changes based on Edit vs Play mode.

### 3.1 Edit Mode Buttons

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Map Manager** | Opens Map Manager | ❌ |
| **Tokens** | Toggles Token Panel Card | ❌ |
| **Add Region** | Adds a rectangular region to the map | ❌ |
| **Draw Polygon** | Starts polygon region drawing mode | ❌ |
| **Draw Freehand** | Starts freehand region drawing mode | ❌ |
| **World Snap** | Toggles grid snapping for placement | ❌ |
| **Map (Styles)** | Toggles Styles Card | ❌ |
| **Pause/Resume Animations** | Pauses illumination animations | ❌ |
| **Regions On/Off** | Toggles region visibility overlay | ❌ |
| **Clear Data** | Opens Clear Data Dialog | ❌ |
| **Import Dungeon** | Toggles Watabou Import Card | ❌ |
| **Manage Layers** | Toggles Layer Stack Card | ❌ |
| **Undo** | Undo last action | ❌ |
| **Redo** | Redo last undone action | ❌ |
| **History** | Toggles History Card | ❌ |
| **Fit to View** | Auto-zooms to fit all content | ❌ |

### 3.2 Play Mode Buttons

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Map (Styles)** | Toggles Styles Card | ❌ |
| **Pause/Resume Animations** | Pauses illumination animations | ❌ |
| **Fog of War** | Toggles Fog Control Card | ❌ |
| **Fog Reveal Brush** | Activates paint-to-reveal brush | ✅ (shown only for DM when fog enabled) |
| **Regions On/Off** | Toggles region visibility | ❌ |
| **Obstacle Collision** | Toggles movement blocking enforcement | ❌ |
| **Region Bounds** | Toggles region boundary enforcement | ❌ |
| **Start/End Combat** | Toggles initiative combat mode | ❌ |
| **Background & Grid** | Shows Background Grid Card | ❌ |
| **Manage Layers** | Toggles Layer Stack Card | ❌ |
| **Undo / Redo / History** | Same as edit mode | ❌ |
| **Fit to View** | Auto-zoom | ❌ |

---

## 4. Cards (Floating Panels)

All cards use the `BaseCard` wrapper and are managed by `cardStore`. Cards can be dragged, resized, minimized, and closed.

### 4.1 Map & Environment (DM-focused)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Map Controls** | `MAP_CONTROLS` | Wall/door/light editing, map object placement | ❌ |
| **Map Manager** | `MAP_MANAGER` | Multi-map management (create, switch, delete maps) | ❌ |
| **Map Tree** | `MAP_TREE` | Hierarchical tree view of map structure | ❌ |
| **Styles Card** | `STYLES` | Visual styling: wall textures, hatching, lighting direction, watabou style presets | ❌ |
| **Background & Grid** | `BACKGROUND_GRID` | Background color, grid type/size/color/opacity settings | ❌ |
| **Layer Stack** | `LAYERS` | Z-order layer management for rendering | ❌ |
| **Region Controls** | `REGION_CONTROL` | Region properties (color, texture, grid, fog marking) | ❌ |
| **Map Objects** | `MAP_OBJECTS` | List and manage placed map objects (walls, doors, lights, furniture) | ❌ |
| **Watabou Import** | `WATABOU_IMPORT` | Import dungeon maps from Watabou JSON or dd2vtt format | ❌ |

### 4.2 Fog of War (DM-focused)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Fog Control** | `FOG` | Enable/disable fog, set fog color/opacity, configure fog effects, exploration tracking | ❌ (should be `canManageFog`) |

### 4.3 Vision & Illumination (DM-focused)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Vision Profile Manager** | `VISION_PROFILE_MANAGER` | Create/edit vision profiles (darkvision ranges, light sensitivity) | ❌ |

### 4.4 Tokens & Creatures (Shared)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Token Panel** | `TOKENS` | Add tokens via image upload, set grid size, place on map | 🔶 (token creation uses `canCreateTokens` internally) |
| **Roster** | `ROSTER` | List of all tokens in session with quick actions | ❌ |
| **Creature Library** | `CREATURE_LIBRARY` | Browse and search SRD monster database, spawn tokens from entries | ❌ |
| **Monster Stat Block** | `MONSTER_STAT_BLOCK` | Display full stat block for a selected creature | ❌ |
| **Character Sheet** | `CHARACTER_SHEET` | Editable character sheet for a token | ❌ |
| **Action Card** | `ACTION_CARD` | Quick action panel for token abilities and attacks | ❌ |

### 4.5 Combat & Initiative (Shared)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Initiative Tracker** | `INITIATIVE_TRACKER` | Turn order display, advance/previous turn, combat management | ❌ (should be `canManageInitiative` for controls) |

### 4.6 Dice (Shared)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Dice Box** | `DICE_BOX` | 3D dice roller with notation input (e.g. 2d6+3) | ❌ |

### 4.7 Administration (DM-focused)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Role Manager** | `ROLE_MANAGER` | Create/edit/delete roles, set permissions, manage hostility relationships | ✅ (uses `canManageRoles`) |
| **Project Manager** | `PROJECT_MANAGER` | Save/load entire project state as JSON files | ❌ |
| **History** | `HISTORY` | Undo/redo history log with action descriptions | ❌ |

### 4.8 Multiplayer & Networking (Shared)

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Network Demo** | `NETWORK_DEMO` | Debug panel for testing WebSocket networking events | ❌ |

### 4.9 Groups

| Card | CardType | Purpose | Role Gated? |
|------|----------|---------|-------------|
| **Group Manager** | `GROUP_MANAGER` | Create/edit/delete entity groups, lock groups | ❌ |

---

## 5. Context Menus (Right-Click)

### 5.1 Token Context Menu (`TokenContextMenu.tsx`) ✅

Appears on right-click of a token. Extensively role-gated.

| Action | Purpose | Role Gated? |
|--------|---------|-------------|
| **Edit Token** | Opens inline token property editor (name, size, color, label) | ✅ `canControlToken` |
| **Appearance** | Change token visual variant | ✅ `canControlToken` |
| **Assign Role** | Assign a role to the token | ✅ `canAssignTokenRoles` |
| **Set Vision Profile** | Assign a vision profile to the token | ✅ `canControlToken` |
| **Illumination** | Open illumination modal for light source config | ✅ `canControlToken` |
| **Toggle Hidden** | Hide/show token from other players | ✅ `canControlToken` |
| **Initiative** | Add to initiative with roll | ✅ `canControlToken` |
| **Path/Footprints** | Configure movement trail style | ✅ `canControlToken` |
| **Link Creature** | Link to a creature from the library | ✅ `canControlToken` |
| **Save as Template** | Save token configuration as reusable template | ✅ `canControlToken` |
| **Delete** | Remove token from session | ✅ `canDeleteToken` |

### 5.2 Map Object Context Menu (`MapObjectContextMenu.tsx`) ❌

Appears on right-click of a map object (wall, door, light, furniture).

| Action | Purpose | Role Gated? |
|--------|---------|-------------|
| **Edit Properties** | Modify name, category, visual properties | ❌ |
| **Toggle Door Open/Closed** | Flip door state | ❌ |
| **Toggle Lock** | Lock/unlock object from editing | ❌ |
| **Delete** | Remove map object | ❌ |

---

## 6. Contextual Toolbars (Appear on Selection)

### 6.1 Bulk Operations Toolbar (`BulkOperationsToolbar.tsx`) 🔶

Appears when multiple tokens are selected.

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Assign Role** | Bulk assign role to selected tokens | ✅ `canAssignTokenRoles` |
| **Set Color** | Change color of all selected tokens | ❌ |
| **Toggle Visibility** | Hide/show selected tokens | ❌ |
| **Add to Initiative** | Batch add to initiative tracker | ❌ |
| **Set Illumination** | Bulk assign light source preset | ❌ |
| **Delete Selected** | Remove all selected tokens | ❌ |

### 6.2 Region Control Bar (`RegionControlBar.tsx`) ❌

Appears when one or more regions are selected.

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Toggle Region Visibility** | Show/hide region fill | ❌ |
| **Set Color** | Change region color | ❌ |
| **Set Texture** | Apply texture to region (bulk modal) | ❌ |
| **Toggle Grid** | Enable/disable per-region grid | ❌ |
| **Lock/Unlock** | Prevent region from being edited | ❌ |
| **Mark Explored** | Mark region as explored for fog of war | ❌ |
| **Unmark Explored** | Remove explored status | ❌ |
| **Select All** | Select all regions | ❌ |
| **Delete** | Delete selected regions (with confirmation) | ❌ |

### 6.3 Map Object Control Bar (`MapObjectControlBar.tsx`) ❌

Appears when map objects (walls, doors, lights) are selected.

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Drag Tool** | Set active tool to drag/move | ❌ |
| **Rotate Tool** | Set active tool to rotation | ❌ |
| **Point Edit Tool** | Edit individual points of wall segments | ❌ |
| **Toggle Lock** | Lock/unlock selected objects | ❌ |
| **Toggle Door** | Open/close door | ❌ |
| **Toggle Light** | Enable/disable light source | ❌ |
| **Delete** | Remove selected map objects | ❌ |

### 6.4 Unified Selection Toolbar (`UnifiedSelectionToolbar.tsx`) ❌

Appears when entities of mixed types are selected (tokens + regions + map objects + lights).

| Button | Purpose | Role Gated? |
|--------|---------|-------------|
| **Create Group** | Group selected entities together | ❌ |
| **Ungroup** | Dissolve a group | ❌ |
| **Lock/Unlock Group** | Prevent group transformation | ❌ |
| **Export Prefab** | Save group as reusable prefab file | ❌ |
| **Delete** | Remove all selected entities | ❌ |
| **Clear Selection** | Deselect all | ❌ |

### 6.5 Fog Brush Toolbar (`FogBrushToolbar.tsx`) ❌

Appears at bottom of screen when fog reveal brush is active.

| Control | Purpose | Role Gated? |
|---------|---------|-------------|
| **Reveal / Hide Mode** | Toggle between removing or adding fog | ❌ (brush itself is DM-gated) |
| **Brush Size Slider** | Adjust brush radius | ❌ |
| **Close** | Deactivate fog brush | ❌ |

---

## 7. Modals (Dialogs)

| Modal | File | Purpose | Role Gated? |
|-------|------|---------|-------------|
| **Role Selection** | `RoleSelectionModal.tsx` | Initial role/username selection on session entry | ✅ (system modal) |
| **Session Manager** | `SessionManager.tsx` | Create/join multiplayer sessions via WebSocket | ❌ |
| **Storage Manager** | `StorageManagerModal.tsx` | View and manage localStorage/texture storage usage | ❌ |
| **Group Manager** | `GroupManagerModal.tsx` | Full group CRUD interface | ❌ |
| **Session History** | `SessionHistoryModal.tsx` | Browse saved session snapshots | ❌ |
| **Clear Data Dialog** | `ClearDataDialog.tsx` | Confirmation dialog for wiping all local data | ❌ |
| **Visibility Modal** | `VisibilityModal.tsx` | Configure token/fog visibility settings | ❌ |
| **Token Illumination** | `TokenIlluminationModal.tsx` | Configure light source properties for a token (radius, color, animation, intensity) | ❌ (opened from gated context menu) |
| **Image Import** | `ImageImportModal.tsx` | Upload or paste images for token/map artwork | ❌ |
| **Import Character** | `ImportCharacterModal.tsx` | Import character data from external sources (D&D Beyond, JSON) | ❌ |
| **Region Background** | `RegionBackgroundModal.tsx` | Set a background image for a region | ❌ |
| **Region Bulk Texture** | `RegionBulkTextureModal.tsx` | Apply textures to multiple regions at once | ❌ |
| **Connected Users Panel** | `ConnectedUsersPanel.tsx` | View connected players in current multiplayer session | ❌ |
| **Delete All Data Alert** | (inline in `MenuCard.tsx`) | Destructive action confirmation | ❌ |
| **Layer Stack Modal** | `LayerStackModal.tsx` | Detailed layer ordering interface | ❌ |

---

## 8. Fixed UI Elements

| Component | Purpose | Role Gated? |
|-----------|---------|-------------|
| **Negative Space Control Panel** | Wall edge styling, shadow/lighting direction, texture scale | ❌ |
| **Initiative Panel** | Fixed right-side panel showing turn order during combat | ❌ |
| **Movement Lock Indicator** | Shows when token movement is globally locked | ❌ |
| **Connection Indicator** | Shows WebSocket connection status | ❌ |
| **Cursor Overlay** | Renders other players' cursor positions in multiplayer | ❌ |
| **Texture Download Progress** | Progress bar for texture asset downloads | ❌ |

---

## 9. Role Permission Summary

### Currently Defined Permissions (`roleStore.ts`)

| Permission Key | DM Default | Player Default | Where Enforced |
|---------------|-----------|----------------|----------------|
| `canControlOwnTokens` | ✅ | ✅ | Token drag, context menu |
| `canControlOtherTokens` | ✅ | ❌ | Token drag, context menu |
| `canSeeAllFog` | ✅ | ❌ | Fog renderer |
| `canSeeFriendlyVision` | ✅ | ✅ | Vision engine |
| `canSeeHostileVision` | ✅ | ❌ | Vision engine (LoS) |
| `canSeeOwnTokens` | ✅ | ✅ | Token renderer |
| `canSeeOtherTokens` | ✅ | ✅ | Token renderer |
| `canSeeHiddenTokens` | ✅ | ❌ | Token renderer |
| `canCreateTokens` | ✅ | ❌ | Token panel |
| `canDeleteOwnTokens` | ✅ | ✅ | Token context menu |
| `canDeleteOtherTokens` | ✅ | ❌ | Token context menu |
| `canManageRoles` | ✅ | ❌ | Role Manager Card |
| `canAssignRoles` | ✅ | ❌ | Player management |
| `canAssignTokenRoles` | ✅ | ❌ | Token context menu, bulk ops |
| `canManageHostility` | ✅ | ❌ | Role Manager Card |
| `canEditMap` | ✅ | ❌ | *Not enforced in UI yet* |
| `canManageFog` | ✅ | ❌ | Menu card UI mode, fog brush |
| `canManageInitiative` | ✅ | ❌ | *Not enforced in UI yet* |

---

## 10. Gap Analysis — Features Needing Role Gating

### High Priority (DM-only features currently ungated)

1. **Fog Control Card** — Should require `canManageFog`
2. **Map Controls Card** — Should require `canEditMap`
3. **Map Manager Card** — Should require `canEditMap`
4. **Region Control Bar** — Should require `canEditMap`
5. **Map Object Control Bar** — Should require `canEditMap`
6. **Map Object Context Menu** — Should require `canEditMap`
7. **Initiative Tracker controls** (advance turn, end combat) — Should require `canManageInitiative`
8. **Start/End Combat button** — Should require `canManageInitiative`
9. **Edit Mode toggle** — Should require `canEditMap`
10. **Delete All Data** — Should require DM role

### Medium Priority (Mixed-use features)

11. **Styles Card** — Map visual settings, should require `canEditMap`
12. **Background & Grid Card** — Should require `canEditMap`
13. **Layer Stack Card** — Should require `canEditMap`
14. **Vision Profile Manager** — Should require `canManageFog` or new `canManageVision`
15. **Watabou Import Card** — Should require `canEditMap`
16. **Project Manager (Save/Load)** — Should require DM role
17. **Creature Library (spawn)** — Spawn action should require `canCreateTokens`
18. **Negative Space Control Panel** — Should require `canEditMap`

### Low Priority (Shared features that may need gating)

19. **Group Manager** — Creating groups may need `canEditMap`
20. **Lock Token Movement toggle** — Should require `canManageInitiative`
21. **Obstacle Collision / Region Bounds toggles** — Should require `canEditMap`
22. **Storage Manager** — Informational, could remain ungated

### Features That Should Always Be Available to All Roles

- Dice Box
- Roster (view-only for players)
- Character Sheet (own token only)
- Action Card (own token only)
- Follow DM viewport
- Raise Hand
- Network connection status
- Token movement of own tokens (when not locked)

---

## 11. Recommended New Permissions

Based on the gap analysis, consider adding:

| Permission | Purpose |
|-----------|---------|
| `canManageVision` | Control vision profiles and illumination settings |
| `canManageProject` | Save/load project files |
| `canViewAllCards` | Override to see all panel types regardless of other permissions |
| `canManageGroups` | Create/edit/delete entity groups |

---

*This document should be reviewed alongside the [Roles and Permissions Plan](../CONTRIBUTING/Roles-Based-Permissions-Plan.md) for implementation priorities.*
