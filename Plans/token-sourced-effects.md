# Token-Sourced Effect Placement

## Overview
When a token is selected before an effect template is chosen, the effect becomes "token-sourced":
- The selected token is automatically set as the caster
- Origin step is skipped (auto-locked to token position)
- A spell intent line (arcane-style) is drawn from caster to cursor
- For directional shapes (cone, line, rectangle): origin sits on the token's circular perimeter edge, and rotates around it as direction changes
- For burst shapes (circle-burst, rectangle-burst): origin centers on the token
- For circle shapes: placement follows cursor (free placement with intent line)
- Caster token is excluded from hit-testing unless `targetCaster` flag is true (default false)

## Type Changes
- `EffectTemplate`: Add `targetCaster?: boolean` (default false)
- `EffectPlacementState`: Add `casterToken?: { x, y, gridWidth, gridHeight }` snapshot for perimeter math

## Perimeter Math
- Token circular radius = `max(gridWidth, gridHeight) * gridSize / 2`
- For directional shapes, origin = token center + radius along direction vector
- Origin orbits the circular perimeter as direction changes

## Spell Intent Line (Arcane Style)
- Rendered in effectRenderer.ts during placement preview
- Animated dashes with glow effect using the template's color
- Drawn from token center to the effect origin/cursor

## Hit-Testing
- In `computeEffectImpacts`, skip caster token unless `template.targetCaster === true`

## Files Modified
- `src/types/effectTypes.ts` — targetCaster flag, casterToken in placement state
- `src/stores/effectStore.ts` — startPlacement accepts selected token data, auto-locks origin for token-sourced
- `src/lib/effectRenderer.ts` — spell intent line rendering, perimeter origin in preview
- `src/components/SimpleTabletop.tsx` — pass selected token to startPlacement, perimeter orbit in mousemove/click
- `src/lib/effectHitTesting.ts` — exclude caster unless targetCaster
- `src/components/cards/EffectsCard.tsx` — pass selectedTokenIds to startPlacement, add targetCaster toggle
