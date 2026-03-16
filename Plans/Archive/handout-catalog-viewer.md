# Markdown Documentation Catalog & Viewer (v0.7.165)

## Status: Implemented

## Overview
Added a built-in documentation system with a catalog of markdown entries and a reader card, accessible from the in-app Menu. Ships with two permanent guides: **Magehand User Guide** (for players) and **Magehand Host/DM Guide** (for DMs).

## Files Created
- `src/lib/handouts/userGuide.ts` — Player-facing guide (~800 words)
- `src/lib/handouts/dmGuide.ts` — DM/Host guide (~2000 words)
- `src/lib/handouts/index.ts` — HandoutEntry type, BUILTIN_HANDOUTS registry
- `src/components/MarkdownRenderer.tsx` — Lightweight markdown-to-JSX renderer (no deps)
- `src/components/cards/HandoutCatalogCard.tsx` — Catalog listing card
- `src/components/cards/HandoutViewerCard.tsx` — ScrollArea markdown viewer card

## Files Modified
- `src/types/cardTypes.ts` — Added HANDOUT_CATALOG, HANDOUT_VIEWER enum values
- `src/stores/cardStore.ts` — Added default configs for new card types
- `src/components/cards/MenuCard.tsx` — Added "Handouts" button in Project section
- `src/components/CardManager.tsx` — Added render cases for new card types
- `src/lib/version.ts` — Bumped to 0.7.165

## No External Impact
This is a purely client-side UI addition. No websocket server, Jazz service, or other external service changes required.
