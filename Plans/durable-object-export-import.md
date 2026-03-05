# Durable Object Export/Import System

## Status: Implemented (v0.6.65)

## Overview
Each zustand store is treated as a discrete "Durable Object" (DO) with its own versioned state envelope. The `.mhdo` archive format packages all DOs into a portable JSON file with integrity hashes and a manifest for selective import.

## Architecture

### DurableObject Model
```
{
  kind: string           // e.g. "tokens", "maps"
  version: number        // schema version
  stateHash: string      // FNV-1a integrity hash
  state: unknown         // serializable store state
  updatedAt: ISO8601
}
```

### Archive Format (.mhdo)
JSON file containing:
- `format`: "magehand-durable-objects"
- `formatVersion`: 1
- `manifest`: array of `{ kind, version, stateHash, byteSize, label }`
- `objects`: map of `kind -> DurableObject`

### Registry Pattern
`DurableObjectRegistry.register()` decouples serialization from transport:
- `extractor()`: pulls serializable state from the store
- `hydrator(state)`: restores state into the store
- `summarizer()`: human-readable count for UI

### Registered DOs (18 total)
tokens, maps, regions, groups, initiative, roles, visionProfiles, fog, lights, illumination, cards, dungeon, mapObjects, creatures, hatching, dice, actions, effects, viewportTransforms

### Selective Import
The `DurableObjectImportModal` shows a checklist of all DOs with sizes. User picks which to import. Each selected DO calls its registered hydrator.

## Files
- `src/lib/durableObjects.ts` — Types, registry, file I/O
- `src/lib/durableObjectRegistry.ts` — All 19 store registrations
- `src/components/modals/DurableObjectImportModal.tsx` — Import UI
- `src/components/cards/ProjectManagerCard.tsx` — Export/import buttons in Export tab

## Future
- Cloudflare DO or Jazz CoValue transport can wrap the same registry
- Diff preview before import
- Embedded texture assets in .mhdo
