# Editable Character Sheet Plan

## Goal
Replace the read-only stat block on the Character tab with a fully editable character sheet that syncs bidirectionally with the JSON tab.

## Architecture
- **EditableCharacterSheet** (`src/components/EditableCharacterSheet.tsx`): Standalone editable form component
  - Accepts `DndBeyondCharacter` + `onChange` callback
  - Collapsible sections: Core Stats, Ability Scores, Saving Throws, Skills, Actions, Features, Spells, Conditions
  - All edits immediately call `onChange` with updated character object
- **CharacterSheetCard** integration:
  - Character tab: renders `EditableCharacterSheet` instead of read-only `StatBlockFromJson`
  - Edits on Character tab → serialized to JSON → reflected on JSON tab
  - Edits on JSON tab → parsed → reflected on Character tab
  - "Create Blank Character Sheet" button when no data exists (uses `generateBlankTemplate()`)
  - Single "Save Character" button persists to token's `statBlockJson`

## Data Flow
```
Character Tab (edit field)
  → handleCharacterChange(updatedChar)
    → JSON.stringify → setJsonValue
      → JSON tab reflects changes

JSON Tab (edit)
  → handleJsonChange(newJson)
    → parseAsCharacter(json)
      → Character tab reflects changes
```

## Editable Sections
| Section | Fields |
|---------|--------|
| Core Stats | name, level, race, class (multi-class string), background, AC, HP cur/max, speed, prof bonus |
| Ability Scores | 6 scores with auto-computed modifiers |
| Saving Throws | proficiency toggle + modifier per ability |
| Skills | proficiency toggle + modifier, 18 standard skills |
| Actions | name, to-hit, damage, type, range, description; add/remove |
| Features & Traits | name, source, description; add/remove |
| Spellcasting | ability, save DC, attack bonus, cantrips, spell levels with slots + prepared toggle |
| Conditions | badge list with enter-to-add |

## Status
- [x] EditableCharacterSheet component created
- [x] CharacterSheetCard integrated with bidirectional sync
- [ ] Future: wire actions to dice roller / effect system triggers
- [ ] Future: wire skills to skill check rolls
