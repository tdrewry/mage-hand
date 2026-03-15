# Mage Hand — UI/UX Feature Catalog & Audit Reference

> **Purpose:** Enable a clean audit/redesign of the UI/UX by cataloging every button, card, toolbar, context menu, overlay, and backend feature surface.
>
> **Status Legend:**
> - ✅ **Complete** — Feature fully functional with polished UI
> - 🟡 **Partial** — Feature works but has known gaps or rough edges
> - 🔴 **Stub** — Placeholder UI or minimal implementation
> - 🚫 **No UI** — Feature exists in code but has no user-facing surface

---

## 1. Landing Screen (`LandingScreen.tsx`)

| Element | Status | Description | UI Location |
|---|---|---|---|
| Player Identity (username + role selection) | ✅ Complete | Name input + checkbox role picker (DM/Player) | Landing screen, left panel |
| Continue Session | ✅ Complete | Resume current in-memory session | Landing screen, menu list |
| New Session | ✅ Complete | Clear all stores and start fresh | Landing screen, menu list |
| Load Session (.mhsession) | ✅ Complete | Import session from file picker | Landing screen, menu list |
| Save Session | ✅ Complete | Export current session to .mhsession file | Landing screen, menu list |
| Delete All Data | ✅ Complete | Clears localStorage and all stores | Landing screen, menu list (destructive) |
| About | ✅ Complete | Shows version and app info dialog | Landing screen, menu list |
| Multiplayer Host/Join | 🟡 Partial | Opens SessionManager modal for WebSocket/Jazz connection | Landing screen, right panel |
| Sync Status Indicator | ✅ Complete | Shows sync progress when connected before launch | Landing screen, multiplayer panel |

---

## 2. Top Toolbar — CircularButtonBar (`CircularButtonBar.tsx`)

| Button | Status | Access | Description |
|---|---|---|---|
| Menu Toggle | ✅ Complete | Always visible | Show/hide the Menu card |
| Play Mode / Edit Mode Toggle | ✅ Complete | DM only (players see locked Play) | Switch rendering mode between edit and play |
| Roster | ✅ Complete | Always visible | Toggle Roster card visibility |
| Lock Token Movement | ✅ Complete | Always visible | Lock/unlock all token movement globally |
| Lock Players to DM Viewport | 🟡 Partial | DM only | Forces all players to follow DM camera; ephemeral broadcast |
| Follow DM Viewport | 🟡 Partial | Players only | Opt-in to follow DM's camera pan/zoom |
| Raise Hand | 🟡 Partial | Players only | Emits ephemeral `role.handRaise` event; no DM-side notification UI |

---

## 3. Left Vertical Toolbar — Edit Mode (`VerticalToolbar.tsx`)

| Button | Status | Access | Description |
|---|---|---|---|
| Map Manager | ✅ Complete | Edit mode | Open Map Manager card |
| Tokens | ✅ Complete | Edit mode | Open Token Panel card |
| Add Region (rectangle) | ✅ Complete | Edit mode | Create a new rectangular region on canvas |
| Draw Polygon | ✅ Complete | Edit mode | Start/finish polygon region drawing |
| Draw Freehand | ✅ Complete | Edit mode | Freehand region drawing tool |
| Draw Door | ✅ Complete | Edit mode | Place door map objects between walls |
| World Snap Toggle | ✅ Complete | Edit mode | Enable/disable grid snapping globally |
| Map (Styles) | ✅ Complete | Edit mode | Open Styles card for map visual settings |
| Pause/Resume Animations | ✅ Complete | Edit mode | Toggle animated textures |
| Regions Visibility Toggle | ✅ Complete | Edit mode | Show/hide region outlines |
| Clear Data | ✅ Complete | Edit mode | Open clear-data confirmation dialog |
| Import Dungeon | ✅ Complete | Edit mode | Open Watabou/DD2VTT import card |
| Map Tree | ✅ Complete | Edit mode | Open Map Tree hierarchy card |
| Undo | ✅ Complete | Edit mode | Undo last action (Ctrl+Z) |
| Redo | ✅ Complete | Edit mode | Redo last undone action (Ctrl+Shift+Z) |
| History | ✅ Complete | Edit mode | Open undo/redo History card |
| Fit to View | ✅ Complete | Edit mode | Zoom/pan canvas to fit all content |

