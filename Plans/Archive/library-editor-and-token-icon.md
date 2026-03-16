# Library Editor & Token Icon Plan

## Goal
Add JSON-backed editors for characters and monsters created from the Library, plus a `tokenIconUrl` field on all entity types (characters, monsters, items) for default token artwork.

## Changes

### 1. Type Updates
- Add `tokenIconUrl?: string` to `DndBeyondCharacter`, `Monster5eTools`, and `LibraryItem`

### 2. New Card: `LIBRARY_EDITOR`
- `src/components/cards/LibraryEditorCard.tsx` — Unified editor for characters and monsters from the Library
  - **Character mode**: JSON tab + EditableCharacterSheet form tab + token icon section
  - **Monster mode**: JSON tab + read-only StatBlock preview + token icon section  
  - Saves directly to `creatureStore` (not token-based like CharacterSheetCard)
  - Token Icon: URL input + preview thumbnail, persisted as `tokenIconUrl` on the entity

### 3. Wiring
- `CardType.LIBRARY_EDITOR` added to `cardTypes.ts`
- `CardManager` renders `LibraryEditorCardContent`
- `CreatureLibraryCard` opens `LIBRARY_EDITOR` instead of `CHARACTER_SHEET`/`MONSTER_STAT_BLOCK`

### 4. Token Creation
- `handleCreateCharacterToken` uses `character.tokenIconUrl ?? character.portraitUrl`
- `handleCreateMonsterToken` uses `monster.tokenIconUrl ?? monster.tokenUrl`
- Items: future pass (placeable item tokens)

## Data Flow
```
Library → click character/monster → opens LibraryEditorCard
  → JSON tab: Monaco editor ↔ entity JSON
  → Form tab: EditableCharacterSheet (char) or StatBlock (monster)
  → Token Icon: URL input saved as tokenIconUrl
  → Save → creatureStore.updateCharacter/updateMonster
```

## Status
- [x] Plan created
- [ ] Implementation
