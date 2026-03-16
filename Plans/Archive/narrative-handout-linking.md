# Narrative Node Handout Linking (v0.7.194)

## Status: Implemented

## Overview
Added the ability to link handouts to Narrative scene nodes. Handouts are shown as buttons in the Scene Runner widget and Node Summary Card. The DM clicks to open/share — no longer auto-opened on scene activation.

## Changes

### Type System
- `src/lib/campaign-editor/types/base.ts` — Added `handouts?: { id: string; label: string; handoutId: string }[]` to `BaseFlowNode`
- `src/lib/campaign-editor/types/nodeConfig.ts` — Added `hasHandouts` to `NodeFeatureFlags`

### Adapter
- `src/lib/campaign-editor/adapters/magehand-ttrpg.ts`:
  - Enabled `hasHandouts: true` on `MAGEHAND_NARRATIVE_CONFIG`
  - Removed auto-open handout logic from `executeNarrativeNode`
  - Added `openHandoutById()` export for on-demand handout opening

### Editor
- `src/components/cards/CampaignEditorCard.tsx` — Added "Linked Handouts" section in `NodePropertyPanel` with label input + handout dropdown (from `BUILTIN_HANDOUTS`)

### Runtime
- `src/components/CampaignSceneRunner.tsx` — Added handout buttons row in widget
- `src/components/NodeSummaryCard.tsx` — Added handout buttons section

## No External Impact
Purely client-side UI. No websocket or external service changes.
