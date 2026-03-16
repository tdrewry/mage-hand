# Jazz Entity Sync Fix — Regions, MapObjects, Effects

## Problem
Clients joining a Jazz session only received tokens and fog/blob data. Regions, map objects, and effects were NOT synced because:

1. **Missing `resolve` options**: `joinJazzSession()` only resolved `tokens`, `maps`, `blobs`, `textures` — leaving `regions`, `mapObjects`, and `effects` as unloaded lazy CoValue refs
2. **Missing inbound effect subscription**: The bridge had outbound effect sync (Zustand → Jazz) but no inbound (Jazz → Zustand) subscription for placed effects or custom templates

## Fix (v0.7.89)

### session.ts
- Added `regions: { $each: true }`, `mapObjects: { $each: true }`, `effects: { placedEffects: { $each: true }, customTemplates: { $each: true } }` to the `resolve` option in both initial load and retry load
- Added regions/mapObjects to diagnostic logging and `hasData` check

### bridge.ts
- Added **Jazz → Zustand** placed effects subscription (reconstructs templates via `buildTemplateLookup`)
- Added **Jazz → Zustand** custom templates subscription (upsert + removal for non-creators)
- Added **Zustand → Jazz** custom templates outbound subscription (was only pushing placed effects, not template edits)

## Status
- [x] Resolve options fixed for initial join
- [x] Resolve options fixed for retry pull
- [x] Inbound placed effects subscription added
- [x] Inbound custom templates subscription added
- [x] Outbound custom templates subscription added
- [ ] Verify end-to-end with host + client
