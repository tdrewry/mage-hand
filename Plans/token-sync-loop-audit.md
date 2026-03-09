# Token Sync Loop Audit (v0.7.164)

## Problem
Token property edits (character sheet, label, path style, appearance variants) were not syncing between clients. The receiving client appeared to overwrite incoming properties with its own stale values.

## Root Cause Analysis

### Bug 1 (PRIMARY): Incomplete outbound change detection allowlist
**Location**: `src/lib/jazz/bridge.ts`, outbound token subscription (Zustand → Jazz)

The outbound subscription used a hardcoded `nonPosChanged` allowlist that only checked:
- `label`, `color`, `name`, `hp`, `maxHp`, `ac`, `isHidden`, `mapId`, `gridWidth`, `gridHeight`, `imageHash`

Fields **missing** from the check (silently dropped, never pushed to Jazz):
- `statBlockJson`, `notes`, `quickReferenceUrl`
- `pathStyle`, `pathColor`, `pathWeight`, `pathOpacity`, `pathGaitWidth`, `footprintType`
- `labelPosition`, `labelColor`, `labelBackgroundColor`
- `initiative`, `inCombat`
- `illuminationSources` (nested array)
- `entityRef`, `appearanceVariants`, `activeVariantId`
- `roleId`

When any of these fields changed, the subscription hit `if (!posChanged && !nonPosChanged) continue;` and skipped the Jazz push entirely. The same incomplete allowlist existed in the drag fast-path check.

### Bug 2 (SECONDARY): `emitTokenMetaSync` is dead code
`emitTokenMetaSync()` in `dragOps.ts` is defined but never called from any UI component. The ephemeral `token.meta.sync` pathway was never wired up, so it couldn't serve as a backup sync mechanism.

### Bug 3 (LATENT): Ephemeral meta sync lacks `runFromJazz` guard
If `emitTokenMetaSync` were wired up, the `token.meta.sync` handler in `tokenHandlers.ts` writes to the store via `useSessionStore.setState()` without `runFromJazz()`. This would trigger the Jazz outbound subscription to re-push the data, creating a potential echo loop when both Jazz and ephemeral are active. This is latent (not triggered because of Bug 2).

## Fix Applied

### Bridge outbound change detection
Replaced both hardcoded field allowlists with the existing generic `_hasEntityChanges()` helper, which deep-compares ALL fields except a skip list (`['id', 'x', 'y', 'imageUrl']`). This ensures any token property change — current or future — is detected and pushed to Jazz.

## Files Modified
- `src/lib/jazz/bridge.ts` — fixed outbound nonPosChanged + fast-path checks
- `src/lib/version.ts` — bump to 0.7.164

## Impact
- Jazz tandem sessions will now correctly sync ALL token property changes
- No websocket server restart needed — this is client-side only
- Bugs 2 and 3 remain as future work items (wire up ephemeral meta sync from UI components)
