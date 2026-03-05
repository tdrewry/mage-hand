# Extended Effect Impact System — Plan

## Summary

Extend the effect template system to support:
1. **Optional attack rolls** on effects (with modifier sourced from caster token's character data)
2. **Non-damage impact types** — modifiers to AC, ability scores, saves, attack bonus, HP, conditions, and granting temporary actions
3. **Tabbed template editor UI** — 7-tab layout: Shape, Dmg, Level, Mods, Conds, Grants, Duration

## Tab Structure (v0.6.35)

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
| **Mods** | Modifier rows (target property + operation + value) |
| **Conds** | D&D 5e condition checkboxes |
| **Grants** | Granted actions with type field (attack/spell/trait/feature) |
| **Dur** | Persistence type (instant/persistent), duration rounds, recurring toggle |

## Implementation Status

- [x] Types defined (effectTypes.ts)
- [x] 7-tab editor UI (EffectsCard.tsx)
- [x] Category moved outside tabs
- [x] Quantity moved to Shape tab
- [x] Level/scaling extracted to own tab
- [x] Granted actions extracted to own tab with type dropdown
- [x] Texture field added to Shape tab
- [x] Duration tab with persistence/rounds/recurring
- [x] Modifier engine created
- [x] Attack roll wired into action flow
- [x] Example templates added
- [x] Version bumped to 0.6.35