---

## 4. Left Vertical Toolbar — Play Mode (`VerticalToolbar.tsx`)

| Button | Status | Access | Description |
|---|---|---|---|
| Map (Styles) | ✅ Complete | Play mode | Open Styles card |
| Pause/Resume Animations | ✅ Complete | Play mode | Toggle animated textures |
| Roster | ✅ Complete | Play mode | Toggle Roster card |
| Fog of War Toggle | ✅ Complete | Play mode, DM only | Enable/disable fog for current map |
| Fog Reveal Brush | ✅ Complete | Play mode, DM + fog enabled | Activate fog brush tool |
| Regions Visibility Toggle | ✅ Complete | Play mode | Show/hide region outlines |
| Obstacle Collision Toggle | 🟡 Partial | Play mode | Enable/disable movement blocking by walls |
| Region Bounds Toggle | 🟡 Partial | Play mode | Enforce token containment within region bounds |
| Start/End Combat | ✅ Complete | Play mode | Toggle initiative combat mode |
| Effects | ✅ Complete | Play mode | Open Effects card |
| Actions | ✅ Complete | Play mode | Open Action card |
| Map Tree | ✅ Complete | Play mode | Open Map Tree card |
| Undo/Redo/History | ✅ Complete | Play mode | Same as edit mode |
| Fit to View | ✅ Complete | Play mode | Zoom/pan canvas to fit all content |

---

## 5. Menu Card (`MenuCard.tsx`)

### Quick Access
| Button | Status | Access | Description |
|---|---|---|---|
| Chat | ✅ Complete | All players | Open Chat card |
| Actions | ✅ Complete | DM only | Open Action card |

### UI Mode
| Control | Status | Access | Description |
|---|---|---|---|
| DM / Play Mode Toggle | 🟡 Partial | All (DM can broadcast) | Switch between DM and Play UI modes |

### Rendering Mode
| Control | Status | Access | Description |
|---|---|---|---|
| Edit / Play Mode Toggle | ✅ Complete | All | Switch canvas rendering mode |

### Multiplayer Section
| Button | Status | Access | Description |
|---|---|---|---|
| Connect to Session | ✅ Complete | All | Open SessionManager modal |
| Players Online Badge | ✅ Complete | Connected only | Show count of connected players |
| Sync to Players / Request Sync | 🟡 Partial | Connected only | DM pushes state via Jazz bridge; Player pulls |
| Network Demo | 🔴 Stub | All | Open Network Demo card (dev/test tool) |
| Art Approval | 🟡 Partial | DM only | Open Art Approval card |

### Session Section
| Button | Status | Access | Description |
|---|---|---|---|
| Share (copy URL) | ✅ Complete | All | Copy session URL to clipboard |
| Players (Connected Users) | ✅ Complete | Connected only | Open Connected Users panel |

### Project Section
| Button | Status | Access | Description |
|---|---|---|---|
| Project Manager | ✅ Complete | All | Open save/load/export card |
| Map Controls | 🟡 Partial | DM only | Open Map Controls card (fabricCanvas not wired) |
| Map Manager | ✅ Complete | All | Open Map Manager card |
| Vision Profiles | ✅ Complete | All | Open Vision Profile Manager card |
| Role Manager | ✅ Complete | All | Open Role Manager card |
| Map Objects | ✅ Complete | All | Open Map Objects panel card |
| Storage Manager | ✅ Complete | All | Open Storage Manager modal |
| Library | ✅ Complete | All | Open Creature/Monster Library card |
| Map Tree | ✅ Complete | All | Open Map Tree card |
| Dice Box | ✅ Complete | All | Open 3D dice roller card |
| Sound Settings | 🟡 Partial | All | Open Sound Settings card |
| Handouts | ✅ Complete | All | Open Handout Catalog card |
| Campaign (Scenario Editor) | 🟡 Partial | DM only | Open Campaign/Scenario Editor card |
| Token Groups | 🟡 Partial | All | Open Token Group Manager card |

