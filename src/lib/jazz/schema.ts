/**
 * Jazz CoValue Schema — mirrors the DurableObjectRegistry kinds.
 *
 * Each DO kind maps to a CoMap stored under a top-level JazzSessionRoot.
 * Phase 1 defines the session root + token schema (proof-of-concept).
 * Additional stores are added incrementally per the migration plan.
 *
 * IMPORTANT: CoMap fields must be JSON-serializable primitives or nested CoValues.
 * Complex nested objects (geometry, arrays of points) use co.json<T>() for now;
 * they can be promoted to proper CoList/CoMap schemas later for finer-grained CRDT merge.
 */

import { co, CoMap, CoList, z } from "jazz-tools";

// ── Token ──────────────────────────────────────────────────────────────────

export class JazzToken extends CoMap {
  tokenId = co.string;
  x = co.number;
  y = co.number;
  color = co.string;
  label = co.string;
  gridWidth = co.number;
  gridHeight = co.number;
  hp = co.optional.number;
  maxHp = co.optional.number;
  ac = co.optional.number;
  hostility = co.optional.string;
  mapId = co.optional.string;
  conditions = co.optional.json<string[]>();
  /** Serialized extra fields as JSON blob for forward-compat */
  extras = co.optional.json<Record<string, unknown>>();
}

export class JazzTokenList extends CoList {
  [co.items] = co.ref(JazzToken);
}

// ── Map Metadata ───────────────────────────────────────────────────────────

export class JazzMapEntry extends CoMap {
  mapId = co.string;
  name = co.string;
  gridSize = co.number;
  gridType = co.optional.string;
  width = co.optional.number;
  height = co.optional.number;
  /** Additional map fields stored as JSON blob */
  extras = co.optional.json<Record<string, unknown>>();
}

export class JazzMapList extends CoList {
  [co.items] = co.ref(JazzMapEntry);
}

// ── Generic DO State Blob ──────────────────────────────────────────────────
// For stores that don't yet have a fine-grained schema, we store the entire
// extracted state as a JSON blob. This lets us migrate stores incrementally
// without blocking on schema design for every store.

export class JazzDOBlob extends CoMap {
  kind = co.string;
  version = co.number;
  state = co.json<unknown>();
  updatedAt = co.string;
}

export class JazzDOBlobList extends CoList {
  [co.items] = co.ref(JazzDOBlob);
}

// ── Session Root ───────────────────────────────────────────────────────────
// Top-level CoMap that holds all durable state for a session.
// Each field corresponds to a DO kind (or group of kinds).

export class JazzSessionRoot extends CoMap {
  name = co.string;
  /** Fine-grained token sync (Phase 2) */
  tokens = co.ref(JazzTokenList);
  /** Fine-grained map sync (Phase 2+) */
  maps = co.ref(JazzMapList);
  /** Blob storage for stores not yet given fine-grained schemas */
  blobs = co.ref(JazzDOBlobList);
}
