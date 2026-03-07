# DM Fog Rendering — v0.7.103

## Problem
DM mode never rendered fog of war — only play mode did. Maps with fog enabled showed fog correctly for players but not for the DM.

## Solution
1. **DM Unexplored Darkness** (`dmFogOpacity`) — new per-map setting (default 0.3) controlling how dark unexplored areas appear to the DM. Lower = DM sees more through fog.
2. **Fog renders in all modes** — removed `isPlayMode` gate from fog rendering. Both play and DM modes render fog; play mode uses `fogOpacity`, DM mode uses `dmFogOpacity`.
3. **Safety black only in play mode** — the "masks not computed yet → full black" safety overlay only applies in play mode. DM should never be fully blacked out.

## Files Modified
- `src/stores/fogStore.ts` — added `dmFogOpacity` to `MapFogSettings` interface + migration
- `src/stores/defaultFogEffectSettings.ts` — added `dmFogOpacity: 0.3` default
- `src/components/cards/FogControlCard.tsx` — added DM Unexplored Darkness slider
- `src/components/SimpleTabletop.tsx` — fog renders in DM mode with `dmFogOpacity`; post-processing enabled for all modes
- `src/lib/version.ts` — bumped to 0.7.103
