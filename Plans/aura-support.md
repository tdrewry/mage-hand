# Aura Support Plan

## Summary

Token-locked effects with wall-blocked continuous hit-testing and dynamic modifier apply/remove as tokens enter/leave the aura area.

## Architecture

### Types (`src/types/effectTypes.ts`)
- `AuraConfig` — `{ radius, affectSelf?, wallBlocked? }` on `EffectTemplate`
- `PlacedEffect` gains `anchorTokenId` and `isAura` fields

### Aura Engine (`src/lib/auraEngine.ts`)
- `computeAuraTargets()` — visibility polygon from aura center, capped at radius, checks each token center against the polygon
- `diffAuraTokens()` — compares previous/current token sets for enter/exit events
- `updateAura()` — full cycle: recompute targets, apply on-enter/remove on-exit modifiers
- `applyAuraStayEffects()` — on-stay modifiers applied per round via tickRound

### UI (`src/components/cards/EffectsCard.tsx`)
- Aura toggle on Shape tab with radius, affect-self, and wall-blocked switches
- Form data includes `isAura`, `auraRadius`, `auraAffectSelf`, `auraWallBlocked`

## How It Works

1. When an aura template is placed from a token, the effect is created with `isAura: true` and `anchorTokenId` set
2. Each frame (or on token movement), `updateAura()` is called:
   - Casts a visibility polygon from the anchor token's position, limited by aura radius
   - Tests each token center against the visibility polygon (wall-blocked)
   - Diffs against `tokensInsideArea` to detect enter/exit
   - Applies on-enter modifiers for newly entered tokens
   - Removes on-enter modifiers and applies on-exit modifiers for exited tokens
3. On round tick, `applyAuraStayEffects()` re-applies on-stay modifiers for tokens still inside

## Implementation Status

- [x] AuraConfig type defined
- [x] PlacedEffect extended with anchorTokenId/isAura
- [x] Aura engine with wall-blocked hit-testing
- [x] Dynamic modifier apply/remove on enter/exit
- [x] Aura UI in Shape tab
- [x] Form serialization (formToTemplateData / templateToForm)
- [x] Integration into SimpleTabletop render loop (continuous update call)
- [x] Aura visual rendering (visibility-clipped circle)
- [x] Built-in aura templates (Aura of Protection, Frightful Presence)
- [ ] Network sync for aura state
