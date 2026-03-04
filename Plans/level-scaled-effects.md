# Level-Scaled Effect Templates Plan

## Overview
Effects like Fireball scale damage/size/quantity based on cast level. This implements a hybrid system: automatic scaling rules for the common case + explicit level overrides for edge cases.

## Data Model
- `ScalingRule`: `{ property, perLevel, diceIndex? }` — linear increment per upcast level
- `LevelOverride`: `{ level, damageDice?, radius?, width?, length?, multiDropCount? }` — full replacement at specific level
- `EffectTemplate` gains: `baseLevel?`, `scaling?`, `levelOverrides?`
- `PlacedEffect` gains: `castLevel?`
- `EffectPlacementState` gains: `castLevel?`

## Compute Logic
`computeScaledTemplate(template, castLevel)`:
1. Start from template defaults
2. Apply each scaling rule: `value = base + (castLevel - baseLevel) * perLevel`
3. For damageDice scaling: parse formula, increment dice count, reconstruct
4. If a levelOverride exists for the exact castLevel, its fields replace computed ones
5. Return a new template snapshot with computed values

## UI
- Template editor: "Scaling" collapsible section with scaling rules rows
- Template editor: "Level Overrides" sub-section with per-level cards (dice, radius, width, length, qty)
- Template row: shows scaling indicator badge when template has scaling/overrides
- Placement status: cast level picker (baseLevel through 9) when placing a scalable template
- Live preview of computed dice in placement status

## Built-in Templates Updated
- Fireball: baseLevel 3, +1d6 fire per level
- Lightning Bolt: baseLevel 3, +1d6 lightning per level
- Cone of Cold: baseLevel 5, +1d8 cold per level
- Burning Hands: baseLevel 1, +1d6 fire per level
- Spirit Guardians: baseLevel 3, +1d8 radiant per level
- Thunderwave: baseLevel 1, +1d8 thunder per level
- Flame Strike: baseLevel 5, +1d6 fire + +1d6 radiant per level

## Files Changed
- `src/types/effectTypes.ts`
- `src/stores/effectStore.ts`
- `src/lib/effectTemplateLibrary.ts`
- `src/components/cards/EffectsCard.tsx`
- `src/lib/version.ts`
