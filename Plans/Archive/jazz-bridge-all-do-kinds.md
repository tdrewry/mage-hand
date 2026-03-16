# Jazz Bridge — All Durable Object Kinds

## Goal

Extend the Jazz bridge beyond token-only sync to cover **all** registered Durable Object kinds (maps, regions, effects, fog, initiative, groups, creatures, dungeon, mapObjects, illumination, lights, roles, visionProfiles, hatching, dice, actions, effects, cards, viewportTransforms).

## Strategy: Blob Sync via JazzDOBlob

Rather than creating fine-grained CoValue schemas for every store (which would be massive), we reuse the existing `JazzDOBlob` schema. Each DO kind is serialized as a JSON blob using the `DurableObjectRegistry` extractors/hydrators — the same system used for `.mhdo` exports.

### Architecture

```
                ┌─────────────────────────────┐
                │     JazzSessionRoot          │
                │  .tokens  (fine-grained)     │
                │  .blobs[] (JazzDOBlob[])     │
                │    ├─ kind:"maps"            │
                │    ├─ kind:"regions"         │
                │    ├─ kind:"fog"             │
                │    ├─ kind:"effects"         │
                │    ├─ kind:"initiative"      │
                │    └─ ... (all DO kinds)     │
                └─────────────────────────────┘
```

### Push (Zustand → Jazz)

1. Subscribe to each store that backs a DO kind
2. On change, extract state via `DurableObjectRegistry.extract(kind)`
3. Serialize to JSON, find or create a `JazzDOBlob` in `sessionRoot.blobs`
4. Update the blob's `state` and `updatedAt` fields
5. **Throttle** pushes to 1Hz max per kind to avoid flooding

### Pull (Jazz → Zustand)

1. On join, iterate `sessionRoot.blobs` and hydrate each kind
2. Subscribe to blob list changes; on update, re-hydrate the affected kind

### Excluded from blob sync

- `tokens` — already has fine-grained CoValue sync
- `cards` — UI layout, not meaningful to sync across peers (optional)
- `viewportTransforms` — per-user viewport state (skip)

## Files to Edit

| File | Change |
|------|--------|
| `src/lib/jazz/bridge.ts` | Add blob push/pull/subscribe logic |
| `src/lib/version.ts` | Bump version |

## Edge Cases

- **Large state**: Fog geometry can be large; JSON serialization handles it but may be slow. Throttle mitigates.
- **Concurrent edits**: Last-write-wins at the blob level; Jazz CRDT handles field-level merges within the blob CoMap.
- **Missing registry entries**: Skip unknown kinds gracefully on pull.
