# Effect Template System — Progress Summary

## Overview

The Effect Template system enables DMs to place animated spell effects and environmental hazards (firewalls, lightning, fireballs, traps) on the map. Effects perform hit-testing to identify impacted tokens and feed results into the Action Card for damage resolution. Traps auto-trigger when tokens move into persistent effect areas.

## Completed Phases

### Phase 1 — Types & Data Model ✅
- `src/types/effectTypes.ts`: Core types — `EffectTemplate`, `PlacedEffect`, `EffectImpact`, `EffectPlacementState`
- 6 shapes: circle, line, cone, rectangle, circle-burst, rectangle-burst
- 6 animations: none, flicker, crackle, pulse, expand, swirl
- Persistence: instant vs persistent (with optional round duration)
- `recurring` field: controls whether `triggeredTokenIds` reset each round (default: true)

### Phase 2 — Effect Template Library & Store ✅
- `src/lib/effectTemplateLibrary.ts`: Built-in templates (Fireball, Lightning Bolt, Cone of Cold, Wall of Fire, Spirit Guardians, Spike Growth, Cloudkill, Moonbeam, Web, Grease, Darkness, Silence, Stinking Cloud, Entangle, Blade Barrier)
- `src/stores/effectStore.ts`: Zustand store with template CRUD, placement mode, placed effects lifecycle, `tickRound`, `markTokenTriggered`, `resetTriggeredTokens`, `toggleRecurring`
- Custom templates persisted to localStorage

### Phase 3 — Canvas Renderer ✅
- `src/lib/effectRenderer.ts`: Draws placed effects with shape geometry, color/opacity, animated effects
- `renderPlacedEffects()`: Handles instant (600ms expand-then-fade) and persistent effects
- `renderPlacementPreview()`: Semi-transparent pulsing dashed outline during placement mode
- 5 procedural animation types with phase-offset hashing for visual variety

### Phase 4 — Placement UI ✅
- `src/components/cards/EffectsCard.tsx`: Full-featured Effects panel card
  - Template library grouped by category (Spells, Traps, Hazards, Custom)
  - Damage Dice input field (auto-rolls on hit)
  - Collapsible Create Template form with all fields including recurring/one-shot toggle
  - Inline Edit Template form for custom templates (pencil icon)
  - Active Effects list with recurring toggle, trigger count badge, reset button, delete
  - Placement status indicator with ESC-to-cancel
- Toolbar button (Sparkles icon) in `VerticalToolbar.tsx`
- Card registered in `cardStore.ts` and `CardManager.tsx`
- Canvas integration in `SimpleTabletop.tsx`: placement intercept, preview rendering, ESC handler, animation loop

### Phase 5 — Action Card Integration ✅
- `src/stores/actionStore.ts`: `startEffectAction()` converts `EffectImpact[]` to `ActionTarget[]`, auto-rolls damage, sets phase to `resolve`
- `src/types/actionTypes.ts`: Added `effect` category to `ActionCategory`, `effectInfo` field on `ActionQueueEntry`
- `SimpleTabletop.tsx`: On placement with token hits → auto-opens Action Card with pre-populated targets and damage rolls
- `damageFormula` flows from EffectsCard input → `EffectPlacementState` → placement handler → `startEffectAction`

### Phase 6 — Trap Trigger Detection ✅
- `SimpleTabletop.tsx`: `checkTrapTrigger(tokenId)` callback runs after every token drag-end (mouse + touch)
- Tests moved token's final position against all persistent effects on the same map
- On hit: auto-opens Action Card with single-token impact, calls `startEffectAction`
- Deduplication via `triggeredTokenIds` on `PlacedEffect` — same token won't re-trigger same effect

### Phase 7 — Recurring vs One-Shot ✅
- `EffectTemplate.recurring` field (default: true for persistent effects)
- `tickRound()` clears `triggeredTokenIds` only on recurring effects; one-shot effects retain state
- `toggleRecurring()` store action for toggling on active placed effects
- UI: Repeat/Ban icons in template rows and active effects, clickable toggle on active effects
- Create/Edit template forms include recurring/one-shot switch

### Phase 8 — Custom Template Editor ✅
- Create Template form: collapsible, all fields (name, shape, dimensions, color, opacity, animation, damage type, persistence, duration, recurring)
- Edit Template form: inline replacement of template row, pre-populated from existing template, Save/Cancel buttons
- Shared `TemplateFormFields` component eliminates duplication between create and edit

## Hit-Testing Engine
- `src/lib/effectHitTesting.ts`: SAT-based convex polygon overlap testing
- Supports all 6 shapes via polygon approximation (circles → 16-gon, cones → fan)
- Tests tokens and map objects, excludes caster from burst shapes
- Results sorted by distance, includes overlap percentage

## Current Version
`APP_VERSION = '0.5.74'`

## Potential Future Work
- **Visual feedback on trap trigger**: Flash the effect area or show toast when a token triggers a trap
- **Auto-populate damage from built-in templates**: Pre-fill the Damage Dice field when selecting a known spell (e.g. 8d6 for Fireball)
- **Texture support**: Allow custom textures/images on effect areas
- **Sound effects**: Play audio on placement or trigger
- **Networking sync**: Sync placed effects and triggers across multiplayer sessions via ephemeral bus
- **Save/load**: Include placed effects in project serialization
- **Concentration tracking**: Link persistent effects to a caster token; auto-remove when concentration breaks
