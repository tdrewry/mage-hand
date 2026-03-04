

# Level-Scaled Effect Templates — Design Recommendation

## The Problem
Effects like Fireball, Cure Wounds, and Spiritual Weapon change their dice count, area size, or drop quantity based on the spell level they're cast at. Currently, templates are static — one configuration per template.

## Recommended Approach: Hybrid Scaling Rules + Level Overrides

Neither pure formula variables (Option 1) nor per-level tabs (Option 2) alone is ideal. A hybrid gives you **automatic math for the 90% case** and **explicit overrides for oddballs**.

### Core Concept

Each template gets:
- **`baseLevel`** — the lowest level it can be cast at (e.g., 3 for Fireball)
- **`scaling`** — an array of simple rules describing what changes per upcast level
- **`levelOverrides`** (optional) — explicit full overrides for specific levels, for effects that don't follow simple math (e.g., Chromatic Orb element choices, or spells that gain entirely new behaviors at certain levels)

### Data Model

```typescript
interface ScalingRule {
  property: 'damageDice' | 'radius' | 'width' | 'length' | 'multiDropCount';
  perLevel: number;        // added per level above baseLevel
  diceIndex?: number;      // which damageDice entry to scale (default 0)
}

interface LevelOverride {
  level: number;
  damageDice?: DamageDiceEntry[];  // full replacement
  radius?: number;
  width?: number;
  length?: number;
  multiDropCount?: number;
}

// Added to EffectTemplate:
baseLevel?: number;
scaling?: ScalingRule[];
levelOverrides?: LevelOverride[];
```

### How It Works at Cast Time

1. DM selects a template and picks a **cast level** (≥ baseLevel)
2. Engine computes effective values:
   - Start from template defaults
   - Apply each scaling rule: `value = base + (castLevel - baseLevel) * perLevel`
   - If a `levelOverride` exists for this exact level, its fields replace the computed ones
3. Roll damage using the computed dice, place effect with computed dimensions

### Examples

**Fireball** (simple scaling):
```
baseLevel: 3
damageDice: [{ formula: "8d6", damageType: "fire" }]
scaling: [{ property: "damageDice", perLevel: 1, diceIndex: 0 }]
```
→ At L5: formula becomes "10d6" (8 + 2×1 = 10 dice)

**Spiritual Weapon** (damage + no area change):
```
baseLevel: 2
damageDice: [{ formula: "1d8+3", damageType: "force" }]
scaling: [{ property: "damageDice", perLevel: 1, diceIndex: 0 }]  // +1d8 per 2 levels (we'd need "perLevels: 2" or just per-level override)
```

**Meteor Swarm** (no scaling, L9 only):
```
baseLevel: 9, no scaling rules
```

### UI Changes

1. **Template Editor**: Add a "Scaling" section below damage dice:
   - `Base Level` numeric input (already have spell level — repurpose it)
   - Scaling rules: small rows with dropdowns (property to scale) + numeric (per-level increment)
   - Optional "Level Overrides" collapsible section for explicit per-level configs

2. **Cast-Time Level Picker**: When placing an effect with `baseLevel` defined, show a small level selector (baseLevel through 9). The preview updates live to show computed values.

### Addressing the Chromatic Orb Case

Chromatic Orb doesn't change by *level* — it changes by *element choice*. That's better modeled as separate templates or a runtime "pick damage type" prompt at cast time. Level overrides could handle level-based changes (3d8 → 4d8 at L2), while element selection would be a future "variant" feature. This hybrid doesn't try to solve element-choice — it solves level-scaling cleanly.

### Technical Details

- **Dice formula scaling**: Parse the formula, extract the dice count from the first group, add `perLevel * delta`, reconstruct. Use existing `parseFormula` from `diceEngine.ts`.
- **Placement state**: Add `castLevel?: number` to `EffectPlacementState` — the resolved template snapshot already captures computed values.
- **Action store**: `startEffectAction` already receives `damageDice` — no changes needed there, just pass the computed dice.
- **Persistence**: Scaling rules stored on the template; cast level stored on `PlacedEffect` for history/display.

### Files to Change
- `src/types/effectTypes.ts` — add `ScalingRule`, `LevelOverride`, new fields on `EffectTemplate` and `PlacedEffect`
- `src/components/cards/EffectsCard.tsx` — scaling rules editor UI + level picker at cast time
- `src/lib/effectTemplateLibrary.ts` — add scaling rules to built-in templates (Fireball, etc.)
- `src/stores/effectStore.ts` — add `computeScaledTemplate(template, castLevel)` helper
- `src/components/SimpleTabletop.tsx` — integrate level picker into placement flow
- `src/lib/version.ts` — bump version
- `Plans/level-scaled-effects.md` — save plan

