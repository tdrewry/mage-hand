# Effect Assignment to Spell Definitions

## Overview
Spells (cantrips and leveled) and actions can now have an explicitly assigned `effectTemplateId` that links them to a defined effect template. When triggered from the Actions menu, the assigned template takes priority over name-based matching.

## Data Model Changes
- `DndBeyondCharacter.spells.cantrips[]` gains `effectTemplateId?: string`
- `DndBeyondCharacter.spells.spellsByLevel[].spells[]` gains `effectTemplateId?: string`
- `DndBeyondCharacter.actions[]` gains `effectTemplateId?: string`
- `TokenActionItem` gains `effectTemplateId?: string`

## UI
- Each spell/cantrip row in the editable character sheet has a link icon button
- Clicking it opens a dropdown of all available effect templates
- Linked templates show the icon in primary color; unlinked show muted
- Tooltip shows the linked template name

## Resolution Priority
1. Explicit `effectTemplateId` on the action item → used directly
2. Name-based case-insensitive match against effect templates → fallback
3. No match → description toast

## Files Changed
- `src/types/creatureTypes.ts` — added effectTemplateId fields
- `src/lib/attackParser.ts` — propagates effectTemplateId to TokenActionItem
- `src/components/EditableCharacterSheet.tsx` — EffectTemplatePicker component
- `src/components/TokenContextMenu.tsx` — prefers effectTemplateId over name match
- `src/lib/version.ts` — 0.6.21
