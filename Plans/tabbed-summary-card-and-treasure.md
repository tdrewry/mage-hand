# Tabbed NodeSummaryCard + Treasure System

## Status: ✅ Complete

## Changes

### 1. NodeSummaryCard → Tabbed Layout
- **Summary tab**: Description + Prologue
- **Dialog tab**: Narrative/dialog lines with send-to-chat (conditional)
- **Handouts tab**: Linked handout buttons (conditional)
- **Loot tab**: Treasure items with quantity badges (conditional)
- **Choices**: Pinned at the bottom outside tab content (dialog nodes only)

### 2. Treasure Data Model
- Added `treasure?: { id, name, quantity?, description? }[]` to `BaseFlowNode`
- Added `hasTreasure?: boolean` to `NodeFeatureFlags`

### 3. Node Type Config Updates
- All 4 node types (Encounter, Narrative, Dialog, Rest) now have `hasHandouts: true` and `hasTreasure: true`

### 4. Node Editor (CampaignEditorCard)
- Added Treasure/Loot section with Add/Remove UX (name + quantity per item)
- Handouts section was already present and now available on all node types

## Files Modified
- `src/components/NodeSummaryCard.tsx` — full rewrite to tabbed layout
- `src/lib/campaign-editor/types/base.ts` — added `treasure` field
- `src/lib/campaign-editor/types/nodeConfig.ts` — added `hasTreasure` flag
- `src/lib/campaign-editor/adapters/magehand-ttrpg.ts` — enabled handouts+treasure on all types
- `src/components/cards/CampaignEditorCard.tsx` — added treasure editor UI
- `src/lib/version.ts` — bumped to 0.7.197
