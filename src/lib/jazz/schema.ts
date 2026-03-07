/**
 * Jazz CoValue Schema — mirrors the DurableObjectRegistry kinds.
 *
 * Uses co.map() / co.list() function-call API (jazz-tools ≥0.15).
 * Optional primitives use z.optional(). Optional CoValue refs use co.optional().
 */

import { co, z, Group } from "jazz-tools";

// ── Token ──────────────────────────────────────────────────────────────────

export const JazzToken = co.map({
  tokenId: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  label: z.string(),
  name: z.string(),
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
export type JazzMapList = co.loaded<typeof JazzMapEntry>;

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

// ── Texture Entry (FileStream reference) ──────────────────────────────────

export const JazzTextureEntry = co.map({
  hash: z.string(),
  mimeType: z.string(),
  /** CoValue ID of the FileStream (stored as string for portability) */
  fileStreamId: z.string(),
});
export type JazzTextureEntry = co.loaded<typeof JazzTextureEntry>;

export const JazzTextureList = co.list(JazzTextureEntry);
export type JazzTextureList = co.loaded<typeof JazzTextureList>;

// ── Session Root ───────────────────────────────────────────────────────────

export const JazzSessionRoot = co.map({
  sessionName: z.string(),
  tokens: JazzTokenList,
  maps: JazzMapList,
  blobs: JazzDOBlobList,
  textures: JazzTextureList,
});
export type JazzSessionRoot = co.loaded<typeof JazzSessionRoot>;

// ── Account ────────────────────────────────────────────────────────────────

export const MageHandAccountRoot = co.map({
  /** The active session root (if any) */
  activeSession: co.optional(JazzSessionRoot),
});
export type MageHandAccountRoot = co.loaded<typeof MageHandAccountRoot>;

export const MageHandAccount = co
  .account({
    root: MageHandAccountRoot,
    profile: co.profile(),
  })
  .withMigration((account, creationProps?: { name: string }) => {
    if (!account.$jazz.has("root")) {
      account.$jazz.set("root", {});
    }
    if (!account.$jazz.has("profile")) {
      account.$jazz.set("profile", {
        name: creationProps?.name ?? "Anonymous DM",
      });
    }
  });
export type MageHandAccount = co.loaded<typeof MageHandAccount>;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a new JazzSessionRoot with empty lists, owned by a shared group.
 * The group is public-readable so any peer can join via the session ID.
 */
export function createSessionRoot(sessionName: string): JazzSessionRoot {
  const group = Group.create();
  group.addMember("everyone", "writer");

  const tokens = JazzTokenList.create([], group);
  const maps = JazzMapList.create([], group);
  const blobs = JazzDOBlobList.create([], group);
  const textures = JazzTextureList.create([], group);

  return JazzSessionRoot.create(
    { sessionName, tokens, maps, blobs, textures },
    group,
  );
}
