# Extended Effect Impact System — Plan

## Summary

Extend the effect template system to support:
1. **Optional attack rolls** on effects (with modifier sourced from caster token's character data)
2. **Non-damage impact types** — modifiers to AC, ability scores, saves, attack bonus, HP, conditions, and granting temporary actions
3. **Tabbed template editor UI** — organize the growing form into tabs: Shape, Damage, Modifiers, Conditions

## Current State

- `EffectTemplate` has `damageDice`, `damageType`, and scaling but no attack roll or non-damage impacts
- `ActionQueueEntry` supports attack rolls for weapon attacks but not for effect-based actions
- Character data lives in `DndBeyondCharacter` (src/types/creatureTypes.ts) with well-structured fields for abilities, AC, saves, skills, HP, actions, conditions
- The EffectsCard template form is a flat vertical layout (~200 lines of form fields)

## Technical Design

### 1. New Types (src/types/effectTypes.ts)

- `EffectAttackRoll` — optional attack roll config on templates
- `EffectModifier` — stat modifier rows (target property path + operation + value)
- `EffectCondition` — conditions to apply/remove
- `EffectGrantedAction` — temporary action grants

### 2. Attack Roll Integration (actionStore.ts)

- When `startEffectAction` is called and the template has `attackRoll.enabled`, rolls attack per target
- Attack bonus resolved from caster token's character data or fixed bonus

### 3. Modifier Application (effectModifierEngine.ts)

- `applyEffectModifiers` / `removeEffectModifiers` for stat changes
- Tracked per-effect for clean revert

### 4. Tabbed Template Editor UI (EffectsCard.tsx)

- Shape tab: name, shape type, dimensions, placement options, color/animation, persistence
- Damage tab: damage dice rows, attack roll toggle + config, spell level, quantity/multi-drop, level scaling
- Modifiers tab: add/remove rows with property dropdown + operation + value
- Conditions tab: condition checkboxes + granted temporary actions

### 5. Files Changed

| File | Change |
|------|--------|
| `src/types/effectTypes.ts` | Add new types; extend `EffectTemplate` |
| `src/components/cards/EffectsCard.tsx` | Refactor form into tabbed layout |
| `src/lib/effectModifierEngine.ts` | New — apply/revert modifier logic |
| `src/stores/actionStore.ts` | Extend `startEffectAction` for attack rolls |
| `src/lib/effectTemplateLibrary.ts` | Add Shield of Faith, Haste templates |
| `src/lib/version.ts` | Bump to `0.6.33` |

## Implementation Status

- [x] Types defined
- [x] Tabbed editor UI
- [x] Modifier engine created
- [x] Attack roll wired into action flow
- [x] Example templates added
- [x] Version bumped
