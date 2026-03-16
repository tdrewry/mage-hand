# Effect Placement Refinement Plan

## Changes Made (v0.5.76)

### 1. Two-Step Placement Flow
- **Step 1 (Origin)**: Click to set the effect's point of origin. Preview follows cursor.
- **Step 2 (Direction)**: Click to set the target/direction point. Effect orients along the line from origin → target. A crosshair + circle marker is drawn at the locked origin during this step.
- Added `EffectPlacementStep` type (`'origin' | 'direction'`) and `origin` field to `EffectPlacementState`.
- Store gains `setPlacementOrigin()` method to transition from step 1 → step 2.

### 2. Align-to-Grid Option
- New `alignToGrid?: boolean` field on `EffectTemplate`.
- When enabled, effect rotation snaps to the nearest 45° increment.
- Added toggle in the template creation/edit form ("Align to grid (45° snap)").

### 3. Bug Fix: Canvas-Covering Effects (Fireball)
- **Root cause**: `placedAt` used `Date.now()` (~1.7 trillion ms) but the render loop passed `performance.now()` (~few thousand ms) as `rc.time`. The `age` calculation (`rc.time - effect.placedAt`) produced a massive negative number, causing the instant expand animation's scale factor to go haywire and cover the entire canvas.
- **Fix**: Changed `placedAt` to use `performance.now()` to match the render timer.

## Files Modified
- `src/types/effectTypes.ts` — Added `alignToGrid`, `EffectPlacementStep`, updated `EffectPlacementState`
- `src/stores/effectStore.ts` — Added `setPlacementOrigin`, fixed `placedAt` timer
- `src/lib/effectRenderer.ts` — Updated preview to show origin crosshair in direction step
- `src/components/SimpleTabletop.tsx` — Two-step click logic, grid-snap direction
- `src/components/cards/EffectsCard.tsx` — Added `alignToGrid` toggle to form
