# Custom Handouts System (v0.7.195)

## Status: Implemented

## Overview
DMs can now create, edit, and delete custom handout entries (title + markdown content) that persist in localStorage. Custom handouts appear alongside built-in guides in the Handout Catalog, are selectable in narrative node linking dropdowns, and can be shared with players via the handout viewer.

## Files Created
- `src/stores/handoutStore.ts` — Zustand store with `persist` middleware for custom handouts (CRUD operations)

## Files Modified
- `src/lib/handouts/index.ts` — Added `getAllHandouts()` and updated `getHandoutById()` to search both built-in and custom handouts
- `src/components/cards/HandoutCatalogCard.tsx` — Added "New" button, edit/delete actions for custom entries, and a create/edit dialog with markdown editor + live preview
- `src/components/cards/CampaignEditorCard.tsx` — Changed handout dropdown to use `getAllHandouts()` so custom handouts are linkable to narrative nodes
- `src/lib/campaign-editor/adapters/magehand-ttrpg.ts` — Updated `openHandoutById` to use unified `getHandoutById`
- `src/lib/version.ts` — Bumped to 0.7.195

## No External Impact
Purely client-side UI with localStorage persistence. No websocket server, Jazz service, or other external service changes required.
