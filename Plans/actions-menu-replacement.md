# Actions Menu Replacement Plan

## Goal
Replace the context menu "Attack" submenu with a comprehensive "Actions" menu that presents all available actions a character can take.

## Architecture

### TokenActionItem (new unified type in attackParser.ts)
Categories: `attack` | `spell` | `skill` | `trait` | `bonus` | `reaction` | `legendary`

Each item carries:
- name, description, category
- For attacks: attackBonus, damageFormula, damageType, range, asAttack (for action system compat)
- For spells: spellLevel, prepared status
- For skills: modifier, proficiency
- For traits: description text

### collectAllActions(json) → TokenActionItem[]
Unified parser that extracts everything from either Monster5eTools or DndBeyondCharacter data.

### Context Menu Structure
```
Actions →
  Attacks (N) →        [Swords icon]    Triggers action targeting system
  Spells (N) →         [Sparkles icon]  Shows level + prepared status
  Bonus Actions (N) →  [Zap icon]       Toast description
  Reactions (N) →      [RotateCw icon]  Toast description
  Legendary (N) →      [Star icon]      Toast description
  Skills (N) →         [Dices icon]     Shows modifier + proficiency
  Traits (N) →         [BookOpen icon]  Toast description
```

### Behavior on Click
- **Attacks**: Start targeting via action system (existing flow)
- **Skills**: Toast with roll formula (stub for future dice integration)
- **Spells/Traits/Other**: Toast with description (stub for future effect/dice integration)

## Files Changed
- `src/lib/attackParser.ts` — expanded with TokenActionItem type + collectAllActions
- `src/components/TokenContextMenu.tsx` — replaced Attack submenu with Actions submenu
- Legacy `parseAttacksFromJson` preserved for backward compatibility

## Future
- [ ] Wire skill clicks to dice roller
- [ ] Wire spell clicks to effect placement system
- [ ] Wire trait clicks to condition/buff application
