# DM-Authoritative Blob Sync (v0.7.101)

## Phase 1: Authoritative Flag (DONE)

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
- `illumination` — unified illumination sources + ambient light
- `dungeon` — doors, walls, styles

**Non-authoritative DOs (any client can push):**
- `maps`, `groups`, `initiative`, `roles`, `visionProfiles`
- `creatures`, `hatching`, `dice`, `actions`, `cards`

### Multi-DM Note
The first DM (session creator) is the authoritative source. Additional DMs are contributors
whose local changes will be applied through fine-grained sync (tokens, regions, etc.) but
will not overwrite blob-level authoritative state. This is a deliberate design choice:
only one client should be the source of truth for rendering configuration.

### Files Changed
| File | Change |
|------|--------|
| `src/lib/durableObjects.ts` | Added `authoritative?: boolean` to `DORegistration` |
| `src/lib/durableObjectRegistry.ts` | Marked fog, lights, illumination, dungeon as `authoritative: true` |
| `src/lib/jazz/bridge.ts` | Gate `pushBlobToJazz()` behind `_isCreator` for authoritative kinds |
| `src/lib/version.ts` | 0.7.101 |

---

## Phase 2: Owner-Based Illumination Sync (NEXT)

### Goal
Decompose illumination out of blob sync entirely. Each entity type owns its illumination:
- **Token illumination** → already synced fine-grained with token CoMaps (✅ working)
- **Map object illumination** → sync with map object CoMaps (already fine-grained)
- **Standalone lights** → migrate from blob to fine-grained CoList entries
- **Fog rendering settings** → remain as authoritative blob (Phase 1 protects them)

### Benefits
- Eliminates the blob-level overwrite vector entirely for illumination
- Allows future features (e.g., player-placed torches) without breaking authoritative model
- Effect triggers and other DM-authoritative concepts can reuse the `authoritative` flag

### Approach
1. Create a `JazzIlluminationSourceSchema` CoMap with first-class fields
2. Add `illuminationSources` CoList to the session root schema
3. Bridge: subscribe to illumination CoList changes (inbound) + store subscription (outbound, creator-only)
4. Remove `illumination` from `BLOB_SYNC_KINDS` once fine-grained sync is live
5. Keep `authoritative: true` on the fine-grained registration for push gating

### Impact on External Services
None — all changes are client-side. No WebSocket server or Jazz service changes needed.
