# Card Save Button & Token Sync Plan

## Goal
Create a reusable `CardSaveButton` component that fires a `card:save` DOM event with entity context, enabling network sync whenever card content is saved.

## Architecture
- **`CardSaveButton`** (`src/components/cards/CardSaveButton.tsx`): Reusable button that:
  1. Calls a local `onSave` handler
  2. Dispatches a `CardSaveEvent` with `{ type, id }` context
- **`cardSaveSync`** (`src/lib/net/cardSaveSync.ts`): Listener that maps `card:save` events to durable `EngineOp`s via OpBridge
- **`token.update`** op kind: New durable op in OpBridge that syncs full token state to peers

## Supported Context Types
| Type | Op Kind | Status |
|------|---------|--------|
| `token` | `token.update` | ✅ Done |
| `region` | TBD | Planned |
| `map-object` | TBD | Planned |
| `effect` | TBD | Planned |
| `session` | TBD | Planned |

## Integration Points
- **Edit Token modal** (`TokenContextMenu.tsx`): Fires `CardSaveEvent` after `applyTokenEdit()`
- **Character Sheet card** (`CharacterSheetCard.tsx`): Unified single "Save Changes" button replaces 3 separate save buttons
- Future: Region settings, texture cards, etc.

## Status
- [x] CardSaveButton component created
- [x] cardSaveSync listener wired in net barrel
- [x] token.update OpBridge handler (receive side)
- [x] CharacterSheetCard unified save
- [x] Edit Token modal fires sync event
- [ ] Future: region/map-object/effect context handlers
