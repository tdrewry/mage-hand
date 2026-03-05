# Extended Effect Impact System — Plan

## Summary

Extend the effect template system to support:
1. **Optional attack rolls** on effects (with modifier sourced from caster token's character data)
2. **Non-damage impact types** — modifiers to AC, ability scores, saves, attack bonus, HP, conditions, and granting temporary actions
3. **Tabbed template editor UI** — 7-tab layout: Shape, Dmg, Level, Mods, Conds, Grants, Duration
4. **Duration model overhaul** — EffectDurationType (instantaneous/timed/infinite), EffectTemplateMode (persistent/targeting-only)
5. **Cancel concept** — cancelling an effect reverts all non-damage impacts from targets
6. **Trigger timing** — on-enter/on-exit/on-stay for modifiers and conditions

## Tab Structure (v0.6.36)

```text
[Name input]
[Category selector]  ← outside tabs
┌───────┬─────┬───────┬──────┬───────┬────────┬─────┐
│ Shape │ Dmg │ Level │ Mods │ Conds │ Grants │ Dur │
└───────┴─────┴───────┴──────┴───────┴────────┴─────┘
```

| Tab | Contents |
|-----|----------|
| **Shape** | Shape type, dimensions, color, texture/image, opacity, animation, quantity (multi-drop), placement toggles |
| **Dmg** | Damage dice rows, attack roll toggle + config |
| **Level** | Spell level, base level, scaling rules, level overrides |
| **Mods** | Modifier rows (target property + operation + value + timing) |
| **Conds** | D&D 5e condition checkboxes with apply/remove and timing |
| **Grants** | Granted actions with type field (attack/spell/trait/feature) |
| **Dur** | Duration type (instantaneous/timed/infinite), template mode, recurring toggle |

## Implementation Status

- [x] Types defined (effectTypes.ts)
- [x] 7-tab editor UI (EffectsCard.tsx)
- [x] Category moved outside tabs
- [x] Quantity moved to Shape tab
- [x] Level/scaling extracted to own tab
- [x] Granted actions extracted to own tab with type dropdown
- [x] Texture field added to Shape tab
- [x] Duration tab with durationType/templateMode/recurring
- [x] Modifier engine created with timing support
- [x] Attack roll wired into action flow
- [x] Example templates added
- [x] Trigger timing (on-enter/on-exit/on-stay) on modifiers and conditions
- [x] EffectDurationType (instantaneous/timed/infinite)
- [x] EffectTemplateMode (persistent/targeting-only)
- [x] cancelEffect in effectStore — reverts non-damage impacts
- [x] cancelEffectModifiers in engine — bulk revert all timings
- [x] tokensInsideArea tracking on PlacedEffect for on-exit detection
- [x] Version bumped to 0.6.36
