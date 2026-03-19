# STEP-008 — Compendium Sync Strategy

## Overview

The compendium (monsters, spells, items, etc.) presents a data sync problem:

- **Size:** The 5.5e monster bestiary is ~1.3MB JSON — exceeds the Jazz 1MB blob limit
- **Read frequency:** High (DMs browse frequently during sessions)
- **Write frequency:** Near zero (monsters are static reference data, rarely edited)
- **Audience:** DMs only in standard sessions; remote DM clients in multi-DM sessions

Current behavior: Compendium data is unclear in terms of what is synced and to whom.

---

## Data Classification Framework

All data in the system should be classified before choosing a sync strategy:

| Classification | Change Rate | Size | Audience | Recommended Strategy |
|---|---|---|---|---|
| **Session State** (tokens, fog, maps) | High | Small–Medium | All clients | Jazz fine-grained CoValues |
| **Campaign Content** (regions, effects, map objects) | Medium | Medium | All clients | Jazz CoValues / fine-grained |
| **Reference Data** (monsters, spells, items) | Near-zero | Large | DM only | DO NOT sync to players; stream to remote DMs |
| **User Content** (custom templates, characters) | Low | Small–Medium | Creator + DM | Jazz CoValues |
| **Media Assets** (textures, token art) | Low | Large | All clients | Jazz binary blobs (textureSync) |

---

## Monster / Bestiary Sync Rules

### Standard Session (1 DM, N Players)
- **Players:** Receive ONLY tokens currently on the map. No monster stat blocks.
- **DM (Host):** Compendium lives locally. Never pushed to Jazz.

### Promoted Creatures (Companions, Familiars, Mounts, Summons)
Creatures that players need to interact with during play should be **"promoted to Character"**:
- DM promotes a monster instance → creates a `CharacterRef` linked to the token
- `CharacterRef` contains the minimal data players need: name, HP, AC, status
- Full stat block remains DM-only
- Promoted creatures sync as part of session state (Jazz fine-grained)

### Multi-DM Session (Remote DM Client)
The remote DM DOES need the full compendium. Options ranked by feasibility:

#### Option A: WebRTC Binary Stream (Recommended)
Transfer the compendium bestiary as a binary chunk over the established WebRTC data channel. Use the existing `SyncProfiler` progress toast to show streaming progress.

```
Host DM detects remote DM connected
→ chunk bestiary JSON into 64KB segments
→ stream segments with sequence numbers over ephemeral data channel
→ remote DM client reassembles, parses, loads into local compendium store
→ progress toast: "Syncing Bestiary 45%..."
```

**Pros:** No Jazz size limits, uses existing infrastructure, DM-to-DM only  
**Cons:** Requires new chunked transfer protocol over WebRTC

#### Option B: Compressed Jazz Blob (Fallback)
Compress the bestiary with pako (gzip) before pushing to Jazz. 1.3MB compresses to ~200-300KB for typical JSON bestiary data, well within the 1MB limit.

**Pros:** Simple, reuses Jazz binary infrastructure  
**Cons:** Compression/decompression overhead, Jazz blobs not designed for data this large, content goes into shared CRDT

#### Option C: Per-Monster CoValues
Each monster is its own `JazzMonster` CoValue. Loaded lazily when needed.

**Pros:** Granular sync, no size limits  
**Cons:** 500+ CoValues for a full bestiary = Jazz overhead, complex subscription management

#### **Recommendation:** Option A (WebRTC stream) for multi-DM, with Option B as a fallback for slow/unreliable WebRTC conditions.

---

## Chunked Transfer Protocol Design

```ts
// New ephemeral message types
type EphemeralChunkStart = {
  kind: 'chunk_transfer_start';
  transferId: string;
  dataType: 'bestiary' | 'compendium';
  totalChunks: number;
  totalBytes: number;
};

type EphemeralChunk = {
  kind: 'chunk_transfer_data';
  transferId: string;
  chunkIndex: number;
  data: string; // base64 chunk
};

type EphemeralChunkEnd = {
  kind: 'chunk_transfer_end';
  transferId: string;
  checksum: string; // md5 or sha256 for integrity
};
```

Receiver reassembles chunks, verifies checksum, JSON.parses, merges into local compendium store.

---

## Compendium Sync Gate (Standard Sessions)

```ts
// In JazzTransport (or bridge) connectedUsers subscriber:
const remoteUser = connectedUsers[userId];
const isRemoteDM = remoteUser.roles.includes('dm');

if (isRemoteDM && _isCreator) {
  // Trigger bestiary stream to this DM
  streamBestiaryToClient(userId);
}
// else: player connection — no compendium data sent
```

---

## Token Data from Promoted Creatures

When a DM promotes a monster to a Character:
```ts
interface CharacterRef {
  tokenId: string;
  name: string;
  species: string;
  hp: { current: number; max: number; temp: number };
  ac: number;
  statuses?: string[];
  // Deliberately minimal — full stat block stays DM-side
}
```

`CharacterRef` is synced via Jazz fine-grained (part of token data or separate CoValue).

---

## Outstanding Questions for User Review

1. **Remote DM detection:** How do we determine that a newly connected client is a "DM"? Is this based on the `roles` array? Confirm remote DM = `roles.includes('dm')`.

2. **Bestiary trigger:** Should the bestiary stream automatically start when a remote DM connects, or should the host DM manually initiate it via a "Share Compendium" action?

3. **Compendium updates mid-session:** If the DM adds custom monsters during a session, should these be streamed incrementally to remote DMs or only on next session start?

4. **Player-visible creature data:** When a player targets or inspects a monster token, what data should they see? Just name + visible HP? Or more? This affects what goes into `CharacterRef`.

5. **Bestiary versioning:** If future updates ship a new bestiary, how does a remote DM client know its local copy is stale? Should we include a content hash as part of session metadata?

6. **Spell compendium:** Same rules as monsters? Spells are smaller (~300KB) but still significant. Should the spell list also be streamed to remote DMs?

---

## Dependencies
- **STEP-009** (Token Schema) — `CharacterRef` derives from the generic token schema
- WebRTC data channel (already established via STEP-001-era networking work)
