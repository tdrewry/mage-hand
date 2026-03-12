

# Custom Handouts System

## Overview
Add a Zustand store for custom handouts (title + markdown) that DMs can create, edit, and delete. These appear alongside built-in handouts in the catalog, are selectable in narrative node linking dropdowns, and persist via localStorage.

## Architecture

### 1. New Store: `src/stores/handoutStore.ts`
- Zustand store with `persist` middleware (localStorage key: `magehand-handouts`)
- State: `customHandouts: HandoutEntry[]`
- Actions: `addHandout`, `updateHandout`, `deleteHandout`
- Each entry gets a unique ID (`custom-handout-{timestamp}`), `category: 'custom'`, `icon: 'FileText'`

### 2. Update `src/lib/handouts/index.ts`
- Add `getAllHandouts()` function that merges `BUILTIN_HANDOUTS` with custom handouts from the store
- Update `getHandoutById()` to also search custom handouts
- Keep `BUILTIN_HANDOUTS` export unchanged for backward compatibility

### 3. Update Handout Catalog Card (`HandoutCatalogCard.tsx`)
- Add "New Handout" button at the top
- Show custom handouts below built-in ones with edit/delete actions
- Clicking "New Handout" opens a create/edit dialog
- Add inline edit and delete buttons for custom entries

### 4. New Component: Handout Editor Dialog
- Modal dialog with title input + markdown textarea
- Live preview toggle using existing `MarkdownRenderer`
- Used for both create and edit flows
- Rendered inside the catalog card or as a standalone dialog

### 5. Update Handout Viewer Card (`HandoutViewerCard.tsx`)
- Update `getHandoutById` call to also search custom handouts from the store

### 6. Update Campaign Editor Handout Dropdown
- In `CampaignEditorCard.tsx`, change `BUILTIN_HANDOUTS` reference in the linked handouts Select to use `getAllHandouts()` so custom handouts appear as linkable options

### 7. Update `openHandoutById` in magehand-ttrpg adapter
- Use the unified `getHandoutById` that searches both built-in and custom

### 8. Session Persistence
- Custom handouts persist in localStorage via Zustand persist middleware
- Include in session export/import via the durable object registry (future enhancement, not blocking)

## Files to Create
- `src/stores/handoutStore.ts`

## Files to Modify
- `src/lib/handouts/index.ts` — add `getAllHandouts()`, update `getHandoutById()`
- `src/components/cards/HandoutCatalogCard.tsx` — add create/edit/delete UI for custom handouts
- `src/components/cards/HandoutViewerCard.tsx` — use updated `getHandoutById`
- `src/components/cards/CampaignEditorCard.tsx` — use `getAllHandouts()` in dropdown
- `src/lib/campaign-editor/adapters/magehand-ttrpg.ts` — use updated `getHandoutById` in `openHandoutById`
- `src/lib/version.ts` — bump version

