/**
 * Magehand User Guide — built-in documentation for players.
 */
export const USER_GUIDE_MARKDOWN = `# Magehand User Guide

Welcome to **Magehand** — a browser-based virtual tabletop (VTT) for tabletop RPGs. This guide covers everything you need to know as a **player**.

---

## Getting Started

When you first open Magehand you'll land on the **Home Screen**. From here you can:

- **Enter your name** — this is how other players and the DM will see you.
- **Join a session** — paste a session code or full session ID (\`co_z...\`) shared by your DM.
- **Start a solo session** — jump straight into the tabletop for solo play or exploration.

Once you've joined, the DM controls the map, fog, and encounter flow. You control your token and interact through the Play panel.

---

## The Interface

### Top Bar

The top bar is always visible and contains:

- **Mage Hand** brand logo and session info badges (session code, token count)
- **Mode menu** (monitor icon) — switch between DM View and Player View
- **Project files** (folder icon) — save or load sessions
- **Settings** (gear icon) — network, storage, role manager, sound settings
- **Tabletop controls** (gamepad icon) — lock/unlock movement
- **Focus Mode** (fullscreen icon) — hides all UI chrome for an immersive view; a small restore button appears in the top-right corner

### Left & Right Sidebars

The two side panels are collapsible docked tool areas. Click the **chevron arrow** at either edge of the top bar to toggle them open or closed.

#### + Dock Tool
When a sidebar is open, a **"+ Dock Tool"** button appears in the top bar at that side. Click it to add a tool panel into that sidebar:

| Tool | What it contains |
|------|-----------------|
| **Play** | Chat, History, Dice, Initiative, and Actions — the primary play panel |
| **Compendium** | Reference material and handouts |
| **Campaign** | Campaign notes and scene management |
| **Environment** | Ambient environment settings |
| **Rules** | Map templates, effects catalog, and (DM only) logic pipelines |

Each docked tool fills the sidebar. You can swap tools at any time with the **+ Dock Tool** button.

### Canvas Toolbar (left edge)

A slim vertical toolbar sits on the left edge of the canvas. In **Play Mode** it includes:

| Button | Action |
|--------|--------|
| Pause/Play | Toggle canvas animations on or off |
| Cloud/Fog | (DM only) Toggle fog of war on the current map |
| Paintbrush | (DM only, when fog is on) Activate the fog reveal brush |
| Eye | Show or hide region overlays |
| ShieldX | Toggle obstacle collision enforcement |
| Fence | Toggle region bounds enforcement |
| Swords | Start or end combat |
| Undo / Redo | Step backward or forward through canvas changes (Ctrl+Z / Ctrl+Shift+Z) |
| Fit to View | Reset the viewport to show the whole map |

---

## The Tabletop Canvas

The main area is an infinite canvas showing the current map, grid, tokens, and effects.

### Navigation
| Action | Input |
|--------|-------|
| Pan | Middle-click drag, or two-finger drag on touch |
| Zoom | Scroll wheel, or pinch on touch |
| Select | Left-click a token or map object |
| Multi-select | Shift+click or drag a selection box |

The grid overlay (square or hex) is configured by the DM and snaps token movement to cells.

---

## Tokens

Your character is represented by a **token** on the map. Click your token to select it, then drag to move it.

### Movement Path
When you drag a token you'll see:
- A **ghost image** at the origin showing where you started
- A **distance line** showing total movement
- **Footprints** along your path (style set by the DM — pointed, round, or gait-width)

Release to commit the move. The DM may have **movement lock** enabled during combat, which prevents you from moving outside your turn.

### Selection Dock (Bottom Bar)

When one or more tokens are selected, a **dock toolbar** slides up from the bottom of the screen, showing:

- **Selection summary** — count of selected tokens, regions, objects, and lights
- **Group** — when 2+ entities are selected, create a named group
- **Role** — assign selected tokens to a player role (if you have permission)
- **Vis** — hide or show tokens (if you have permission)
- **Light** — quick-apply or customise illumination presets on the token
- **Orientation** — set rotation and toggle the facing indicator arrow
- **State** — set elevation (in units) or apply conditions like Poisoned, Prone
- **Color** — set the token's border color (single selection) or bulk edit (multi-selection)
- **Init** — add selected tokens to initiative (if you have the Manage Initiative permission)
- **Delete** — remove selected items (with confirmation)

### Labels & Appearance
Tokens display a label (character name) and may have **appearance variants** — alternate images for wild shapes, mounted forms, etc. — switchable by the DM.

---

## The Play Panel

Open the **Play** tool (via **+ Dock Tool** or the toolbar) to access the five tabs:

### Chat
Send messages to all connected players and the DM. Messages appear in real-time.

### History
A scroll of events from the current session — rolls, damage, actions, and system messages.

### Dice
Click preset dice (d4, d6, d8, d10, d12, d20, d100) or type custom notation:
- \`1d20\` — roll a twenty-sided die
- \`2d6+3\` — two six-sided dice plus 3
- \`4d6kh3\` — roll four d6, keep the highest three (ability score generation)

Results are broadcast to all connected players with a 3D roll animation.

### Initiative
View the current turn order. Your entry is highlighted on your turn. The DM advances turns.

> **Tip:** The DM can enable **movement lock** during combat — you'll see a "Movement Locked" banner in the top bar to confirm it's active. Click the banner to unlock (if you have permission).

### Actions

The **Actions** tab is the Declare-Resolve workflow for structured combat actions:

1. Right-click your token on the canvas → **Declare Action** to open the declare form
2. Choose an action type, describe your intent, and submit — it appears in the DM's queue
3. The DM resolves actions in order; results appear in the History tab

---

## Initiative & Combat

When the DM starts an encounter:

1. The DM adds combatants and asks for initiative rolls
2. Your entry appears in the turn order (Play panel → Initiative tab), sorted highest to lowest
3. On your turn the panel highlights your entry
4. The DM clicks **Next Turn** to advance

> **Movement Lock:** When active, you cannot move tokens outside your turn. The banner in the top bar confirms the lock state.

---

## Fog of War (Player View)

The DM controls visibility. Areas not yet explored appear as solid darkness. Areas you've visited but left appear dimmed. Only the area around your token (based on its vision profile and light sources) is fully lit.

- You **cannot** see hidden tokens or fog-covered areas
- Tokens with torchlight, darkvision, or other light sources expand the visible area automatically
- The DM can reveal or re-hide areas at any time

---

## Multiplayer

When connected to a session:
- You'll see other players' **cursors** moving on the canvas in real-time
- The **connection indicator** in the corner shows your sync status
- Token moves, dice rolls, and chat messages sync automatically across all clients
- If you lose connection, Magehand reconnects automatically; changes made offline sync when connectivity is restored

---

## Saving & Loading

- The DM manages saves via the **Project** menu (folder icon in top bar)
- Sessions are saved as \`.mhsession\` files containing all maps, tokens, fog, and settings
- As a player, you can load a session file from the home screen if the DM shares it

---

## Quick Reference

| Task | How |
|------|-----|
| Move your token | Click and drag |
| Open Chat | + Dock Tool → Play → Chat tab |
| Roll dice | Play panel → Dice tab |
| Check initiative | Play panel → Initiative tab |
| Declare an action | Right-click token → Declare Action |
| See who's online | Settings ⚙ → Connect to Session |
| Toggle focus mode | Fullscreen icon in top bar |

---

*Happy adventuring! If something looks wrong, let your DM know — they can force a full sync from the Session Settings.*
`;
