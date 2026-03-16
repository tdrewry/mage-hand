# DM-Authoritative Blob Sync & Fine-Grained Illumination (v0.7.102)

## Phase 1: Authoritative Flag (v0.7.101 — DONE)

### Problem
When a non-creator client (player) joins a session, their local stores have default/empty state.
The bidirectional blob sync pushes these defaults to Jazz, overwriting the creator's configured
fog settings, illumination sources, dungeon features, etc. This causes illumination to break
on the host as soon as a client views the map.

### Fix
Added an `authoritative` flag to `DORegistration`. When `authoritative: true`, only the session
creator (`_isCreator`) may push that blob outbound. Non-creators only pull (consume).

**Authoritative DOs (creator-push-only):**
- `fog` — fog settings, explored geometry, vision config
- `lights` — legacy light sources
- `illumination` — unified illumination sources + ambient light (now fine-grained, see Phase 2)
- `dungeon` — doors, walls, styles

**Non-authoritative DOs (any client can push):**
- `maps`, `groups`, `initiative`, `roles`, `visionProfiles`
- `creatures`, `hatching`, `dice`, `actions`, `cards`

### Multi-DM Note
The first DM (session creator) is the authoritative source. Additional DMs are contributors
whose local changes will be applied through fine-grained sync (tokens, regions, etc.) but
will not overwrite blob-level authoritative state.

---

## Phase 2: Fine-Grained Illumination Sync (v0.7.102 — DONE)

### Problem
Even with Phase 1 protecting the DM, players never receive illumination state because
standalone lights only traveled via the blob channel. The player's client had no way to
pull the DM's illumination configuration.

### Fix
Migrated standalone illumination sources from blob sync to **fine-grained CoValue sync**:

1. **Schema** (`src/lib/jazz/schema.ts`):
   - Added `JazzIlluminationSource` CoMap with all illumination properties as first-class fields
   - Added `JazzIlluminationSourceList` CoList
   - Added `illuminationSources` as optional field on `JazzSessionRoot`

2. **Bridge** (`src/lib/jazz/bridge.ts`):
   - Removed `illumination` from `BLOB_SYNC_KINDS` and `STORE_FOR_KIND`
   - Added `illuminationToJazzInit()` / `jazzToZustandIllumination()` converters
   - Added `pushIlluminationToJazz()` / `pullIlluminationFromJazz()` for initial sync
   - Added outbound subscription (creator-only, throttled at 1s)
   - Added inbound subscription (all clients, with deep-compare guard)
   - Cached `_cachedIllumination` ref alongside other CoList caches

3. **Session** (`src/lib/jazz/session.ts`):
   - Updated `load()` resolve paths to include `illuminationSources: { $each: true }`
   - Updated retry pull to include illumination resolve path

4. **Session Root Creation**:
   - `createSessionRoot()` now creates an empty `JazzIlluminationSourceList`

### Architecture
- **Outbound** (Zustand → Jazz): Creator-only. Uses `throttledPushFineGrained` (trailing-edge, 1Hz).
  Clear-and-repush pattern (illumination lists are small, <16 sources).
- **Inbound** (Jazz → Zustand): All clients. Deep-compares against local state (excluding
  `visibilityPolygon` which is a local rendering concern) to prevent false-positive redraws.
- **Backward compat**: If `illuminationSources` is absent on the session root (legacy session),
  the blob fallback path still works.

### Files Changed
| File | Change |
|------|--------|
| `src/lib/durableObjects.ts` | Added `authoritative?: boolean` to `DORegistration` |
| `src/lib/durableObjectRegistry.ts` | Marked fog, lights, illumination, dungeon as `authoritative: true` |
| `src/lib/jazz/schema.ts` | Added `JazzIlluminationSource` CoMap/CoList, added to session root |
| `src/lib/jazz/bridge.ts` | Fine-grained illumination sync, removed from blob sync |
| `src/lib/jazz/session.ts` | Updated resolve paths for illuminationSources |
| `src/lib/version.ts` | 0.7.102 |

### Impact on External Services
None — all changes are client-side. No WebSocket server or Jazz service changes needed.
The Jazz server automatically syncs the new CoList schema without configuration.
