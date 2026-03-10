/**
 * Magehand User Guide — built-in documentation for players.
 */
export const USER_GUIDE_MARKDOWN = `# Magehand User Guide

Welcome to **Magehand** — a browser-based virtual tabletop (VTT) for playing tabletop RPGs online. This guide covers everything you need to know as a **player**.

---

## Getting Started

When you first open Magehand you'll see the **Landing Screen**. From here you can:

- **Enter your name** — this is how other players and the DM will see you.
- **Join a session** — paste a session code or URL shared by your DM.
- **Load a saved session** — open a \`.mhsession\` file from a previous game.

Once you've joined, the DM controls the map, fog, and encounter flow. You control your token and interact through chat and dice.

---

## The Tabletop Canvas

The main area is an infinite canvas showing the current map, grid, tokens, and effects.

### Navigation
| Action | Input |
|--------|-------|
| Pan | Middle-click drag, or two-finger drag on touch |
| Zoom | Scroll wheel, or pinch on touch |
| Select | Left-click a token or map object |

The grid overlay (square or hex) is managed by the DM and snaps token movement to cells.

---

## Tokens

Your character is represented by a **token** on the map. Click your token to select it, then drag to move.

### Movement Path
When you drag a token you'll see:
- A **ghost image** at the origin showing where you started
- A **distance line** from origin to cursor showing total movement in feet/meters
- **Footprints** along your path (style depends on DM settings — pointed, round, or gait-width)

Release the mouse button to commit the move. The ghost, path, and footprints clear for all connected players.

### Labels & Appearance
Tokens can display a **label** (your character name) below, above, or hidden. The DM may also configure **appearance variants** — for example a Wild Shape or Mounted form — that change your token's image on the fly.

---

## Initiative & Combat

When the DM starts an encounter, the **Initiative Panel** appears.

1. The DM will ask you to roll initiative (or may roll for you).
2. Your entry appears in the turn order list, sorted highest to lowest.
3. On your turn the panel highlights your entry — move your token and declare actions via chat.
4. The DM advances turns with the **Next Turn** button.

> **Movement Lock**: The DM can enable movement lock during combat so you can only move your token on your turn.

---

## Fog of War (Player View)

The DM controls what you can see. Areas you haven't explored appear as solid darkness. Areas you've visited but aren't currently illuminated show as a dimmed "explored" overlay. Only the area around your token (based on its **vision profile**) is fully visible.

- You **cannot** see hidden tokens or fog-covered areas.
- If your token has an illumination source (torch, darkvision), it expands your visible area.
- The DM may reveal or hide areas at any time.

---

## Chat & Dice

### Chat Card
Open the **Chat** card from the Menu to send messages to other players and the DM. Messages appear in real-time for all connected users.

### Dice Roller
Open the **Dice Box** card from the Menu. You can:
- Click preset dice (d4, d6, d8, d10, d12, d20, d100)
- Type custom notation like \`2d6+3\` or \`1d20+5\`
- Results are shown with a 3D dice animation and broadcast to all players

Common notation:
- \`1d20\` — roll one twenty-sided die
- \`2d6+3\` — roll two six-sided dice, add 3
- \`4d6kh3\` — roll four d6, keep highest three (ability score generation)

---

## Cards & the UI

Magehand's interface is built around **cards** — floating, draggable panels that you can open, close, minimize, and resize.

- **Open a card**: Use the Menu card or the vertical toolbar on the left edge.
- **Move a card**: Drag its title bar.
- **Resize a card**: Drag the handle in the bottom-right corner.
- **Minimize**: Click the **−** button in the title bar. Click the expand icon to restore.
- **Close**: Click the **✕** button. Re-open from the Menu anytime.

The **Menu card** cannot be closed — it's your home base for accessing all other cards and session controls.

---

## Multiplayer

When connected to a session:
- You'll see other players' **cursors** moving on the canvas in real-time.
- The **connection indicator** in the corner shows your sync status (green = connected).
- Token movements, dice rolls, and chat messages sync automatically.
- If you lose connection, Magehand will attempt to reconnect automatically.

---

## Saving & Loading

- The DM manages session saves via the **Project Manager** card.
- Sessions are saved as \`.mhsession\` files that include all maps, tokens, fog state, and settings.
- As a player, you can load a session file from the landing screen if the DM shares it with you.
- **Auto-save** runs periodically so progress isn't lost on unexpected disconnects.

---

## Quick Reference

| Task | How |
|------|-----|
| Move your token | Click and drag |
| Open chat | Menu → Chat |
| Roll dice | Menu → Dice Box |
| Check initiative | Look at the Initiative Panel |
| See who's online | Menu → Players |
| Zoom to fit | Scroll wheel to zoom, middle-click drag to pan |

---

*Happy adventuring! If something isn't working as expected, let your DM know — they have tools to troubleshoot and re-sync the session.*
`;
