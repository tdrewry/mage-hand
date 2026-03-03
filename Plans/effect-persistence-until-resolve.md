# Effect Persistence Until Action Resolution

## Changes Made (v0.5.81)

### Problem
Instant effects (e.g., Fireball) were auto-fading after 600ms via an expand-then-fade animation in the renderer. This left behind visual artifacts (a smaller residual circle) and didn't match the desired game flow where effects should remain visible until the DM resolves them.

### Correct Behavior
Effects should:
1. Place on the canvas
2. Orient (two-step placement)
3. Remain visible until one of:
   - The action is **resolved** (committed) in the Action Card
   - The action is **cancelled** in the Action Card
   - The effect is manually **dismissed**
   - Duration expires (persistent effects with `roundsRemaining`)

### Changes

#### `src/lib/effectRenderer.ts`
- Removed `onExpireInstant` callback from `renderPlacedEffects`
- Removed `instantProgress`/`isInstant` parameters from `renderEffect`
- Removed the 600ms expand-then-fade animation for instant effects
- All effects now render identically using their configured animation type

#### `src/stores/actionStore.ts`
- `commitAction()`: Now removes the placed effect (via `useEffectStore.removeEffect`) when committing an instant effect action
- `cancelAction()`: Same cleanup — removes the placed instant effect when cancelling

#### `src/components/SimpleTabletop.tsx`
- Removed the `onExpireInstant` callback from the `renderPlacedEffects` call

## Files Modified
- `src/lib/effectRenderer.ts`
- `src/stores/actionStore.ts`
- `src/components/SimpleTabletop.tsx`
- `src/lib/version.ts`