### Utility
| Button | Status | Access | Description |
|---|---|---|---|
| Return to Menu | ✅ Complete | All | Return to Landing Screen |
| Delete All Data | ✅ Complete | All | Destructive clear of all data |

---

## 6. Cards (Floating Panels)

| Card | CardType Enum | Status | Access Method | Description |
|---|---|---|---|---|
| Menu | `MENU` | ✅ Complete | Top toolbar (always open) | Main navigation hub |
| Roster | `ROSTER` | ✅ Complete | Top toolbar / Menu | List of tokens with quick controls |
| Token Panel | `TOKENS` | ✅ Complete | Left toolbar / Menu | Add tokens, configure token properties |
| Fog Control | `FOG` | ✅ Complete | Left toolbar (play, DM) | Fog of war settings per map |
| Map Controls | `MAP_CONTROLS` | 🟡 Partial | Menu (DM only) | Canvas manipulation (fabricCanvas ref not connected) |
| Map Manager | `MAP_MANAGER` | ✅ Complete | Left toolbar / Menu | Create, delete, rename, reorder maps |
| Styles (Map) | `STYLES` | ✅ Complete | Left toolbar | Map-level visual settings (grid, background, rendering) |
| Region Control | `REGION_CONTROL` | ✅ Complete | Auto-opens on region selection | Region properties and settings |
| Import (Watabou) | `WATABOU_IMPORT` | ✅ Complete | Left toolbar / Menu | Import Watabou JSON or DD2VTT files |
| Project Manager | `PROJECT_MANAGER` | ✅ Complete | Menu | Save/Load/Export sessions |
| Initiative Tracker | `INITIATIVE_TRACKER` | ✅ Complete | Auto-shows on combat start | Horizontal initiative bar with turn cards |
| Vision Profile Manager | `VISION_PROFILE_MANAGER` | ✅ Complete | Menu | Create/edit vision profiles for token sight |
| Role Manager | `ROLE_MANAGER` | ✅ Complete | Menu | Define roles and permissions |
| History | `HISTORY` | ✅ Complete | Left toolbar | Undo/redo history log |
| Map Objects | `MAP_OBJECTS` | ✅ Complete | Menu | List and manage placed map objects |
| Character Sheet | `CHARACTER_SHEET` | ✅ Complete | Token context menu | View/edit linked character sheet |
| Monster Stat Block | `MONSTER_STAT_BLOCK` | ✅ Complete | Token context menu / Library | View monster stat block |
| Creature Library | `CREATURE_LIBRARY` | ✅ Complete | Menu | Browse/import characters and monsters |
| Library Editor | `LIBRARY_EDITOR` | ✅ Complete | Library card | Monaco JSON editor + form for entity editing |
| Map Tree | `MAP_TREE` | ✅ Complete | Left toolbar / Menu | Hierarchical map/entity browser with drag-drop |
| Dice Box | `DICE_BOX` | ✅ Complete | Menu | 3D dice roller with formula presets |
| Action Card | `ACTION_CARD` | ✅ Complete | Left toolbar / Menu (DM) | DM combat action resolution UI |
| Network Demo | `NETWORK_DEMO` | 🔴 Stub | Menu (Multiplayer) | Dev/test tool for network ops |
| Effects | `EFFECTS` | ✅ Complete | Left toolbar (play) | Place and manage spell/AoE effects |
| Chat | `CHAT` | ✅ Complete | Menu (Quick Access) | Chat messages + action history feed |
| Art Approval | `ART_APPROVAL` | 🟡 Partial | Menu (DM only) | Review player-submitted artwork |
| Sound Settings | `SOUND_SETTINGS` | 🟡 Partial | Menu | Ambient sound engine, event sounds |
| Handout Catalog | `HANDOUT_CATALOG` | ✅ Complete | Menu | Browse/create/edit markdown handouts |
| Handout Viewer | `HANDOUT_VIEWER` | ✅ Complete | Handout Catalog (click entry) | Read-only markdown viewer |
| Campaign Editor | `CAMPAIGN_EDITOR` | 🟡 Partial | Menu (DM only) | Visual scenario/story flow editor |
| Token Group Manager | `TOKEN_GROUP_MANAGER` | 🟡 Partial | Menu | Manage token groups and formations |
| Group Manager | `GROUP_MANAGER` | 🔴 Stub | CardType exists, no button | "Coming soon" placeholder |
| Tools | `TOOLS` | 🔴 Stub | Default visible, deprecated | Legacy tools card, replaced by VerticalToolbar |
| Layers | `LAYERS` | 🔴 Stub | Deprecated | Replaced by Map Tree |
| Background Grid | `BACKGROUND_GRID` | 🔴 Stub | Deprecated | Replaced by Styles card |

