/**
 * Jazz CoValue Schema — mirrors the DurableObjectRegistry kinds.
 *
 * Each DO kind maps to a CoMap stored under a top-level JazzSessionRoot.
 * Phase 1 defines the session root + token schema (proof-of-concept).
 * Additional stores are added incrementally per the migration plan.
 *
 * Uses the new co.map() / co.list() function-call API (jazz-tools ≥0.15).
 */

import { co, z } from "jazz-tools";

// ── Token ──────────────────────────────────────────────────────────────────

export const JazzToken = co.map({
  tokenId: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  label: z.string(),
  gridWidth: z.number(),
  gridHeight: z.number(),
  hp: co.optional(z.number()),
  maxHp: co.optional(z.number()),
  ac: co.optional(z.number()),
  hostility: co.optional(z.string()),
  mapId: co.optional(z.string()),
  /** Serialized extra fields as JSON string for forward-compat */
  extras: co.optional(z.string()),
});
export type JazzToken = co.loaded<typeof JazzToken>;

export const JazzTokenList = co.list(JazzToken);
export type JazzTokenList = co.loaded<typeof JazzTokenList>;

// ── Map Metadata ───────────────────────────────────────────────────────────

export const JazzMapEntry = co.map({
  mapId: z.string(),
  name: z.string(),
  gridSize: z.number(),
  gridType: co.optional(z.string()),
  width: co.optional(z.number()),
  height: co.optional(z.number()),
  /** Additional map fields stored as JSON string */
  extras: co.optional(z.string()),
});
export type JazzMapEntry = co.loaded<typeof JazzMapEntry>;

export const JazzMapList = co.list(JazzMapEntry);
export type JazzMapList = co.loaded<typeof JazzMapList>;

// ── Generic DO State Blob ──────────────────────────────────────────────────
// For stores that don't yet have a fine-grained schema, we store the entire
// extracted state as a JSON string. This lets us migrate stores incrementally.

export const JazzDOBlob = co.map({
  kind: z.string(),
  version: z.number(),
  /** JSON.stringify'd state from the DO extractor */
  state: z.string(),
  updatedAt: z.string(),
});
export type JazzDOBlob = co.loaded<typeof JazzDOBlob>;

export const JazzDOBlobList = co.list(JazzDOBlob);
export type JazzDOBlobList = co.loaded<typeof JazzDOBlobList>;

// ── Session Root ───────────────────────────────────────────────────────────

export const JazzSessionRoot = co.map({
  name: z.string(),
  /** Fine-grained token sync (Phase 2) */
  tokens: JazzTokenList,
  /** Fine-grained map sync (Phase 2+) */
  maps: JazzMapList,
  /** Blob storage for stores not yet given fine-grained schemas */
  blobs: JazzDOBlobList,
});
export type JazzSessionRoot = co.loaded<typeof JazzSessionRoot>;
