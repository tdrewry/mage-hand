

# Markdown Documentation Catalog & Viewer (v0.7.165)

## Overview
Add a built-in documentation system with a catalog of markdown entries and a reader card, accessible from the in-app Menu. Ships with two permanent guides: **Magehand User Guide** (for players) and **Magehand Host/DM Guide** (for DMs). The viewer renders markdown in a scrollable, styled card using a lightweight parser (no new dependency needed — we'll use a simple regex-based renderer since the content is controlled).

## Architecture

```text
┌─────────────────┐     ┌──────────────────────┐
│  MenuCard.tsx    │────▶│  HandoutCatalogCard   │
│  "Handouts" btn  │     │  (list of entries)    │
│                  │     │  ┌──────────────┐     │
│                  │     │  │ User Guide   │──┐  │
│                  │     │  │ DM Guide     │  │  │
│                  │     │  │ (future:user) │  │  │
│                  │     │  └──────────────┘  │  │
│                  │     └───────────────────┘ │
│                  │                           ▼
│                  │     ┌──────────────────────┐
│                  │     │  HandoutViewerCard    │
│                  │     │  (markdown renderer)  │
│                  │     │  with scroll area     │
│                  │     └──────────────────────┘
└──────────────────┘
```

## New Files

### 1. `src/lib/handouts/userGuide.ts`
Export a `const USER_GUIDE_MARKDOWN: string` covering:
- **Getting Started**: Landing screen, choosing a name/role, joining a session
- **The Tabletop Canvas**: Pan (middle-click/two-finger), zoom (scroll), the grid overlay
- **Tokens**: Selecting, moving, drag paths (ghost-at-origin, distance line, footprints), token labels, appearance variants
- **Initiative & Combat**: The initiative panel, entering initiative, turn order, movement restrictions
- **Fog of War (Player Perspective)**: What you see vs explored areas, vision range
- **Chat & Dice**: The chat card, dice roller, dice notation
- **Cards & UI**: What are cards, minimizing, moving, closing them
- **Multiplayer**: Joining a session, seeing other cursors, sync status
- **Saving & Loading**: .mhsession files, the landing screen actions

### 2. `src/lib/handouts/dmGuide.ts`
Export a `const DM_GUIDE_MARKDOWN: string` covering:
- **Session Setup**: Creating a session, identity selection (DM role), hosting multiplayer
- **Importing Maps**: Watabou (.json), Dungeondraft (.dd2vtt), Prefab (.d20prefab), background images via Map Manager, additive import, group-on-import
- **Map Management**: Map Manager card, Map Tree (structures, floors, compound maps), map activation/focus, multi-map stacking, grid regions (square/hex/none)
- **Tokens**: Adding tokens, assigning to roles, configuring illumination sources, vision profiles, hiding tokens, stat blocks, appearance variants (Wild Shape, Mounted), character sheet editing
- **Fog of War (DM)**: Enabling per-map fog, brush tools (reveal/hide), DM fog opacity, explored areas, effect settings (edge blur, volumetric, light falloff)
- **Regions & Map Objects**: Creating regions, textures, doors/terrain features, wall segments
- **Initiative & Combat**: Starting combat, adding combatants, managing turns, movement lock
- **Effects & Auras**: Effect templates, placing effects on the map, effect sizing, aura system
- **Roles & Permissions**: Role Manager, creating custom roles, permission flags
- **Multiplayer Tools**: Sync to Players button, viewport follow, UI mode lock, connected users panel
- **Saving & Exporting**: Project Manager, .mhsession format, storage manager, auto-save
- **Sound System**: Ambient engine, event sounds, categories

### 3. `src/lib/handouts/index.ts`
Export a `HandoutEntry` type and a `BUILTIN_HANDOUTS` array:
```ts
interface HandoutEntry {
  id: string;
  title: string;
  category: 'builtin' | 'custom';
  icon: string; // lucide icon name
  markdown: string;
}
```

### 4. `src/components/cards/HandoutCatalogCard.tsx`
A card listing all handout entries with title and category badge. Clicking an entry opens a `HandoutViewerCard` for that entry (registers a new card with `metadata.handoutId`).

### 5. `src/components/cards/HandoutViewerCard.tsx`
A card that renders markdown content in a `ScrollArea`. Uses a simple component `MarkdownRenderer` that converts headings, bold, italic, lists, code blocks, and horizontal rules to styled HTML. No external markdown library needed since content is controlled.

### 6. `src/components/MarkdownRenderer.tsx`
Lightweight markdown-to-JSX renderer handling:
- `#`-`####` headings
- `**bold**`, `*italic*`, `` `code` ``
- `- ` unordered lists, `1. ` ordered lists
- `---` horizontal rules
- `> ` blockquotes
- Blank-line paragraph breaks

## Modified Files

### `src/types/cardTypes.ts`
Add `HANDOUT_CATALOG = 'handout_catalog'` and `HANDOUT_VIEWER = 'handout_viewer'` to the `CardType` enum.

### `src/components/cards/MenuCard.tsx`
Add a "Handouts" button in the Project section (using `BookOpen` icon) that toggles the `HandoutCatalogCard`.

### `src/components/CardManager.tsx`
Add case branches for `CardType.HANDOUT_CATALOG` and `CardType.HANDOUT_VIEWER` to render the new card components.

### `src/lib/version.ts`
Bump to `0.7.165`.

## Documentation Content Approach
The guides will be written from the perspective of someone who has explored the app and understands the workflow. They will be practical, task-oriented ("How do I...") rather than exhaustive API docs. The User Guide (~800 words) focuses on the player experience. The DM Guide (~2000 words) covers the full hosting workflow from map import to running a session. Both will reference specific UI elements by name (e.g., "open the Map Manager card from the Menu").

## No New Dependencies
The markdown renderer is a simple controlled-content parser (~80 lines). No `react-markdown` or `marked` needed.