---

## 7. Context Menus (Right-Click)

| Context Menu | Status | Trigger | Description |
|---|---|---|---|
| Token Context Menu | ✅ Complete | Right-click token on canvas | Rename, recolor, resize, delete, set role, illumination, vision, footprint/path style, appearance variants, link creature, move to map, add to initiative, view character sheet, open stat block, copy, actions submenu |
| Map Object Context Menu | ✅ Complete | Right-click map object on canvas | Edit properties, toggle door, lock/unlock, delete, duplicate, set category, toggle visibility, texture/image |
| Effect Context Menu | ✅ Complete | Right-click placed effect on canvas | Dismiss effect, pause/resume animation |

---

## 8. Contextual Toolbars (Auto-Appear on Selection)

| Toolbar | Status | Trigger | Description |
|---|---|---|---|
| RegionControlBar | ✅ Complete | Select region(s) on canvas | Grid size, color, texture, lock, delete, fog mark, convert to map object, visibility, select all |
| MapObjectControlBar | ✅ Complete | Select map object(s) on canvas | Lock, delete, drag/rotate/point-edit mode, door toggle, light toggle, rename |
| BulkOperationsToolbar | ✅ Complete | Multi-select tokens | Bulk role assign, visibility toggle, delete, add to initiative, color, illumination |
| UnifiedSelectionToolbar | ✅ Complete | Mixed multi-select (tokens + regions + objects + lights) | Group/ungroup, lock, delete, export prefab |
| FogBrushToolbar | ✅ Complete | Activate fog reveal brush | Brush size slider, reveal/hide mode toggle |

---

## 9. Overlays & Indicators (Always-On / Conditional)

| Component | Status | Trigger | Description |
|---|---|---|---|
| ConnectionIndicator | ✅ Complete | Always visible (bottom-right) | Shows WebSocket + Jazz layer status dots |
| FloorNavigationWidget | ✅ Complete | Map belongs to multi-floor structure | Up/down floor navigation arrows |
| InitiativePanel | ✅ Complete | Combat active | Horizontal turn-order bar at top |
| CursorOverlay | 🟡 Partial | Multiplayer connected | Shows remote player cursors |
| ActionPendingOverlay | ✅ Complete | Player in combat | Shows pending/resolved action notifications |
| MovementLockIndicator | ✅ Complete | Token movement locked | Visual lock indicator on canvas |
| TextureDownloadProgress | ✅ Complete | Textures loading | Progress bar during texture downloads |
| CampaignSceneRunner | 🟡 Partial | Campaign scene active | Executes campaign graph transitions |

