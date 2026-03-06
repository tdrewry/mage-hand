

# UX Restructure: Effect Template Editor Tabs & Fields

## Changes Requested

1. **Move Category (type) outside tabs** — below Template Name, above the tab bar
2. **Move Quantity to Shape tab** (from Damage tab)
3. **Level & Scaling fields become their own tab** (extracted from Damage tab)
4. **Granted Actions become their own tab** (extracted from Conditions tab)
5. **Support texture/image on templates** — add optional texture field to Shape tab alongside color
6. **Add Duration tab** — persistence, rounds, recurring extracted from Shape tab

## New Tab Structure

```text
[Name input]
[Category selector]  ← moved outside tabs
┌───────┬────────┬───────┬──────────┬──────────┬───────────┬──────────┐
│ Shape │ Damage │ Level │ Mods     │ Conds    │ Grants    │ Duration │
└───────┴────────┴───────┴──────────┴──────────┴───────────┴──────────┘
```

## Field Redistribution

| Tab | Contents |
|-----|----------|
| **Shape** | Shape type, dimensions, color, texture/image, opacity, animation, quantity (multi-drop), placement toggles (align, caster, ranged, skip rotation) |
| **Damage** | Damage dice rows, attack roll toggle + config |
| **Level** | Spell level, base level, scaling rules, level overrides |
| **Mods** | Modifier rows (target property + operation + value) |
| **Conds** | D&D 5e condition checkboxes |
| **Grants** | Granted actions with type field (attack/spell/trait/feature) |
| **Duration** | Persistence type (instant/persistent), duration rounds, recurring toggle |

## Files Changed

| File | Change |
|------|--------|
| `src/components/cards/EffectsCard.tsx` | Restructure tabs: add `level`, `grants`, `duration` tabs; move category above tabs; move quantity to Shape; move level/scaling out of Damage; split granted actions from Conditions; add texture input to Shape tab |
| `src/types/effectTypes.ts` | Add `texture?: string` to `EffectTemplate` (already exists — just ensure form wires it) |
| `src/lib/version.ts` | Bump to `0.6.35` |
| `Plans/extended-effect-impacts.md` | Update with tab restructure |

## Implementation Details

- `FormTab` union becomes: `'shape' | 'damage' | 'level' | 'modifiers' | 'conditions' | 'grants' | 'duration'`
- `FORM_TABS` array updated with 7 entries (short labels to fit: Shape, Dmg, Level, Mods, Conds, Grants, Dur)
- Category selector rendered between Name input and tab bar in `TemplateFormFields`
- Texture field on Shape tab: text input for data URL / asset key (reuses existing `texture` property on `EffectTemplate`)
- Granted actions get a `type` dropdown per row: attack, spell, trait, feature
- Badge counts updated: Level tab shows scaling rule count, Grants tab shows action count, Duration tab shows no badge

