# Effect Template Enhancements Plan

## Changes (v0.6.3)

### 1. Edit/Delete on All Templates (Including Built-ins)
- Removed `isBuiltIn` guard from edit/delete buttons
- Editing a built-in clones it as a custom override (same ID)
- Deleting a built-in adds it to a `hiddenBuiltInIds` list persisted in localStorage
- "Restore hidden templates" button appears when built-ins are hidden

### 2. Collapsible Category Sections
- Each category (Spells, Traps, Hazards, Custom) is now collapsible
- Click the category header to toggle visibility
- State is local (not persisted)

### 3. Multi-Row Damage Dice (`damageDice` field)
- Added `DamageDiceEntry` type: `{ formula: string; damageType: string }`
- Added `damageDice?: DamageDiceEntry[]` to `EffectTemplate`
- Template form has dynamic add/remove rows for damage dice
- Built-in templates now include default damage dice (e.g., Fireball: 8d6 fire)
- Added Flame Strike template: 4d6 fire + 4d6 radiant (multi-damage example)
- Meteor Swarm updated: 20d6 fire + 20d6 bludgeoning

### 4. Quantity Input for Multi-Drop
- Added `multiDropCount` field to template form
- When count > 1, creates `multiDrop: { count: N }` on the template
- Allows creating new multi-targeting effects without code changes

### 5. Template Row Display
- Damage dice now shown inline on template rows (formula + type per entry)
- Built-in badge removed; all templates show edit/delete on hover
