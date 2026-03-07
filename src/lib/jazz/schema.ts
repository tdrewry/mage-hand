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
  mapId: z.optional(z.string()),
  // Promoted from extras for fine-grained sync:
  hp: z.optional(z.number()),
  maxHp: z.optional(z.number()),
  ac: z.optional(z.number()),
  hostility: z.optional(z.string()),
  imageHash: z.optional(z.string()),
  roleId: z.optional(z.string()),
  isHidden: z.optional(z.boolean()),
  labelPosition: z.optional(z.string()),
  labelColor: z.optional(z.string()),
  labelBackgroundColor: z.optional(z.string()),
  initiative: z.optional(z.number()),
  inCombat: z.optional(z.boolean()),
  pathStyle: z.optional(z.string()),
  pathColor: z.optional(z.string()),
  pathWeight: z.optional(z.number()),
  pathOpacity: z.optional(z.number()),
  pathGaitWidth: z.optional(z.number()),
  footprintType: z.optional(z.string()),
  locked: z.optional(z.boolean()),
  notes: z.optional(z.string()),
  statBlockJson: z.optional(z.string()),
  quickReferenceUrl: z.optional(z.string()),
  /** Complex nested fields (illuminationSources, entityRef, appearanceVariants) as JSON */
  extras: z.optional(z.string()),
});
export type JazzToken = co.loaded<typeof JazzToken>;

export const JazzTokenList = co.list(JazzToken);
export type JazzTokenList = co.loaded<typeof JazzTokenList>;

// ── Region ─────────────────────────────────────────────────────────────────

export const JazzRegion = co.map({
  regionId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  gridType: z.string(),
  gridSize: z.number(),
  gridScale: z.number(),
  gridSnapping: z.boolean(),
  gridVisible: z.boolean(),
  textureHash: z.optional(z.string()),
  backgroundRepeat: z.optional(z.string()),
  backgroundScale: z.optional(z.number()),
  backgroundOffsetX: z.optional(z.number()),
  backgroundOffsetY: z.optional(z.number()),
  backgroundColor: z.optional(z.string()),
  regionType: z.optional(z.string()),
  rotation: z.optional(z.number()),
  locked: z.optional(z.boolean()),
  mapId: z.optional(z.string()),
  smoothing: z.optional(z.boolean()),
  /** Complex nested data serialized as JSON strings */
  pathPointsJson: z.optional(z.string()),
  bezierControlPointsJson: z.optional(z.string()),
  rotationCenterJson: z.optional(z.string()),
});
export type JazzRegion = co.loaded<typeof JazzRegion>;

export const JazzRegionList = co.list(JazzRegion);
export type JazzRegionList = co.loaded<typeof JazzRegionList>;

// ── Map Object ─────────────────────────────────────────────────────────────

export const JazzMapObject = co.map({
  objectId: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.optional(z.number()),
  shape: z.string(),
  fillColor: z.string(),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  opacity: z.number(),
  imageHash: z.optional(z.string()),
  textureScale: z.optional(z.number()),
  textureOffsetX: z.optional(z.number()),
  textureOffsetY: z.optional(z.number()),
  castsShadow: z.boolean(),
  blocksMovement: z.boolean(),
  blocksVision: z.boolean(),
  revealedByLight: z.boolean(),
  isOpen: z.optional(z.boolean()),
  doorType: z.optional(z.number()),
  label: z.optional(z.string()),
  category: z.string(),
  locked: z.optional(z.boolean()),
  renderOrder: z.optional(z.number()),
  mapId: z.optional(z.string()),
  portalName: z.optional(z.string()),
  portalTargetId: z.optional(z.string()),
  portalHiddenInPlay: z.optional(z.boolean()),
  portalAutoActivateTarget: z.optional(z.boolean()),
  annotationText: z.optional(z.string()),
  annotationReference: z.optional(z.string()),
  terrainFeatureId: z.optional(z.string()),
  lightColor: z.optional(z.string()),
  lightRadius: z.optional(z.number()),
  lightBrightRadius: z.optional(z.number()),
  lightIntensity: z.optional(z.number()),
  lightEnabled: z.optional(z.boolean()),
  /** Complex nested data serialized as JSON strings */
  customPathJson: z.optional(z.string()),
  wallPointsJson: z.optional(z.string()),
  doorDirectionJson: z.optional(z.string()),
});
export type JazzMapObject = co.loaded<typeof JazzMapObject>;

