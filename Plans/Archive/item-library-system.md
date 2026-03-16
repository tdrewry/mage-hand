# Item Library System

## Status: Phase 1 ✅ Complete | Phase 2 🔲 Planned

## Phase 1 — Library Foundation (Done)

### Data Model (`src/types/itemTypes.ts`)
- `LibraryItem` with flexible schema: name, category, rarity, description, weight, value
- D&D defaults: attacks (name, bonus, damage, type, range), spells (name, level, charges), traits (name, description)
- Charges system (maxCharges, rechargeRule)
- Attunement support (requiresAttunement, attunementRequirement)
- Freeform `customFields` for extensibility
- 15 item categories, 6 rarity tiers with labels and colors

### Store (`src/stores/itemStore.ts`)
- Zustand persist store with CRUD, search by name/description/category/source
- Filter by category and rarity
- No DO or ephemeral sync — items only travel with token associations

### UI (Items tab in Creature Library card)
- New "Items" tab alongside Characters and Monsters
- Create new items inline
- Import from JSON files (single item, array, or `{ items: [...] }`)
- Category and rarity filter dropdowns
- Inline editor with full field support: basic info, description, attacks, spells, traits, charges

### Persistence
- Items included in `.mhsession` ProjectData exports
- Hydrated on session load via `applyProjectData`
- `LibraryItem[]` field added to `ProjectData` interface

## Phase 2 — Token Inventory & Equipment (Planned)

### Token Inventory
- Add `inventory?: { itemId: string; quantity: number; equipped: boolean }[]` to Token type
- Inventory panel in Token card (add from library, equip/unequip, remove)
- Equipped items grant their attacks, spells, and traits to the token

### Treasure Node Integration
- "Add from Library" button in scenario node treasure editor
- Picker modal filtered by item library
- Auto-fills name, description, rarity from library entry

### Equipment Mechanics
- Equipped attacks appear in token's action menu
- Equipped spells appear in token's spell list
- Equipped traits shown as badges/tooltips
- Attunement slot tracking (max 3 per 5e rules)

## Files Modified (Phase 1)
- **Created**: `src/types/itemTypes.ts`, `src/stores/itemStore.ts`
- **Modified**: `src/components/cards/CreatureLibraryCard.tsx` (Items tab + ItemListEntry)
- **Modified**: `src/lib/projectSerializer.ts` (items field in ProjectData)
- **Modified**: `src/lib/sessionIO.ts` (create/apply items)
- **Modified**: `src/lib/version.ts` (0.7.203)
