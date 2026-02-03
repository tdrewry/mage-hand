
# D&D Beyond Character Import (Client-Side)

## Overview

Since external scraping services are not available, this implementation provides a **client-side character import system** with multiple import methods:

1. **D&D Beyond JSON Export** - Users can export their character JSON directly from D&D Beyond
2. **Manual Character Entry** - Form-based entry for character stats
3. **Quick Character Template** - Pre-filled templates for common builds

---

## Architecture

```text
+-----------------------------------+
|     ImportCharacterModal.tsx      |
|-----------------------------------|
| [Tabs]                            |
|   > JSON Import                   |
|   > Manual Entry                  |
|   > Quick Template                |
|-----------------------------------|
| JSON Import:                      |
|   [Paste JSON or upload file]     |
|   [Import Character]              |
|-----------------------------------|
| Manual Entry:                     |
|   Name: [___________]             |
|   Race: [___________]             |
|   Class: [Select ▾] Level: [__]   |
|   ...ability scores...            |
|   [Create Character]              |
+-----------------------------------+
```

---

## Implementation Details

### 1. New Component: ImportCharacterModal

**Location**: `src/components/modals/ImportCharacterModal.tsx`

**Features**:
- **JSON Import Tab**: 
  - Textarea for pasting D&D Beyond character JSON
  - File upload button for `.json` files
  - Parses the D&D Beyond character builder export format
  - Maps fields to our `DndBeyondCharacter` type

- **Manual Entry Tab**:
  - Form fields for: Name, Race, Class(es), Level, Background
  - Six ability score inputs with auto-calculated modifiers
  - AC, HP, Speed, Initiative fields
  - Proficiency bonus auto-calculated from level

- **Quick Template Tab** (optional enhancement):
  - Pre-built common character templates (Fighter, Wizard, Rogue, Cleric)
  - One-click import with default stats for quick placeholder tokens

### 2. D&D Beyond JSON Parser

**Location**: `src/lib/dndBeyondParser.ts` (extend existing)

**New Function**: `parseDndBeyondExport(json: object): DndBeyondCharacter`

D&D Beyond's character export JSON has a specific structure:
- `name`, `race.fullName`, `classes[].definition.name` with levels
- `stats[].value` for ability scores (array of 6, ordered STR→CHA)
- `baseHitPoints`, `bonusHitPoints` for HP calculation
- `overrideArmorClass` or calculated from equipment

### 3. Wire Up to Creature Library Card

Update `handleImportCharacter` in `CreatureLibraryCard.tsx` to open the new modal.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/modals/ImportCharacterModal.tsx` | Create | New modal with JSON import + manual entry tabs |
| `src/lib/dndBeyondParser.ts` | Extend | Add `parseDndBeyondExport()` for official JSON format |
| `src/components/cards/CreatureLibraryCard.tsx` | Modify | Wire up modal open, add state management |

---

## User Experience

### Importing via D&D Beyond JSON Export

1. On D&D Beyond, go to your character sheet
2. Click the "Export" button (found in character options)
3. Save the `.json` file
4. In the VTT, open Creature Library → Characters tab
5. Click "Import from D&D Beyond"
6. Either paste the JSON or upload the file
7. Click "Import Character"
8. Character appears in the library with full stats

### Creating a Manual Character

1. Open Creature Library → Characters tab
2. Click "Import from D&D Beyond"
3. Switch to "Manual Entry" tab
4. Fill in character name, race, class, level
5. Enter ability scores (modifiers auto-calculate)
6. Add AC, HP, Speed
7. Click "Create Character"
8. Character is added to the library

---

## Technical Notes

### D&D Beyond Export JSON Structure

The official D&D Beyond character JSON export includes:
```json
{
  "id": 12345678,
  "name": "Tordek Stonehammer",
  "race": { "fullName": "Hill Dwarf", ... },
  "classes": [
    { "definition": { "name": "Fighter" }, "level": 5 }
  ],
  "stats": [
    { "id": 1, "value": 16 },  // STR
    { "id": 2, "value": 14 },  // DEX
    ...
  ],
  "baseHitPoints": 44,
  "decorations": { "avatarUrl": "https://..." }
}
```

### Validation

- Character name is required
- At least one class with level ≥ 1
- Ability scores between 1-30
- AC, HP, Speed must be positive numbers

### Edge Cases

- **Invalid JSON**: Show error toast, don't close modal
- **Missing fields**: Fill with sensible defaults (level 1, 10 for abilities)
- **Duplicate character**: Update existing if same D&D Beyond ID
