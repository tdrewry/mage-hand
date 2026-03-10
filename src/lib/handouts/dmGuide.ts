/**
 * Magehand Host / DM Guide — built-in documentation for game masters.
 */
export const DM_GUIDE_MARKDOWN = `# Magehand Host & DM Guide

This guide covers everything you need to run a game as a **Dungeon Master** (or Game Master) in Magehand. It walks through session setup, map importing, token management, fog of war, combat, and multiplayer hosting.

---

## Session Setup

### Creating a Session
1. Open Magehand — you'll land on the **Landing Screen**.
2. Enter your name and choose the **DM** role.
3. Click **Start Session** to enter the tabletop with a blank canvas.

### Hosting Multiplayer
1. Open the **Menu** card and find the **Multiplayer** section.
2. Click **Connect to Session** to open the Session Manager.
3. **Create** a new room — you'll get a session code (e.g. \`ABC-1234\`).
4. Share the code or URL with your players. They paste it on their Landing Screen to join.
5. The **Connected Users** badge shows who's online.

> **Tip**: Use the **Sync to Players** button after major changes to force a full state push to all connected clients.

---

## Importing Maps

Magehand supports multiple map formats. All imports are accessed through the **Map Manager** card (Menu → Map Manager).

### Watabou Dungeon Maps (.json)
1. Generate a map at [watabou.itch.io/one-page-dungeon](https://watabou.itch.io/one-page-dungeon).
2. Export as JSON.
3. In Magehand, open **Map Manager** → **Import** tab → select the JSON file.
4. The importer parses rooms, corridors, doors, and notes into regions automatically.

### Dungeondraft Maps (.dd2vtt)
1. Export your map from Dungeondraft using the **Universal VTT** (.dd2vtt) format.
2. In **Map Manager** → **Import**, select the .dd2vtt file.
3. The importer extracts the background image, grid settings, walls, doors, and light sources.

### Background Images (PNG/JPG/WEBP)
1. In **Map Manager**, click **Add Map**.
2. Upload or paste a URL for any image file.
3. Configure the grid overlay (cell size, offset, square or hex).
4. The image becomes the map background with a grid drawn on top.

### Additive Import
When importing a second map into an existing session, Magehand adds it to the **Map Tree** rather than replacing the current map. This lets you build compound environments (e.g. a dungeon with multiple floors).

---

## Map Management

### The Map Tree
Open **Menu → Map Tree** to see a hierarchical view of all loaded maps:

- **Structures** — top-level containers (a building, a dungeon, a region)
- **Floors** — levels within a structure (Floor 1, Floor 2, Basement)
- **Maps** — individual map images or imported layouts

Drag and drop entries in the tree to reorganize. Right-click for options like rename, delete, or set as active.

### Map Activation & Focus
- **Active Map**: Only one map renders at a time. Click a map in the tree to activate it.
- **Map Focus**: The DM can set a focus point that auto-scrolls connected players' viewports to a specific location. Useful for revealing a new room or drawing attention to an encounter.

### Grid Regions
Each map can have one or more **grid regions** with independent settings:
- **Grid type**: Square, hexagonal, or none
- **Cell size**: In pixels
- **Snapping**: Toggle to control whether tokens snap to grid cells
- **Visibility**: Show or hide the grid overlay

Open **Menu → Region Control** (or the Region Controls card) to manage regions.

---

## Tokens

### Adding Tokens
1. Open the **Roster** card from the toolbar or Menu.
2. Click **Add Token** and choose an image (upload, URL, or from the Creature Library).
3. The token appears at the center of the canvas. Drag it into position.

### Token Properties
Select a token and open the **Token Panel** to configure:
- **Label**: Display name, position (above/below/hidden), colors
- **Size**: Grid width and height (1×1 for Medium, 2×2 for Large, etc.)
- **Color**: Border tint for quick identification
- **Role**: Assign to a role (player, DM, NPC) to control visibility and permissions
- **Hidden**: Toggle to hide the token from players (DM-only visibility)

### Character Sheets & Stat Blocks
- **Character Sheet**: Attach a full character sheet to a player token. Open via right-click → Character Sheet, or from the Token Panel.
- **Monster Stat Block**: Assign a stat block from the **Creature Library** for quick reference during combat. HP, AC, attacks, and abilities are displayed inline.

### Appearance Variants
Tokens can have multiple **appearance variants** — alternate images for different forms:
- **Wild Shape**: A druid's beast form
- **Mounted**: A character on horseback
- **Disguise**: An NPC's alternate identity

Configure variants in the Token Panel. Switch between them with a single click — the change syncs to all connected players.

### Illumination Sources
Tokens can emit light. In the **Token Panel → Illumination** section:
- Add light sources (torch = 20/40 ft, darkvision = 60 ft, etc.)
- Configure bright and dim radius
- Choose color tint for the light

Light sources interact with the fog of war system to reveal areas around the token.

---

## Fog of War

### Enabling Fog
Fog is controlled **per map**. In the **Fog Control** card (Menu → Fog Control, or the toolbar):
1. Toggle **Enable Fog** for the active map.
2. The entire map is covered in darkness by default.

### Brush Tools
- **Reveal Brush**: Paint to uncover areas for players. Hold Shift for straight lines.
- **Hide Brush**: Paint to re-cover areas (e.g. when players leave a room and you want to re-fog it).
- **Brush Size**: Adjust with the slider or bracket keys \`[\` and \`]\`.

### DM Fog Opacity
As the DM, fog appears semi-transparent to you so you can still see the full map. Adjust the DM opacity slider in the Fog Control card.

### Explored Areas
When a player's token moves through an area, it becomes "explored." Explored areas remain dimly visible even after the token moves away, giving players a sense of where they've been.

### Effect Settings
Fine-tune the fog appearance:
- **Edge Blur**: Softness of fog boundaries (sharp for dungeons, soft for outdoor mist)
- **Volumetric**: Adds a subtle animated cloud effect inside fogged areas
- **Light Falloff**: Controls how illumination sources interact with fog edges

---

## Regions & Map Objects

### Regions
Regions define areas of the map with distinct properties:
- **Texture**: Apply a fill pattern (stone, wood, grass, water, etc.)
- **Grid Override**: Different grid type or cell size within the region
- **Walls**: Define wall segments along region edges for vision blocking

Manage regions in the **Region Control** card.

### Map Objects
Map objects are interactive elements placed on the map:
- **Doors**: Click to open/close; blocks vision when closed
- **Terrain Features**: Difficult terrain markers, traps, environmental effects
- **Decorations**: Non-interactive visual elements (furniture, rubble, etc.)

Manage via **Menu → Map Objects**.

---

## Initiative & Combat

### Starting an Encounter
1. Open the **Initiative Tracker** card (from the toolbar or Menu).
2. Click **Add Combatant** for each participant — select from tokens on the map.
3. Enter initiative values (or use the built-in roller).
4. Click **Start Combat** — the tracker sorts by initiative and highlights the first turn.

### Managing Turns
- **Next Turn**: Advances to the next combatant in order.
- **Previous Turn**: Steps back (for corrections).
- **Remove**: Take a defeated creature out of the tracker.
- **Movement Lock**: Toggle to restrict token movement to the active combatant's turn only.

### Combat Tips
- Use **fog reveal** to show new rooms as the party advances.
- Place **effects** (spell areas, zone markers) on the map to visualize abilities.
- Right-click tokens for quick actions: damage, heal, add conditions.

---

## Effects & Auras

### Effect Templates
Magehand includes a library of effect templates for common spells and abilities:
- **Circles**: Fireball, Spirit Guardians, Darkness
- **Cones**: Burning Hands, Cone of Cold
- **Lines**: Lightning Bolt, Wall of Fire
- **Cubes/Squares**: Fog Cloud, Grease

Open the **Effects** card (Menu or toolbar) to browse and place templates.

### Placing Effects
1. Select a template from the library.
2. Click on the map to place it. Drag to position and rotate.
3. Effects are visible to all players and persist until removed.

### Auras
Tokens can have **auras** — persistent radial effects centered on the token:
- Paladin's Aura of Protection (10 ft)
- Frightful Presence (30 ft)
- Custom auras with configurable radius, color, and opacity

Auras move with the token automatically.

---

## Roles & Permissions

### Role Manager
Open **Menu → Role Manager** to configure roles:
- **DM**: Full control over all features
- **Player**: Can move assigned tokens, use chat and dice
- **Observer**: View-only access
- **Custom Roles**: Create roles with granular permissions (e.g. "Co-DM" with fog control but not token deletion)

### Permission Flags
Each role has toggleable permissions:
- \`canManageFog\` — reveal/hide fog
- \`canMoveAllTokens\` — move any token, not just assigned ones
- \`canEditMaps\` — modify map settings and regions
- \`canManageInitiative\` — control the initiative tracker

Assign roles to players in the **Connected Users** panel or via the token's role dropdown.

---

## Multiplayer Tools

### Sync to Players
Click **Menu → Sync to Players** to force a full state push. Use this after:
- Importing a new map
- Making bulk changes to tokens or fog
- A player reports desynced state

### Viewport Follow
Enable **viewport follow** to force all connected players' cameras to follow the DM's viewport. Useful for cinematic reveals or guided tours of a new map.

### UI Mode Lock
Set all players to **Play Mode** to hide editing tools, or unlock to let co-DMs access map controls.

### Connected Users Panel
View all connected players, their roles, and connection status. Kick or reassign roles from here.

---

## Saving & Exporting

### Project Manager
Open **Menu → Project Manager** to:
- **Save Session**: Export the current state as a \`.mhsession\` file (includes all maps, tokens, fog, initiative, settings)
- **Load Session**: Import a previously saved session
- **Auto-Save**: Magehand auto-saves to browser storage periodically. The interval is configurable.

### Storage Manager
Open **Menu → Storage Manager** to see how much browser storage is used and clear old data if needed. Large maps with many textures can consume significant storage.

> **Tip**: Save a \`.mhsession\` file before clearing storage — it's your backup.

---

## Sound System

### Ambient Engine
The **Sound Settings** card (Menu → Sound Settings) lets you set ambient background audio:
- Choose from categories: Forest, Tavern, Dungeon, Storm, Combat, etc.
- Layer multiple ambient tracks for rich environments
- Adjust volume per track

### Event Sounds
Configure sounds that trigger on specific events:
- Dice rolls
- Initiative start
- Token damage
- Door open/close

Event sounds play for all connected players, adding immersion to key moments.

---

## Quick Reference

| Task | How |
|------|-----|
| Import a map | Menu → Map Manager → Import |
| Add a token | Roster card → Add Token |
| Toggle fog | Menu → Fog Control → Enable Fog |
| Start combat | Initiative Tracker → Add Combatants → Start |
| Place a spell effect | Effects card → Choose template → Click map |
| Save the session | Menu → Project Manager → Save |
| Share with players | Menu → Connect → Share session code |
| Force sync | Menu → Sync to Players |

---

*Magehand is designed to stay out of your way while giving you powerful tools when you need them. Start simple — import a map, add tokens, enable fog — and explore advanced features as your games grow more complex.*
`;
