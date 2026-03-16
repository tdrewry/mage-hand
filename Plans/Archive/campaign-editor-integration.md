# Campaign Editor Integration with Map Layers & Deployment Zones

## Overview

Integrate the campaign editor module from Mech Tactics Legacy into Magehand, replacing its terrain grid concept with Magehand's existing multi-map architecture. Campaign encounter nodes link to maps by ID, and a new **deployment-zone** MapObject category marks token spawn areas. A visual flow graph lets the DM author branching story campaigns, and a runtime scene runner advances through nodes during play — activating maps, placing tokens, and presenting narrative content.

## Source Module (from Mech Tactics Legacy)

```text
src/lib/campaign-editor/
├── types/        (base, adapter, editor, execution, nodeConfig)
├── lib/          (campaignManager, createAdapter, graphRunner, storage, validation, utils)
├── components/   (GenericFlowCanvas, AdapterShowcase — skip GenericEditorCanvas, GenericMapToolPalette)
├── hooks/
├── adapters/     (fantasy-dungeon as reference — skip lancer/scifi)
├── ui/           (bundled primitives)
├── index.ts
```

**Strip on copy**: `GenericEditorCanvas.tsx`, `GenericMapToolPalette.tsx`, `scifi-station.ts`, `scifiNodeConfigs.ts`, `proceduralGeneration.ts` — none apply to image-based maps.

## Phase 1: Deployment Zone MapObject

### `src/types/mapObjectTypes.ts`

- Add `'deployment-zone'` to `MapObjectShape` and `MapObjectCategory` unions
- Add label: `'Deployment Zone'`
- Add preset: shape `'rectangle'`, 120x120, semi-transparent green (`rgba(34,197,94,0.2)`), dashed green stroke, no shadow/block/vision flags
- Add optional fields to `MapObject`: `deploymentZoneLabel?: string`, `deploymentZoneGroup?: string` (role or group name for auto-placement)

### `src/lib/mapObjectRenderer.ts`

- Render deployment zones as dashed-border rectangles with a label badge (DM-only, hidden from players)

## Phase 2: Copy & Adapt Campaign Editor Module

### Copy into `src/lib/campaign-editor/`

- All type files, lib files (minus proceduralGeneration), hooks, ui primitives, GenericFlowCanvas
- Keep `fantasy-dungeon.ts` adapter as reference only

### Create `src/lib/campaign-editor/adapters/magehand-ttrpg.ts`

Magehand TTRPG adapter configuration:

| Field              | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| `terrainTypes`     | Empty array (no terrain painting)                                            |
| `labels`           | `{ campaign: 'Campaign', node: 'Scene', terrain: 'Map', objective: 'Goal' }` |
| `nodeTypes`        | 4 types (see below)                                                          |
| `storage`          | localStorage adapter keyed `magehand-campaigns`                              |
| `executionHandler` | Wired to Magehand stores (see Phase 4)                                       |

**Node types for Magehand:**

| Type        | Label       | Features                                    | Custom Fields                                                                                                                           |
| ----------- | ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `encounter` | Encounter   | hasMap: false (we use mapId picker instead) | `mapId` (select), `deploymentZoneId` (select filtered by mapId), `fogPreset` (select: keep/reveal-all/reset), `tokenGroupId` (optional) |
| `narrative` | Narrative   | hasDialogLines, hasSceneSettings            | (none extra)                                                                                                                            |
| `dialog`    | Decision    | hasDialogLines, hasOutcomes                 | (none extra)                                                                                                                            |
| `rest`      | Rest/Travel | hasAutoAdvance                              | `narrativeReason` (text)                                                                                                                |

## Phase 3: Zustand Store & Card Integration

### `src/stores/campaignStore.ts`

- State: `campaigns: BaseCampaign[]`, `activeCampaignId`, `activeProgress: GraphProgress | null`
- Actions: CRUD, `advanceNode`, `resolveNode`, `resetProgress`
- Persistence via `DurableObjectRegistry` (kind: `campaigns`, version: 1)

