# Player Art Submission & DM Approval Workflow

## Status: Phase 1 Implementation (v0.7.5)

## Overview

Players can upload art for tokens, regions, map objects, and effect templates that they own.
Art submissions flow through a DM approval queue before being broadcast to other peers.

## Architecture

### Data Flow

```
Player uploads art → emits "asset.submission" ephemeral op
                   → DM receives submission in ArtSubmissionStore
                   → DM previews in Art Approval Card
                   → DM accepts → emits "asset.accepted" (broadcasts texture + target entity)
                   → DM rejects → emits "asset.rejected" (player sees toast)
                   → All peers receive accepted asset → apply texture to entity
```

### Upload Progress

During upload, `asset.uploadProgress` ephemeral ops are emitted at 200ms throttle
so peers see real-time progress bars. The existing `miscEphemeralStore.uploadProgress`
state drives a `TextureDownloadProgress`-style overlay.

### Ephemeral Op Types

| Op Kind | Direction | Payload | TTL |
|---------|-----------|---------|-----|
| `asset.uploadProgress` | Any → All | `{ assetId, percent }` | 5s |
| `asset.submission` | Player → DM | `{ submissionId, targetType, targetId, textureHash, textureData, playerName }` | 60s |
| `asset.accepted` | DM → All | `{ submissionId, targetType, targetId, textureHash, textureData }` | 10s |
| `asset.rejected` | DM → Player | `{ submissionId, reason? }` | 5s |

### Store: `artSubmissionStore.ts`

```typescript
interface ArtSubmission {
  id: string;
  playerId: string;
  playerName: string;
  targetType: 'token' | 'region' | 'mapObject' | 'effectTemplate';
  targetId: string;
  targetName: string;
  textureHash: string;
  textureDataUrl: string; // base64 preview (compressed)
  status: 'pending' | 'accepted' | 'rejected';
  submittedAt: number;
}
```

### UI: Art Approval Card (DM-only)

- Shows pending submissions with thumbnails
- Preview modal with full-size image
- Accept / Reject buttons per submission
- Batch accept/reject toolbar
- Badge count on menu button when pending > 0

### Ownership Gating

Players can only submit art for entities they own:
- Tokens with `roleId` matching the player's role
- Map objects / regions with matching `ownerId` (future)
- The submission handler validates ownership server-side

## Files

| File | Purpose |
|------|---------|
| `src/stores/artSubmissionStore.ts` | Submission queue state |
| `src/components/cards/ArtApprovalCard.tsx` | DM approval UI |
| `src/lib/net/ephemeral/types.ts` | New payload types |
| `src/lib/net/ephemeral/miscHandlers.ts` | Submission/acceptance handlers |
| `src/lib/net/ephemeral/index.ts` | Re-export new emitters |
| `src/lib/textureSync.ts` | Wire progress emitter |
| `src/types/cardTypes.ts` | Add ART_APPROVAL card type |

## Future Phases

- Phase 2: Persist pending submissions across reconnects
- Phase 3: Ownership-gated submission (validate `roleId` match)  
- Phase 4: Gallery view of all submitted art per entity
