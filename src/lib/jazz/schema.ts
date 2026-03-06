/**
 * Jazz CoValue Schema — mirrors the DurableObjectRegistry kinds.
 *
 * Uses co.map() / co.list() function-call API (jazz-tools ≥0.15).
 * Optional primitives use z.optional(). Optional CoValue refs use co.optional().
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
  hp: z.optional(z.number()),
  maxHp: z.optional(z.number()),
  ac: z.optional(z.number()),
  hostility: z.optional(z.string()),
  mapId: z.optional(z.string()),
  /** Serialized extra fields as JSON string for forward-compat */
  extras: z.optional(z.string()),
});
export type JazzToken = co.loaded<typeof JazzToken>;

export const JazzTokenList = co.list(JazzToken);
export type JazzTokenList = co.loaded<typeof JazzTokenList>;

// ── Map Metadata ───────────────────────────────────────────────────────────

export const JazzMapEntry = co.map({
  mapId: z.string(),
  name: z.string(),
  gridSize: z.number(),
  gridType: z.optional(z.string()),
  width: z.optional(z.number()),
  height: z.optional(z.number()),
  extras: z.optional(z.string()),
});
export type JazzMapEntry = co.loaded<typeof JazzMapEntry>;

export const JazzMapList = co.list(JazzMapEntry);
export type JazzMapList = co.loaded<typeof JazzMapList>;

// ── Generic DO State Blob ──────────────────────────────────────────────────

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
  tokens: JazzTokenList,
  maps: JazzMapList,
  blobs: JazzDOBlobList,
});
export type JazzSessionRoot = co.loaded<typeof JazzSessionRoot>;