---

## 10. Modals & Dialogs

| Modal | Status | Trigger | Description |
|---|---|---|---|
| SessionManager | ✅ Complete | Menu / Landing Screen multiplayer button | Host/join multiplayer sessions |
| StorageManagerModal | ✅ Complete | Menu → Storage Manager | View/manage IndexedDB texture storage |
| ImageImportModal | ✅ Complete | Various (token, region, map object) | Import images from URL, file, or paste |
| MapImageImportModal | ✅ Complete | Map Manager | Import map background images |
| ImportCharacterModal | ✅ Complete | Library | Import character JSON |
| TokenIlluminationModal | ✅ Complete | Token context menu / Bulk toolbar | Configure token light sources |
| VisibilityModal | ✅ Complete | Token context menu | Set token visibility per-role |
| RegionBackgroundModal | ✅ Complete | Region control | Set region background image/texture |
| RegionBulkTextureModal | ✅ Complete | Region control bar | Bulk-apply textures to multiple regions |
| RoleSelectionModal | ✅ Complete | Landing screen | Select player role |
| GroupManagerModal | 🟡 Partial | UnifiedSelectionToolbar | Manage entity groups |
| SessionHistoryModal | 🟡 Partial | Project Manager | Browse saved session history |
| DurableObjectImportModal | 🟡 Partial | Project Manager | Import durable object data |
| ClearDataDialog | ✅ Complete | Left toolbar / Menu | Confirm destructive data clear |
| InitiativeEntryModal | ✅ Complete | Initiative panel | Add/edit initiative entry |

---

## 11. Features With No UI Exposure (Code-Only)

These features exist in the codebase with functional stores/engines but lack buttons or UI surfaces for users to access:

| Feature | Store/Module | Status | Description |
|---|---|---|---|
| Cursor Sharing | `cursorStore.ts`, `CursorOverlay.tsx` | 🟡 Partial | Broadcasts cursor positions but no toggle/settings UI |
| Ambient Sound Engine | `ambientEngine.ts`, `soundStore.ts` | 🟡 Partial | Full sound system exists but Sound Settings card has limited controls |
| Event Sound System | `soundEngine.ts`, `eventSystem.ts` | 🟡 Partial | Sound triggers for game events; no event-to-sound mapping UI |
| Hatching Patterns | `hatchingStore.ts`, `dysonHatchingFilter.ts` | 🟡 Partial | Dyson-style hatching shader; accessible only via Styles card presets |
| Post-Processing Layer | `postProcessingLayer.ts`, `usePostProcessing.ts` | 🟡 Partial | Visual filters (illumination, hatching); no dedicated controls |
| Grid Occupancy System | `gridOccupancy.ts` | ✅ Complete | Tracks token grid positions; no visualization UI |
| Movement Collision | `movementCollision.ts` | 🟡 Partial | Collision detection against walls; toggle exists but no config |
| Durable Object Registry | `durableObjectRegistry.ts`, `durableObjects.ts` | 🟡 Partial | Jazz-backed persistent objects; no direct management UI |
| Item Store | `itemStore.ts` | 🔴 Stub | Item definitions exist but no inventory or item management UI |
| Texture Compression | `textureCompression.ts` | ✅ Complete | Auto-compresses textures; no user controls needed |
| Session Code Resolver | `sessionCodeResolver.ts` | ✅ Complete | Resolves short codes to session IDs; internal use |
| Animated Texture Manager | `animatedTextureManager.ts` | ✅ Complete | Manages animated textures; controlled via Pause/Resume button |
| Map Focus Store | `mapFocusStore.ts`, `MapFocusSettings.tsx` | 🟡 Partial | Per-map focus/zoom defaults; component exists but not wired to a card button |
| Token Ephemeral State | `tokenEphemeralStore.ts` | ✅ Complete | Hover, handle previews, drag ghosts; internal rendering |
| Presence Store | `presenceStore.ts` | 🟡 Partial | Tracks user presence; shown in ConnectedUsersPanel but no rich presence UI |
| Remote Drag Store | `remoteDragStore.ts` | ✅ Complete | Shows remote user drag previews; fully automatic |
| Campaign Store | `campaignStore.ts` | 🟡 Partial | Persists campaign graph data; UI in Campaign Editor card |
| Sync Core Framework | `sync-core/` | 🟡 Partial | Deduplication + middleware pipeline; internal networking |
| Effect Modifier Engine | `effectModifierEngine.ts` | 🟡 Partial | Stat modifiers from effects; no summary UI for active modifiers |
| Effect Hit Testing | `effectHitTesting.ts` | ✅ Complete | Determines token-in-effect overlaps; internal calculation |
| Aura Engine | `auraEngine.ts` | 🟡 Partial | Token aura rendering; no configuration UI (set via code/library only) |
| Character Template Generator | `characterTemplateGenerator.ts` | ✅ Complete | Generates blank character JSON; used internally by Library |
| DnD Beyond Parser | `dndBeyondParser.ts` | 🟡 Partial | Parses D&D Beyond JSON; accessible only via Library import |
| Attack Parser | `attackParser.ts` | ✅ Complete | Extracts attack data from creature JSON; used by Action Card |
| Illumination Presets | `illuminationPresets.ts` | ✅ Complete | Preset light sources (Torch, Lantern, etc.); accessed via Token Illumination modal |
| Hex Coordinate System | `hexCoordinates.ts` | ✅ Complete | Full hex grid math; used when region gridType is 'hex' |
| GPU Check | `gpuCheck.ts` | ✅ Complete | Detects GPU capabilities; internal use |
| LRU Image Cache | `LRUImageCache.ts` | ✅ Complete | In-memory image cache; internal performance |
| Jazz Bridge | `jazz/bridge.ts` | 🟡 Partial | Syncs state to/from Jazz CoValues; triggered by Menu sync buttons |
| Jazz TextureSync | `jazz/textureSync.ts` | 🟡 Partial | Syncs textures via Jazz FileStream; automatic on connect |

---

## 12. Keyboard Shortcuts

| Shortcut | Status | Description |
|---|---|---|
| Ctrl+Z | ✅ Complete | Undo |
| Ctrl+Shift+Z | ✅ Complete | Redo |
| Escape | ✅ Complete | Cancel current drawing operation / deselect |
| Delete/Backspace | 🟡 Partial | Delete selected entities (depends on focus) |

---

## 13. Deprecated / Legacy Items

| Item | Type | Notes |
|---|---|---|
| `CardType.TOOLS` | Card | Replaced by VerticalToolbar; still registered in cardStore |
| `CardType.LAYERS` | Card | Replaced by Map Tree |
| `CardType.BACKGROUND_GRID` | Card | Replaced by Styles card |
| `FloatingMenu.tsx` | Component | Legacy menu, replaced by CardManager + MenuCard |
| `EnhancedFloatingMenu.tsx` | Component | Legacy enhanced menu variant |

---

## 14. DM-Only Gated Features

The following CardTypes are blocked from non-DM players via `DM_ONLY_CARD_TYPES`:

- Fog Control (`FOG`)
- Map Controls (`MAP_CONTROLS`)
- Region Control (`REGION_CONTROL`)
- Action Card (`ACTION_CARD`)
- Art Approval (`ART_APPROVAL`)
- Campaign Editor (`CAMPAIGN_EDITOR`)

Additional DM-gated buttons in MenuCard:
- Actions (Quick Access)
- Map Controls (Project section)
- Art Approval (Multiplayer section)
- Campaign (Project section)
- Sync to Players (Multiplayer section)
- Lock Players to DM Viewport (Top toolbar)

---

*Document generated for UI/UX audit. Last updated: 2026-03-13*