export const JazzMapObjectList = co.list(JazzMapObject);
export type JazzMapObjectList = co.loaded<typeof JazzMapObjectList>;

// ── Placed Effect ──────────────────────────────────────────────────────────
// No template snapshot — reconstructed from templateId + castLevel on hydration.

export const JazzPlacedEffect = co.map({
  effectId: z.string(),
  templateId: z.string(),
  originX: z.number(),
  originY: z.number(),
  direction: z.optional(z.number()),
  casterId: z.optional(z.string()),
  mapId: z.string(),
  castLevel: z.optional(z.number()),
  roundsRemaining: z.optional(z.number()),
  groupId: z.optional(z.string()),
  animationPaused: z.optional(z.boolean()),
  isAura: z.optional(z.boolean()),
  anchorTokenId: z.optional(z.string()),
  recurring: z.optional(z.boolean()),
  /** JSON: EffectImpact[] */
  impactedTargetsJson: z.optional(z.string()),
  /** JSON: string[] */
  triggeredTokenIdsJson: z.optional(z.string()),
  /** JSON: string[] */
  tokensInsideAreaJson: z.optional(z.string()),
  /** JSON: { x: number; y: number }[] */
  waypointsJson: z.optional(z.string()),
});
export type JazzPlacedEffect = co.loaded<typeof JazzPlacedEffect>;

export const JazzPlacedEffectList = co.list(JazzPlacedEffect);
export type JazzPlacedEffectList = co.loaded<typeof JazzPlacedEffectList>;

// ── Custom Effect Template ─────────────────────────────────────────────────
// Stripped of large data URIs (texture/icon) — those sync via FileStreams.

export const JazzCustomTemplate = co.map({
  templateId: z.string(),
  /** JSON.stringify of the full EffectTemplate (minus texture/icon data URIs) */
  templateJson: z.string(),
});
export type JazzCustomTemplate = co.loaded<typeof JazzCustomTemplate>;

export const JazzCustomTemplateList = co.list(JazzCustomTemplate);
export type JazzCustomTemplateList = co.loaded<typeof JazzCustomTemplateList>;

// ── Effect State Container ─────────────────────────────────────────────────

export const JazzEffectState = co.map({
  placedEffects: JazzPlacedEffectList,
  customTemplates: JazzCustomTemplateList,
});
export type JazzEffectState = co.loaded<typeof JazzEffectState>;

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
  regions: co.optional(JazzRegionList),
  mapObjects: co.optional(JazzMapObjectList),
  effects: co.optional(JazzEffectState),
  blobs: JazzDOBlobList,
  textures: co.optional(JazzTextureList),
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
    try {
      if (!account.$jazz.has("root")) {
        account.$jazz.set("root", {});
      }
      if (!account.$jazz.has("profile")) {
        account.$jazz.set("profile", {
          name: creationProps?.name ?? "Anonymous DM",
        });
      }
    } catch (err) {
      console.error("[jazz-schema] Migration error:", err);
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
  const regions = JazzRegionList.create([], group);
  const mapObjects = JazzMapObjectList.create([], group);
  const blobs = JazzDOBlobList.create([], group);
  const textures = JazzTextureList.create([], group);

  return JazzSessionRoot.create(
    { sessionName, tokens, maps, regions, mapObjects, blobs, textures },
    group,
  );
}
