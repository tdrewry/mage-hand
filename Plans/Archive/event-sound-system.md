# Event Sound System Plan (v0.7.119)

## Overview

A full event sound system for the VTT that plays synthesized tones (Web Audio API) by default, supports custom audio file overrides per event, and enables sound profile import/export for session sharing.

## Architecture

### Core Files
- **`src/lib/soundEngine.ts`** — Engine with Web Audio synth, IDB custom sound storage, playback, profile export/import
- **`src/stores/soundStore.ts`** — Zustand store for preferences (master volume, per-category volumes, per-event toggles), persisted to localStorage

### Event Taxonomy (Full)

| Category    | Events |
|-------------|--------|
| action      | action.received, action.resolved, action.pending, action.claim |
| chat        | chat.message, chat.whisper |
| dice        | dice.roll, dice.result |
| initiative  | initiative.turnChange, initiative.combatStart, initiative.combatEnd |
| effect      | effect.placed, effect.removed, effect.triggered |
| portal      | portal.activate, portal.teleport |
| movement    | movement.commit, movement.collision |
| fog         | fog.reveal, fog.hide |
| asset       | asset.submitted, asset.approved, asset.rejected |
| ui          | ui.notification, ui.error, ui.success |
| ambient     | ambient.loop |

### Storage

- **Preferences**: localStorage via zustand persist (`magehand-sound-prefs`)
- **Custom audio**: IndexedDB (`magehand-sounds-db`, store: `sounds`)
- **Profiles**: Exported as `.mhsoundprofile` JSON with base64-encoded audio + settings
- **Session integration**: Sound profile can be embedded in `.mhsession` exports (future)

## Implemented (v0.7.119)

1. ✅ Full `soundEngine.ts` with synth defaults for all 27 events
2. ✅ `soundStore.ts` with master/category/event controls
3. ✅ DM action notification: `action.received` and `action.pending` sounds + toast in `miscHandlers.ts`
4. ✅ `action.resolved` sound for all clients

## Remaining Work

1. Wire `triggerSound()` calls into more handlers (chat.message, dice, initiative, portal, etc.)
2. Build Sound Settings UI card for volume sliders and per-event toggles
3. Build custom sound upload UI per event
4. Add sound profile export/import UI
5. Embed sound profile in `.mhsession` export format
6. Add file-based sound pack support (curated .mp3 sets)

## External Impact

- **No external service changes needed** — all client-side Web Audio API
- **WebSocket server**: No changes
