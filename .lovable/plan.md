

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

```typescript
// Attack roll config on an effect template
interface EffectAttackRoll {
  enabled: boolean;
  /** Which ability mod to use: 'spellcasting' | 'str' | 'dex' | ... */
  abilitySource: string;
  /** Fixed bonus override (if not using token's data) */
  fixedBonus?: number;
  /** Whether to add proficiency bonus */
  addProficiency?: boolean;
}

// A single modifier applied to a target
interface EffectModifier {
  id: string;
  /** The character property path to modify */
  target: EffectModifierTarget;
  /** How to apply: 'add' | 'set' | 'multiply' */
  operation: 'add' | 'set' | 'multiply';
  /** The value (numeric for stats, string for conditions) */
  value: number;
  /** Human-readable label */
  label?: string;
}

type EffectModifierTarget =
  | 'armorClass'
  | 'speed'
  | 'hitPoints.temp'
  | 'abilities.strength.score'
  | 'abilities.dexterity.score'
  | 'abilities.constitution.score'
  | 'abilities.intelligence.score'
  | 'abilities.wisdom.score'
  | 'abilities.charisma.score'
  | 'proficiencyBonus'
  | 'initiative'
  | string; // extensible for save mods, skill mods, etc.

// Conditions to apply/remove
interface EffectCondition {
  condition: string; // 'blinded' | 'charmed' | 'frightened' | etc.
  apply: boolean;    // true = add condition, false = remove
}

// Temporary action grant
interface EffectGrantedAction {
  name: string;
  attackBonus?: number;
  damageFormula?: string;
  damageType?: string;
  description?: string;
}
```

Add to `EffectTemplate`:
```typescript
attackRoll?: EffectAttackRoll;
modifiers?: EffectModifier[];
conditions?: EffectCondition[];
grantedActions?: EffectGrantedAction[];
```

The `EffectModifierTarget` list will be derived by introspecting the `DndBeyondCharacter` interface keys — the UI will present a dropdown of known character properties.

### 2. Attack Roll Integration (actionStore.ts)

- When `startEffectAction` is called and the template has `attackRoll.enabled`, the action enters the standard `resolve` phase with attack rolls
- The attack bonus is resolved at cast time: look up the caster token's linked character data, extract the relevant ability modifier + proficiency if configured, OR use `fixedBonus`
- The resolved `attackBonus` is passed into the `effectInfo` on the `ActionQueueEntry`

### 3. Modifier Application (new: src/lib/effectModifierEngine.ts)

- `applyEffectModifiers(tokenId, modifiers, conditions)` — applies stat changes to the token's character data snapshot
- `removeEffectModifiers(tokenId, effectId)` — reverts when effect is dismissed/expires
- Modifiers are tracked per-effect so they can be cleanly removed
- For persistent effects: modifiers apply on placement and revert on dismissal
- For instant effects: modifiers apply and persist until manually removed or duration expires

### 4. Tabbed Template Editor UI (EffectsCard.tsx)

Replace the flat form with tabs using existing `Tabs` component:

```text
┌─────────┬────────┬───────────┬────────────┐
│  Shape  │ Damage │ Modifiers │ Conditions │
├─────────┴────────┴───────────┴────────────┤
│                                           │
│  (tab content area)                       │
│                                           │
└───────────────────────────────────────────┘
```

- **Shape tab**: Name, shape type, dimensions, placement options, color/animation, persistence, level scaling (existing fields reorganized)
- **Damage tab**: Damage dice rows, attack roll toggle + config, spell level, quantity/multi-drop
- **Modifiers tab**: Add/remove rows — each row is a dropdown (target property) + operation + value. The dropdown options are generated from the `DndBeyondCharacter` interface fields
- **Conditions tab**: Checklist of D&D 5e conditions to apply/remove, plus granted temporary actions

### 5. Files Changed

| File | Change |
|------|--------|
| `src/types/effectTypes.ts` | Add `EffectAttackRoll`, `EffectModifier`, `EffectCondition`, `EffectGrantedAction` types; extend `EffectTemplate` |
| `src/components/cards/EffectsCard.tsx` | Refactor form into tabbed layout; add Modifiers and Conditions tab UIs |
| `src/lib/effectModifierEngine.ts` | **New** — apply/revert modifier logic |
| `src/stores/actionStore.ts` | Extend `startEffectAction` to support attack roll resolution from caster data |
| `src/stores/effectStore.ts` | Wire modifier application on place/dismiss |
| `src/lib/effectTemplateLibrary.ts` | Add example templates using modifiers (e.g., Shield of Faith: +2 AC, Haste: +2 AC + double speed) |
| `src/lib/version.ts` | Bump to `0.6.33` |
| `Plans/extended-effect-impacts.md` | Save this plan |

### 6. Implementation Order

1. Define new types in `effectTypes.ts`
2. Add `EffectAttackRoll` fields to `TemplateFormData` and wire into template save/load
3. Refactor EffectsCard form into tabbed layout (Shape + Damage tabs first, just reorganizing)
4. Add Modifiers tab UI with property dropdown + operation + value rows
5. Add Conditions tab UI with condition checkboxes + granted actions
6. Create `effectModifierEngine.ts` for apply/revert logic
7. Wire attack roll into actionStore's effect action flow
8. Add example built-in templates with modifiers
9. Bump version

