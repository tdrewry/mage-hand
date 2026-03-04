# Effect Linking by Name Plan

## Overview
When a character executes a spell/action from the Actions context menu, if its name matches a defined effect template (case-insensitive), the system automatically starts effect placement using the token as caster at the character's level.

## Logic Flow
1. User right-clicks token → Actions → Spells → e.g. "Fireball"
2. System checks `effectStore.allTemplates` for a name match (case-insensitive)
3. If matched:
   - Derive cast level: use character's level if available, otherwise template's `baseLevel`
   - Call `effectStore.startPlacement()` with token as caster
   - Toast confirms placement with level info
4. If no match: fall back to description toast

## Character Level Derivation
- Token must have an `entityRef` linking to a character in `creatureStore`
- `character.level` is used if available
- Falls back to `template.baseLevel` if no character level found

## Files Changed
- `src/components/TokenContextMenu.tsx` — unified click handler checks effect templates before falling back to toast
- `src/lib/version.ts` — bumped to 0.6.20
