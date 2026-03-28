/**
 * Magehand Host / DM Guide — built-in documentation for game masters.
 */
export const DM_GUIDE_MARKDOWN = `# Magehand Host & DM Guide

This guide covers everything you need to run a game as a **Dungeon Master** (or Game Master) in Magehand. It walks through the interface, session setup, map importing, token management, fog of war, combat, the Rules system, and multiplayer hosting.

---

## The Interface

### Top Bar

The top bar spans the full width and is the primary navigation hub:

| Area | What it does |
|------|-------------|
| **Left chevron** | Collapse / expand the left sidebar |
| **Right chevron** | Collapse / expand the right sidebar |
| **Mode menu** (monitor icon) | Switch between DM View / Player View and Edit Mode / Play Mode |
| **Project files** (folder icon) | Save Session / Load Session (opens the Project Manager) |
| **Settings** (gear icon) | Network / Session, Storage Manager, Role Manager, Sound Settings, Sync Profiler |
| **Tabletop controls** (gamepad icon) | Lock token movement, lock players to DM viewport, pause broadcasts |
| **Focus Mode** (fullscreen icon) | Hide all UI chrome for a clean display; a restore button appears top-right |

#### Status indicators (top-bar center)
- **Movement Locked** badge — orange, pulsing; click it to unlock
- **Broadcasts Paused** badge — amber; click it to resume and push final state to clients

### Sidebars & + Dock Tool

Both the left and the right sidebar are collapsible panel areas. When a sidebar is open, a **"+ Dock Tool"** button appears in the top bar for that side. Click it to pick which tool fills that sidebar:

| Tool | Contents |
|------|----------|
| **Play** | Chat, History, Dice, Initiative tracker, and Actions (DRA workflow) |
| **Rules** | Map/spell templates, Active Effects orchestrator, Logic Pipelines, Adapters, Schema Registry, Vocabulary |
| **Campaign** | Campaign editor, scene runner |
| **Compendium** | Handout catalog and viewer |
| **Environment** | Ambient environment knobs |

You can dock different tools to each side simultaneously (e.g. Rules on the left, Play on the right).

### Canvas Toolbar (left edge of canvas)

A slim icon strip runs down the left edge of the canvas. In **Edit Mode**:

| Icon | Action |
|------|--------|
| Square | Add rectangular region |
| Pen | Draw polygon region (click to add vertices, click again to finish) |
| Freehand | Draw freehand region |
| Door | Draw a door segment |
| Magnet | Toggle world-grid snapping |
| Pause/Play | Pause or resume canvas animations |
| Eye | Toggle visibility of region overlays |
| Trash | Clear canvas data (with confirmation dialog) |
| Undo / Redo | Undo / Redo canvas actions (Ctrl+Z / Ctrl+Shift+Z) |
| Fit to View | Reset viewport to show the whole map |

In **Play Mode** the toolbar switches to:

| Icon | Action |
|------|--------|
| Pause/Play | Toggle canvas animations |
| Cloud/Fog | Toggle fog of war for the current map |
| Paintbrush | (When fog is on) Activate the fog reveal brush |
| Eye | Toggle region overlays |
| ShieldX | Toggle obstacle collision enforcement |
| Fence | Toggle region bounds enforcement |
| Swords | Start / end combat |
| Undo / Redo | Undo / Redo |
| Fit to View | Fit map to screen |

### Selection Dock (Bottom Bar)

When you select one or more canvas entities (tokens, regions, map objects, or lights), a **context toolbar** slides up from the bottom of the screen:

- **Left:** count and type summary of selected items
- **Center:** context-sensitive actions (see below)
- **Right:** × button to clear selection

Token actions:
- **Group** — when 2+ entities are selected, name and create a group; grouped items move together
- **Role** — assign tokens to a player role (respects \`canAssignTokenRoles\` permission)
- **Vis** — bulk Hide / Show tokens
- **Light** — apply illumination preset or open the Custom Settings modal
- **Orientation** — set rotation (0-360°) and toggle the facing arrow indicator
- **State** — set elevation in grid units and apply status conditions (Poisoned, Prone, etc.)
- **Color** — set the token border tint (single) or bulk edit (multi)
- **Init** — add selected tokens to initiative with values you enter or auto-roll (requires \`canManageInitiative\`)
- **Delete** — remove selected items (with summary confirmation)

Group actions (when a named group is selected):
- **Lock / Unlock** the group
- **Ungroup** — dissolve back to individual entities
- **Export** — export the group as a prefab (.json) for reuse

Region-only actions: **Fill Color** bulk picker

Map Object-only actions: **Opacity** slider, **Lock / Unlock**

Light-only actions: **Range** slider and **Color** picker

---

## Session Setup

### Creating a Session
1. Open Magehand — you'll land on the **Home Screen**.
2. Enter your name and click **Start Session** to enter the tabletop.

### Hosting Multiplayer
1. Click the **Settings** icon (gear) → **Connect to Session** (or if disconnected, "Session Settings").
2. In the Session Manager, click **Create Session**. A session code (e.g. \`ABCD12\`) and a full session ID (\`co_z...\`) are generated.
3. Share either the short code or the full ID with your players. They paste it on the Home Screen or Session Manager to join.
4. The **Connected Users** panel (accessible from the Session tab) shows who's online.

> **Tip:** To freeze player canvases while you make major map changes, use **Tabletop Controls → Pause Broadcasts**. An amber badge appears on all clients while paused. Click Resume to push the final state.

---

## Viewport Controls

### Focus Mode
Click the fullscreen icon in the top bar to enter **Focus Mode** — all UI hides, leaving only the canvas. A small floating restore button appears in the top-right. Useful for showing the map on a display players can see.

### Lock Players to DM Viewport
**Tabletop Controls → Lock Players to DM Viewport** (or the ScanEye icon shortcut in the top bar). While active, all connected players' cameras follow your pan and zoom in real-time. An indicator badge appears. Click again to release.

### Movement Lock
**Tabletop Controls → Lock Token Movement** prevents all non-DM players from dragging tokens. An orange "Movement Locked" banner appears in all clients' top bars. Toggle again to unlock.

---

## Importing Maps

All map imports flow through the **Map Manager** card (open from the Project files menu or the Map Tree card).

### Background Images (PNG/JPG/WEBP)
1. Open Map Manager → **Add Map**.
2. Upload a file or paste a URL.
3. Configure the grid overlay (cell size, offset, square or hex type).
4. The image becomes the map background with the grid rendered on top.

### Watabou Dungeon Maps (.json)
1. Generate a map at [watabou.itch.io/one-page-dungeon](https://watabou.itch.io/one-page-dungeon) and export as JSON.
2. In Map Manager → **Import**, select the JSON file.
3. Rooms, corridors, doors, and notes are parsed into regions automatically.

### Dungeondraft Maps (.dd2vtt)
1. Export from Dungeondraft in **Universal VTT** (.dd2vtt) format.
2. In Map Manager → **Import**, select the file.
3. The background image, grid settings, walls, doors, and light sources are extracted automatically.

### Additive Import
Importing a second map adds it into the **Map Tree** rather than replacing the current map — useful for multi-floor dungeons.

---

## Map Management

### The Map Tree
Open the **Map Tree** card (via Project or the sidebar). Maps are organised as:

- **Structures** — top-level containers (a building, a dungeon, a region)
- **Floors** — levels within a structure
- **Maps** — individual layouts

Click a map in the tree to make it the **active map**. There is also a **Floor Navigation Widget** on the canvas that lets you quickly switch floors.

### Edit Mode vs Play Mode
Switch between these from the **Mode menu** (monitor icon) → World State:

- **Edit Mode** — build and modify maps, place tokens, fog is ignored
- **Play Mode** — fog of war is enforced, movement restrictions apply, tokens snap to grid

---

## Tokens

### Adding Tokens
Open the **Roster** card from the toolbar or Menu to browse placed tokens. To add a new token, right-click the canvas or use the creature library.

### Token Context Menu
Right-click any token for a full context menu:
- **Declare Action** — opens the DRA declare form for that token
- **Open Character Sheet** / **Stat Block**
- **Edit Token** — opens the token editor for image, size, label, flags
- **Add Illumination** — shortcut to the light preset picker
- **Hide / Show**
- **Add to Initiative**
- **Delete**

### Token Properties (Bottom Dock)
Select a token and use the **bottom dock** for quick bulk actions. For detailed per-token settings, use the **Token Panel** card or the context menu editor.

Key properties:
- **Label** — display name; shown above, below, or hidden
- **Size** — grid width × height (1×1 = Medium, 2×2 = Large, etc.)
- **Color** — border tint
- **Role** — links the token to a player role for permissions and visibility
- **Hidden** — invisible to players; DMs see them semi-transparent
- **Elevation** — vertical position in grid units (displayed on the token)
- **Statuses** — conditions like Poisoned, Prone (displayed as badges)
- **Facing** — rotation angle with an optional directional arrow
- **Vision** — enable or disable per-token fog-of-war vision

### Appearance Variants
Tokens can have multiple image variants — wild shape, mounted, disguise, etc. Configure in the **Token Panel** and switch between them from the token editor.

### Illumination Sources
Select a token → **Light** in the bottom dock to apply a preset (Torch, Lantern, Darkvision, etc.) or open **Custom Settings** for fine-grained control:
- Bright and dim radius
- Color tint
- Enable/disable the token's contribution to fog reveal

Freestanding light sources (not attached to a token) can also be placed directly on the canvas and are managed through the **Illumination** system.

### Groups
Select 2 or more entities and click **Group** in the bottom dock to give them a name and lock them together. Grouped entities:
- Move as a unit on the canvas
- Can be locked to prevent accidental changes
- Can be exported as a **prefab** (reusable .json file) for reuse in other sessions

---

## Fog of War

### Enabling Fog
Toggle fog per map using the **Cloud/Fog** button in the canvas toolbar (Play Mode only).

### Fog Reveal Brush
With fog enabled, click the **Paintbrush** icon in the canvas toolbar to activate the brush:
- **Left-click drag** — reveal covered areas
- **Right-click drag** (or Hold Shift) — hide (re-fog) areas
- Brush radius is adjustable

### DM Opacity
As DM, fog renders semi-transparent so you can see beneath it. Adjust the opacity from the **Fog Control** card.

### Explored vs. Unexplored
- **Unexplored** — solid darkness for players
- **Explored** — dimmed overlay; players can see but not clearly
- **Revealed** — fully visible (inside vision range of a player token with fog enabled)

Token vision profiles (sight radius, darkvision) are configured per token and automatically interact with the fog system.

---

## Regions & Map Objects

### Regions
Regions define areas of the map with distinct properties. Draw them with the polygon, freehand, or rectangle tools in **Edit Mode**:
- **Grid Override** — different grid type or cell size within the region
- **Fill Color** (bulk editable via the bottom dock)
- **Obstacle** flag — blocks token movement when collision is enforced
- **Region Bounds** — restricts tokens to stay within

### Map Objects
Interactive elements placed on the map:
- **Doors** — click to open/close; block vision and movement when closed
- **Terrain Features** — difficult terrain, traps, hazards
- **Decorations** — non-interactive prop images

Map objects can be locked to prevent accidental moves. Select them to use the **bottom dock** for opacity and lock controls.

---

## Initiative & Combat

### Setting Up
1. Select tokens on the canvas you want to add to the initiative order.
2. In the bottom dock, click **Init** — enter initiative values manually or click **Roll All** to auto-roll d20 for each.
3. Alternatively, right-click a token → **Add to Initiative**.

### Starting Combat
In the **Play panel → Initiative tab**, click **Start Combat** once all combatants are listed. The tracker sorts by initiative, highest first, and highlights the active turn.

### Managing Turns
- **Next Turn** — advance to the next combatant
- **Previous Turn** — step back (for corrections)
- **Remove** — take a combatant out of the tracker
- **Movement Lock** toggle — restrict token movement to only the active combatant's turn

### Combat Tips
- Use **fog reveal** to expose new rooms as the party advances
- Place **map templates** (spell areas, zone markers) directly on the canvas from the **Rules** panel
- Right-click tokens during combat for quick damage, heal, and condition actions
- Use **Pause Broadcasts** while repositioning the map between scenes so clients don't see partial states

---

## Actions — The DRA Workflow

The **DRA (Declare → Gather → Resolve → Apply)** workflow structures combat actions through the **Play panel → Actions tab**.

### Declare Phase
Players right-click their token → **Declare Action** and fill out an action form (action type, target, notes). The declare card also opens automatically when the DM takes structured turns.

### Gather Phase
Magehand prompts for any required die rolls (attack rolls, saving throws). Players click roll badges on the Gather card to broadcast their results. The DM sees all declared actions and rolled results in the queue.

### Resolve Phase
The DM reviews the gathered data and confirms or modifies the result. Damage, healing, and condition applications can be applied from the resolve card.

### History
All resolved actions are written to the **History** tab and the action log.

---

## Rules System

The **Rules** panel (dock it via **+ Dock Tool → Rules**) is the DM's toolbox for custom mechanics. It is gated behind the \`canManageRules\` permission — players only see the Map Templates tab.

### Map Templates (visible to all)
A library of drag-and-drop spell and ability templates:
- Circles (Fireball, Darkness, Spirit Guardians)
- Cones (Burning Hands, Cone of Cold)
- Lines (Lightning Bolt, Wall of Fire)
- Cubes and squares (Fog Cloud, Grease)
- Custom templates you define

Drag a template from the list onto the canvas to place it. Templates are visible to all players.

### Active Effects Orchestrator
Manage **persistent active effects** associated with tokens — ongoing spells, conditions with mechanical effects, auras. Effects can be linked to rules pipelines to automate their application each turn.

### Logic Pipelines
A visual **node-based rule editor** for custom automation:
- Nodes: Dice Roll, Math, Comparison, Output (apply stat modifier, damage, conditions)
- Connect nodes to build logic chains (e.g. "if target fails DC 15 Con save, apply Poisoned condition")
- Pipelines can be triggered manually or wired to active effects

Pipelines can be:
- **Exported** as individual JSON files or in bulk
- **Imported** (newest version wins on collision)
- **Duplicated** for quick iteration

### Adapters
Map external data sources or custom entity schema fields to Magehand's internal entity model. Adapters use path-suggestive editors to browse the entity schema and map source fields to destinations.

### Schema Registry
Inspect the **entity schema** (the data model for tokens and creatures). Use as a reference when building adapters and logic pipelines.

### Vocabulary / Lexicon
A domain-specific dictionary of game terms and aliases used by the rules engine for natural-language lookups in logic nodes.

---

## Compendium & Handouts

### Handout Catalog
Open the **Compendium** panel (dock via + Dock Tool). It shows all built-in handouts (including this guide and the User Guide) plus any custom handouts you've created.

Click a handout to open the **Handout Viewer**.

### Creating Custom Handouts
From the Compendium card, click **+ New Handout** and write Markdown content. Custom handouts are saved with the session.

Handouts can be shared with players — they see the same catalog and can open any handout you've published.

---

## Roles & Permissions

### Role Manager
**Settings ⚙ → Role Manager** (or directly from **Settings**). Configure roles:
- **DM** — full control; all permissions enabled
- **Player** — move assigned tokens, use chat, dice, and actions
- **Observer** — view-only
- **Custom Roles** — create roles with granular permission flags

### Permission Flags
| Flag | Controls |
|------|---------|
| \`canManageFog\` | Reveal and hide fog areas |
| \`canMoveAllTokens\` | Move any token, not just assigned ones |
| \`canEditMaps\` | Modify map settings and regions |
| \`canManageInitiative\` | Add combatants, start/end combat, advance turns |
| \`canAssignTokenRoles\` | Assign tokens to roles |
| \`canManageRules\` | Access the full Rules panel (pipelines, adapters, schema) |

Assign roles to players in the **Session Manager → Connected Users** panel or via the token role selector in the bottom dock.

### UI Mode Lock
In **Settings ⚙ → Mode**, you can lock all clients to **Play Mode** so editing tools are hidden for non-DM users. Toggle again to allow co-DMs to access map controls.

---

## Saving & Exporting

### Project Manager
**Project files** (folder icon) → **Save Session** / **Load Session**:
- Saves all maps, tokens, fog state, initiative, settings, and rules as a \`.mhsession\` file
- Load a previously saved session at any time

### Session History
The **Session History Modal** (accessible from the project menu) lets you browse past session snapshots for rollback.

### Storage Manager
**Settings ⚙ → Storage Manager** — view IndexedDB usage, clear old data, and manage stored textures and blobs.

> **Tip:** Export a \`.mhsession\` file before clearing storage — it's your backup.

---

## Sound System

### Sound Settings
**Settings ⚙ → Sound Settings**:
- Choose ambient categories (Forest, Tavern, Dungeon, Storm, Combat, etc.)
- Layer multiple ambient tracks
- Adjust per-track volume

### Event Sounds
Configure sounds for game events (dice rolls, door open/close, initiative start). Event sounds broadcast to all connected players.

---

## Multiplayer Quick Reference

| Task | How |
|------|-----|
| Create a session | Settings ⚙ → Session Settings → Create Session |
| Share with players | Copy session code or full ID from Session Manager |
| Lock players to your view | Tabletop Controls 🎮 → Lock Players to DM Viewport |
| Freeze player canvases | Tabletop Controls 🎮 → Pause Broadcasts |
| Lock token movement | Tabletop Controls 🎮 → Lock Token Movement |
| Force sync to all clients | Settings ⚙ → Session Settings → Sync to Players |
| Import a map | Project files → Map Manager → Import |
| Add a token to initiative | Select token → Init in bottom dock |
| Start / end combat | Canvas toolbar Swords button, or Play → Initiative → Start Combat |
| Place a spell template | Rules panel → Map Templates → drag to canvas |
| Save the session | Project files → Save Session |

---

*Magehand is designed to get out of your way while giving you powerful tools when you need them. Start with a map, some tokens, and fog — and explore the Rules system as your games grow more complex.*
`;