### `src/types/cardTypes.ts`

- Add `CAMPAIGN_EDITOR = 'campaign_editor'` to `CardType` enum
- Add to `DM_ONLY_CARD_TYPES`

### `src/components/cards/CampaignEditorCard.tsx`

- Campaign list/create screen when no campaign loaded
- On load: split view — `GenericFlowCanvas` (top) + node property panel (bottom)
- Encounter node panel shows: map picker dropdown (from `mapStore.maps`), deployment zone picker (filtered to zones on selected map), fog preset selector
- Validation: warning badge if encounter node's map has no deployment zones

### `src/components/cards/MenuCard.tsx`

- Add "Campaign" button in DM Tools section (using `Map` or `Route` icon)

### `src/components/CardManager.tsx`

- Add render case for `CardType.CAMPAIGN_EDITOR`

### `src/stores/cardStore.ts`

- Add default config (800x600, resizable, DM-only)

## Phase 4: Runtime Execution Bridge

### Execution handler in `magehand-ttrpg.ts`

| Node Type        | Magehand Action                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `encounter`      | `mapStore.setSelectedMap(mapId)` → find deployment-zone MapObjects → reposition tokens within zone bounds → optionally reset fog |
| `narrative`      | Open `HandoutViewerCard` with node's `dialogLines` rendered as markdown                                                          |
| `dialog`         | Open a choice modal or post choices to chat card with clickable buttons                                                          |
| `rest`           | Toast notification with `narrativeReason`, no map change                                                                         |
| `onNodeComplete` | Save progress to `campaignStore`, advance graph                                                                                  |

### `src/components/CampaignSceneRunner.tsx`

- Small persistent DM widget (similar to initiative panel)
- Shows current scene name, "Advance" (forward or backward) / "Resolve" buttons
- Only visible when a campaign has active progress

## Phase 5: Persistence

### `src/lib/durableObjectRegistry.ts` (registration)

- Register `campaigns` DO (kind: `campaigns`, version: 1)
- Extractor/hydrator from `campaignStore`
- Exports/imports with `.mhdo` archives and syncs via Jazz

## Files Summary

| Action     | File                                                              |
| ---------- | ----------------------------------------------------------------- |
| **Create** | `src/lib/campaign-editor/` (copied + trimmed, ~20 files)          |
| **Create** | `src/lib/campaign-editor/adapters/magehand-ttrpg.ts`              |
| **Create** | `src/stores/campaignStore.ts`                                     |
| **Create** | `src/components/cards/CampaignEditorCard.tsx`                     |
| **Create** | `src/components/CampaignSceneRunner.tsx`                          |
| **Create** | `Plans/campaign-editor-integration.md`                            |
| **Modify** | `src/types/mapObjectTypes.ts` (deployment-zone category + fields) |
| **Modify** | `src/lib/mapObjectRenderer.ts` (render deployment zones)          |
| **Modify** | `src/types/cardTypes.ts` (CAMPAIGN_EDITOR)                        |
| **Modify** | `src/components/cards/MenuCard.tsx` (Campaign button)             |
| **Modify** | `src/components/CardManager.tsx` (render case)                    |
| **Modify** | `src/stores/cardStore.ts` (default config)                        |
| **Modify** | `src/lib/version.ts` (bump)                                       |

## Key Design Decisions

- **Deployment zones are regular MapObjects** — inherit undo/redo, persistence, sync, map scoping for free
- **No terrain painter** — Magehand uses image-based maps; encounter nodes reference maps by ID + deployment zones by ID
- **Validation lives in the campaign editor** — maps without deployment zones are valid for non-campaign use; the editor warns when an encounter node references a map with no zones
- **Zone-to-token matching** uses either a named token group or a role
- **GenericFlowCanvas reused as-is** — it's game-agnostic and renders the branching graph; all Magehand specifics live in the adapter and execution handler
