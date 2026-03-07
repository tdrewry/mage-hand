/**
 * Jazz ↔ Zustand Bridge
 *
 * Bidirectional sync between Jazz CoValues and the existing Zustand stores.
 *
 * Three sync strategies:
 *   1. Fine-grained: Tokens, Regions, MapObjects use per-entity CoValue sync
 *   2. Blob sync: Remaining DO kinds use JazzDOBlob (JSON serialized state)
 *   3. FileStream: Textures use binary FileStream sync (see textureSync.ts)
 *
 * Echo prevention: a `_fromJazz` flag is set during hydration so that
 * store subscriptions don't re-push the same change back to Jazz.
 *
 * IMPORTANT: This module does NOT import from src/lib/net/ — it's a standalone
 * transport that feeds into the same Zustand stores.
 */

import { useSessionStore, type Token } from "@/stores/sessionStore";
import { useRegionStore, type CanvasRegion } from "@/stores/regionStore";
import { useMapObjectStore } from "@/stores/mapObjectStore";
import { useEffectStore } from "@/stores/effectStore";
import type { MapObject } from "@/types/mapObjectTypes";
import type { PlacedEffect, EffectTemplate } from "@/types/effectTypes";
import { computeScaledTemplate } from "@/types/effectTypes";
import { getBuiltInTemplate } from "@/lib/effectTemplateLibrary";
import {
  JazzToken as JazzTokenSchema,
  JazzRegion as JazzRegionSchema,
  JazzMapObject as JazzMapObjectSchema,
  JazzPlacedEffect as JazzPlacedEffectSchema,
  JazzCustomTemplate as JazzCustomTemplateSchema,
  JazzDOBlob as JazzDOBlobSchema,
  JazzRegionList,
  JazzMapObjectList,
  JazzPlacedEffectList,
  JazzCustomTemplateList,
  JazzEffectState,
} from "./schema";
import { DurableObjectRegistry } from "@/lib/durableObjects";
import "@/lib/durableObjectRegistry"; // Side-effect: registers all DO kinds
import { useMapStore } from "@/stores/mapStore";
import { useGroupStore } from "@/stores/groupStore";
import { useInitiativeStore } from "@/stores/initiativeStore";
import { useRoleStore } from "@/stores/roleStore";
import { useVisionProfileStore } from "@/stores/visionProfileStore";
import { useFogStore } from "@/stores/fogStore";
import { useLightStore } from "@/stores/lightStore";
import { useIlluminationStore } from "@/stores/illuminationStore";
import { useDungeonStore } from "@/stores/dungeonStore";
import { useCreatureStore } from "@/stores/creatureStore";
import { useHatchingStore } from "@/stores/hatchingStore";
import { useActionStore } from "@/stores/actionStore";
import { useDiceStore } from "@/stores/diceStore";

// (Effect texture stripping removed — effects now use fine-grained CoValue sync)

let _fromJazz = false;

/** Token IDs currently being dragged locally — suppress inbound Jazz position updates */
const _localDragTokens = new Set<string>();

/** Tokens in post-drag grace period — still suppress inbound Jazz position for a short window */
const _dragGraceTokens = new Set<string>();
const _dragGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DRAG_GRACE_MS = 600; // ms to keep suppressing inbound after drag end

/** Mark a token as being locally dragged (suppresses inbound Jazz position sync) */
export function markTokenDragStart(tokenId: string): void {
  // Clear any lingering grace period from a previous drag
  const existingTimer = _dragGraceTimers.get(tokenId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    _dragGraceTimers.delete(tokenId);
    _dragGraceTokens.delete(tokenId);
  }
  _localDragTokens.add(tokenId);
}

/** Unmark a token drag — pushes final position to Jazz, then keeps suppressing
 *  inbound Jazz position updates for a grace period to prevent snap-back from
 *  stale CRDT data arriving before the final position has round-tripped. */
export function markTokenDragEnd(tokenId: string): void {
  // Push final position BEFORE removing from drag set
  _pushTokenFinalPosition(tokenId);
  // Move from active-drag to grace period (still suppresses inbound position)
  _localDragTokens.delete(tokenId);
  _dragGraceTokens.add(tokenId);
  const timer = setTimeout(() => {
    _dragGraceTokens.delete(tokenId);
    _dragGraceTimers.delete(tokenId);
  }, DRAG_GRACE_MS);
  _dragGraceTimers.set(tokenId, timer);
}

/** Check if a token's inbound position should be suppressed (dragging or grace period) */
function _isPositionSuppressed(tokenId: string): boolean {
  return _localDragTokens.has(tokenId) || _dragGraceTokens.has(tokenId);
}

/** Push a single token's current position to Jazz (used after drag end) */
function _pushTokenFinalPosition(tokenId: string): void {
  const jazzTokens = _cachedTokens ?? _sessionRoot?.tokens;
  if (!jazzTokens) return;
  const token = useSessionStore.getState().tokens.find(t => t.id === tokenId);
  if (!token) return;
  const len = jazzTokens.length ?? 0;
  for (let i = 0; i < len; i++) {
    const jt = jazzTokens[i];
    if (jt && jt.tokenId === tokenId) {
      try {
        const init = tokenToJazzInit(token);
        for (const [key, val] of Object.entries(init)) {
          if (key !== 'tokenId') jt.$jazz.set(key, val ?? undefined);
        }
      } catch (err) {
        console.error(`[jazz-bridge] Failed to push final token position:`, err);
      }
      break;
    }
  }
}

/** Throttle map for "too large" skip warnings — one per kind per 30s */
const _lastSkipWarn = new Map<string, number>();

/** Whether the local client created this session (source of truth for initial state) */
let _isCreator = false;

/** Returns true when the current store mutation originated from Jazz (inbound sync). */
export function isFromJazz(): boolean {
  return _fromJazz;
}

/**
 * Run a callback with the _fromJazz flag set.
 * Use this when hydrating stores from Jazz CoValue changes.
 */
export function runFromJazz(fn: () => void): void {
  const prev = _fromJazz;
  _fromJazz = true;
  try {
    fn();
  } finally {
    _fromJazz = prev;
  }
}

// ── Bridge lifecycle ───────────────────────────────────────────────────────

type Unsubscribe = () => void;

/** Active store subscriptions for the current session */
const activeSubscriptions: Unsubscribe[] = [];

/** The current Jazz session root being bridged (typed as any to avoid MaybeLoaded issues) */
let _sessionRoot: any = null;

/** Cached child CoValue references — Jazz proxies can go stale when accessed later */
let _cachedTokens: any = null;
let _cachedRegions: any = null;
let _cachedMapObjects: any = null;
let _cachedEffects: any = null;
let _cachedBlobs: any = null;
let _cachedGroup: any = null;

/**
 * Get the currently bridged session root (if any).
 * Returns a wrapper that uses cached child refs to avoid stale proxy issues.
 */
export function getBridgedSessionRoot(): any {
  if (!_sessionRoot) return null;
  // Return a facade that uses cached refs
  return {
    ...(_sessionRoot),
    tokens: _cachedTokens ?? _sessionRoot.tokens,
    regions: _cachedRegions ?? _sessionRoot.regions,
    mapObjects: _cachedMapObjects ?? _sessionRoot.mapObjects,
    effects: _cachedEffects ?? _sessionRoot.effects,
    blobs: _cachedBlobs ?? _sessionRoot.blobs,
    _owner: _cachedGroup ?? _sessionRoot._owner,
    get $jazz() { return _sessionRoot.$jazz; },
  };
}

// ── DO kinds to sync via blob (excludes fine-grained kinds) ──

const BLOB_SYNC_KINDS = [
  'maps', 'groups', 'initiative', 'roles', 'visionProfiles',
  'fog', 'lights', 'illumination', 'dungeon', 'creatures',
  'hatching', 'actions', 'dice',
];

// Kinds excluded from blob sync (fine-grained CoValue sync):
// - 'tokens', 'regions', 'mapObjects', 'effects'
// Per-user (not synced): 'cards', 'viewportTransforms'

// ══════════════════════════════════════════════════════════════════════════
// TOKEN BRIDGE HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Convert a Zustand Token to a JazzToken-compatible init object */
function tokenToJazzInit(t: Token): Record<string, any> {
  // Complex nested structures stay in extras
  const extras: Record<string, unknown> = {};
  if (t.illuminationSources?.length) extras.illuminationSources = t.illuminationSources;
  if (t.entityRef) extras.entityRef = t.entityRef;
  if (t.appearanceVariants?.length) extras.appearanceVariants = t.appearanceVariants;
  if (t.activeVariantId) extras.activeVariantId = t.activeVariantId;

  return {
    tokenId: t.id,
    x: t.x,
    y: t.y,
    color: t.color || "#666",
    label: t.label || "",
    name: t.name || "",
    gridWidth: t.gridWidth,
    gridHeight: t.gridHeight,
    mapId: t.mapId,
    // Promoted first-class fields:
    hp: (t as any).hp,
    maxHp: (t as any).maxHp,
    ac: (t as any).ac,
    hostility: (t as any).hostility,
    imageHash: t.imageHash,
    roleId: t.roleId || undefined,
    isHidden: t.isHidden || undefined,
    labelPosition: t.labelPosition || undefined,
    labelColor: t.labelColor,
    labelBackgroundColor: t.labelBackgroundColor,
    initiative: t.initiative,
    inCombat: t.inCombat || undefined,
    pathStyle: t.pathStyle,
    pathColor: t.pathColor,
    pathWeight: t.pathWeight,
    pathOpacity: t.pathOpacity,
    pathGaitWidth: t.pathGaitWidth,
    footprintType: t.footprintType,
    locked: (t as any).locked || undefined,
    notes: t.notes,
    statBlockJson: t.statBlockJson,
    quickReferenceUrl: t.quickReferenceUrl,
    extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : undefined,
  };
}

/** Convert a JazzToken CoValue (as any) to a Zustand Token */
function jazzToZustandToken(jt: any): Token {
  let extras: Record<string, any> = {};
  try {
    if (jt.extras) extras = JSON.parse(jt.extras);
  } catch { /* invalid JSON */ }

  return {
    id: jt.tokenId,
    name: jt.name || "",
    imageUrl: "",
    imageHash: jt.imageHash || extras.imageHash,
    x: jt.x,
    y: jt.y,
    gridWidth: jt.gridWidth,
    gridHeight: jt.gridHeight,
    label: jt.label || "",
    labelPosition: jt.labelPosition || extras.labelPosition || "below",
    labelColor: jt.labelColor || extras.labelColor,
    labelBackgroundColor: jt.labelBackgroundColor || extras.labelBackgroundColor,
    roleId: jt.roleId || extras.roleId || "",
    isHidden: jt.isHidden ?? extras.isHidden ?? false,
    color: jt.color,
    mapId: jt.mapId,
    initiative: jt.initiative ?? extras.initiative,
    inCombat: jt.inCombat ?? extras.inCombat,
    pathStyle: jt.pathStyle || extras.pathStyle,
    pathColor: jt.pathColor || extras.pathColor,
    pathWeight: jt.pathWeight ?? extras.pathWeight,
    pathOpacity: jt.pathOpacity ?? extras.pathOpacity,
    pathGaitWidth: jt.pathGaitWidth ?? extras.pathGaitWidth,
    footprintType: jt.footprintType || extras.footprintType,
    notes: jt.notes || extras.notes,
    statBlockJson: jt.statBlockJson,
    quickReferenceUrl: jt.quickReferenceUrl,
    illuminationSources: extras.illuminationSources,
    entityRef: extras.entityRef,
    appearanceVariants: extras.appearanceVariants,
    activeVariantId: extras.activeVariantId,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// REGION BRIDGE HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Convert a Zustand CanvasRegion to a JazzRegion-compatible init object */
function regionToJazzInit(r: CanvasRegion): Record<string, any> {
  return {
    regionId: r.id,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    color: r.color,
    gridType: r.gridType,
    gridSize: r.gridSize,
    gridScale: r.gridScale,
    gridSnapping: r.gridSnapping,
    gridVisible: r.gridVisible,
    textureHash: r.textureHash,
    backgroundRepeat: r.backgroundRepeat,
    backgroundScale: r.backgroundScale,
    backgroundOffsetX: r.backgroundOffsetX,
    backgroundOffsetY: r.backgroundOffsetY,
    backgroundColor: r.backgroundColor,
    regionType: r.regionType,
    rotation: r.rotation,
    locked: r.locked,
    mapId: r.mapId,
    smoothing: r.smoothing,
    pathPointsJson: r.pathPoints ? JSON.stringify(r.pathPoints) : undefined,
    bezierControlPointsJson: r.bezierControlPoints ? JSON.stringify(r.bezierControlPoints) : undefined,
    rotationCenterJson: r.rotationCenter ? JSON.stringify(r.rotationCenter) : undefined,
  };
}

/** Convert a JazzRegion CoValue (as any) to a Zustand CanvasRegion */
function jazzToZustandRegion(jr: any): CanvasRegion {
  let pathPoints: { x: number; y: number }[] | undefined;
  let bezierControlPoints: any[] | undefined;
  let rotationCenter: { x: number; y: number } | undefined;
  try { if (jr.pathPointsJson) pathPoints = JSON.parse(jr.pathPointsJson); } catch { /* */ }
  try { if (jr.bezierControlPointsJson) bezierControlPoints = JSON.parse(jr.bezierControlPointsJson); } catch { /* */ }
  try { if (jr.rotationCenterJson) rotationCenter = JSON.parse(jr.rotationCenterJson); } catch { /* */ }

  return {
    id: jr.regionId,
    x: jr.x,
    y: jr.y,
    width: jr.width,
    height: jr.height,
    selected: false,
    color: jr.color,
    gridType: jr.gridType as any,
    gridSize: jr.gridSize,
    gridScale: jr.gridScale,
    gridSnapping: jr.gridSnapping,
    gridVisible: jr.gridVisible,
    backgroundImage: "", // Texture loaded from IndexedDB via textureHash
    textureHash: jr.textureHash,
    backgroundRepeat: jr.backgroundRepeat,
    backgroundScale: jr.backgroundScale,
    backgroundOffsetX: jr.backgroundOffsetX,
    backgroundOffsetY: jr.backgroundOffsetY,
    backgroundColor: jr.backgroundColor,
    regionType: jr.regionType,
    rotation: jr.rotation,
    locked: jr.locked,
    mapId: jr.mapId,
    smoothing: jr.smoothing,
    pathPoints,
    bezierControlPoints,
    rotationCenter,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// MAP OBJECT BRIDGE HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Convert a Zustand MapObject to a JazzMapObject-compatible init object */
function mapObjectToJazzInit(obj: MapObject): Record<string, any> {
  return {
    objectId: obj.id,
    positionX: obj.position.x,
    positionY: obj.position.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
    shape: obj.shape,
    fillColor: obj.fillColor,
    strokeColor: obj.strokeColor,
    strokeWidth: obj.strokeWidth,
    opacity: obj.opacity,
    imageHash: obj.imageHash,
    textureScale: obj.textureScale,
    textureOffsetX: obj.textureOffsetX,
    textureOffsetY: obj.textureOffsetY,
    castsShadow: obj.castsShadow,
    blocksMovement: obj.blocksMovement,
    blocksVision: obj.blocksVision,
    revealedByLight: obj.revealedByLight,
    isOpen: obj.isOpen,
    doorType: obj.doorType,
    label: obj.label,
    category: obj.category,
    locked: obj.locked,
    renderOrder: obj.renderOrder,
    mapId: obj.mapId,
    portalName: obj.portalName,
    portalTargetId: obj.portalTargetId,
    portalHiddenInPlay: obj.portalHiddenInPlay,
    portalAutoActivateTarget: obj.portalAutoActivateTarget,
    annotationText: obj.annotationText,
    annotationReference: obj.annotationReference,
    terrainFeatureId: obj.terrainFeatureId,
    lightColor: obj.lightColor,
    lightRadius: obj.lightRadius,
    lightBrightRadius: obj.lightBrightRadius,
    lightIntensity: obj.lightIntensity,
    lightEnabled: obj.lightEnabled,
    customPathJson: obj.customPath ? JSON.stringify(obj.customPath) : undefined,
    wallPointsJson: obj.wallPoints ? JSON.stringify(obj.wallPoints) : undefined,
    doorDirectionJson: obj.doorDirection ? JSON.stringify(obj.doorDirection) : undefined,
  };
}

/** Convert a JazzMapObject CoValue (as any) to a Zustand MapObject */
function jazzToZustandMapObject(jmo: any): MapObject {
  let customPath: { x: number; y: number }[] | undefined;
  let wallPoints: { x: number; y: number }[] | undefined;
  let doorDirection: { x: number; y: number } | undefined;
  try { if (jmo.customPathJson) customPath = JSON.parse(jmo.customPathJson); } catch { /* */ }
  try { if (jmo.wallPointsJson) wallPoints = JSON.parse(jmo.wallPointsJson); } catch { /* */ }
  try { if (jmo.doorDirectionJson) doorDirection = JSON.parse(jmo.doorDirectionJson); } catch { /* */ }

  return {
    id: jmo.objectId,
    position: { x: jmo.positionX, y: jmo.positionY },
    width: jmo.width,
    height: jmo.height,
    rotation: jmo.rotation,
    shape: jmo.shape as any,
    fillColor: jmo.fillColor,
    strokeColor: jmo.strokeColor,
    strokeWidth: jmo.strokeWidth,
    opacity: jmo.opacity,
    imageUrl: "", // Texture loaded from IndexedDB via imageHash
    imageHash: jmo.imageHash,
    textureScale: jmo.textureScale,
    textureOffsetX: jmo.textureOffsetX,
    textureOffsetY: jmo.textureOffsetY,
    castsShadow: jmo.castsShadow,
    blocksMovement: jmo.blocksMovement,
    blocksVision: jmo.blocksVision,
    revealedByLight: jmo.revealedByLight,
    isOpen: jmo.isOpen,
    doorType: jmo.doorType,
    label: jmo.label,
    category: jmo.category as any,
    locked: jmo.locked,
    renderOrder: jmo.renderOrder,
    mapId: jmo.mapId,
    portalName: jmo.portalName,
    portalTargetId: jmo.portalTargetId,
    portalHiddenInPlay: jmo.portalHiddenInPlay,
    portalAutoActivateTarget: jmo.portalAutoActivateTarget,
    annotationText: jmo.annotationText,
    annotationReference: jmo.annotationReference,
    terrainFeatureId: jmo.terrainFeatureId,
    lightColor: jmo.lightColor,
    lightRadius: jmo.lightRadius,
    lightBrightRadius: jmo.lightBrightRadius,
    lightIntensity: jmo.lightIntensity,
    lightEnabled: jmo.lightEnabled,
    customPath,
    wallPoints,
    doorDirection,
    selected: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// EFFECT BRIDGE HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Strip large data URIs from a template for sync */
function stripTemplateForSync(t: any): any {
  if (!t) return t;
  const copy = { ...t };
  if (copy.texture && copy.texture.length > 200) copy.texture = '';
  if (copy.icon && typeof copy.icon === 'string' && copy.icon.length > 200) copy.icon = '';
  return copy;
}

/** Convert a PlacedEffect to a JazzPlacedEffect-compatible init */
function placedEffectToJazzInit(e: PlacedEffect): Record<string, any> {
  return {
    effectId: e.id,
    templateId: e.templateId,
    originX: e.origin.x,
    originY: e.origin.y,
    direction: e.direction,
    casterId: e.casterId,
    mapId: e.mapId,
    castLevel: e.castLevel,
    roundsRemaining: e.roundsRemaining,
    groupId: e.groupId,
    animationPaused: e.animationPaused,
    isAura: e.isAura,
    anchorTokenId: e.anchorTokenId,
    recurring: e.template?.recurring,
    impactedTargetsJson: e.impactedTargets?.length ? JSON.stringify(e.impactedTargets) : undefined,
    triggeredTokenIdsJson: e.triggeredTokenIds?.length ? JSON.stringify(e.triggeredTokenIds) : undefined,
    tokensInsideAreaJson: e.tokensInsideArea?.length ? JSON.stringify(e.tokensInsideArea) : undefined,
    waypointsJson: e.waypoints?.length ? JSON.stringify(e.waypoints) : undefined,
  };
}

/** Convert a JazzPlacedEffect CoValue to a partial PlacedEffect (template reconstructed separately) */
function jazzToZustandPlacedEffect(je: any, templateLookup: (id: string, castLevel?: number) => EffectTemplate | undefined): PlacedEffect | null {
  const template = templateLookup(je.templateId, je.castLevel);
  if (!template) {
    console.warn(`[jazz-bridge] Could not reconstruct template for effect ${je.effectId} (templateId: ${je.templateId})`);
    return null;
  }

  let impactedTargets: any[] = [];
  let triggeredTokenIds: string[] = [];
  let tokensInsideArea: string[] | undefined;
  let waypoints: { x: number; y: number }[] | undefined;
  try { if (je.impactedTargetsJson) impactedTargets = JSON.parse(je.impactedTargetsJson); } catch { /* */ }
  try { if (je.triggeredTokenIdsJson) triggeredTokenIds = JSON.parse(je.triggeredTokenIdsJson); } catch { /* */ }
  try { if (je.tokensInsideAreaJson) tokensInsideArea = JSON.parse(je.tokensInsideAreaJson); } catch { /* */ }
  try { if (je.waypointsJson) waypoints = JSON.parse(je.waypointsJson); } catch { /* */ }

  // Apply recurring override if set
  const finalTemplate = je.recurring !== undefined && je.recurring !== null
    ? { ...template, recurring: je.recurring }
    : template;

  return {
    id: je.effectId,
    templateId: je.templateId,
    template: finalTemplate,
    origin: { x: je.originX, y: je.originY },
    direction: je.direction,
    casterId: je.casterId,
    placedAt: performance.now(),
    roundsRemaining: je.roundsRemaining,
    mapId: je.mapId,
    castLevel: je.castLevel,
    animationPaused: je.animationPaused,
    impactedTargets,
    triggeredTokenIds,
    tokensInsideArea,
    groupId: je.groupId,
    waypoints,
    anchorTokenId: je.anchorTokenId,
    isAura: je.isAura,
  };
}

/** Build a template lookup function using custom templates + built-ins */
function buildTemplateLookup(customTemplates: EffectTemplate[]): (id: string, castLevel?: number) => EffectTemplate | undefined {
  const customById = new Map<string, EffectTemplate>();
  for (const t of customTemplates) {
    if (t?.id) customById.set(t.id, t);
  }
  return (id: string, castLevel?: number) => {
    const base = customById.get(id) ?? getBuiltInTemplate(id);
    if (!base) return undefined;
    return computeScaledTemplate(base, castLevel);
  };
}

// ══════════════════════════════════════════════════════════════════════════
// BLOB SYNC HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Hash tracking to avoid re-pushing unchanged blob state */
const _lastPushedHash = new Map<string, string>();

/** Simple hash for change detection */
function quickHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

/** Find blob index in session root by kind */
function findBlobIndex(kind: string): number {
  const blobs = _cachedBlobs ?? _sessionRoot?.blobs;
  if (!blobs) return -1;
  const len = blobs.length ?? 0;
  for (let i = 0; i < len; i++) {
    const b = blobs[i];
    if (b && b.kind === kind) return i;
  }
  return -1;
}

/** Push a single DO kind's state to Jazz as a blob */
function pushBlobToJazz(kind: string): void {
  const blobs = _cachedBlobs ?? _sessionRoot?.blobs;
  if (!blobs) return;
  const reg = DurableObjectRegistry.get(kind);
  if (!reg) return;

  try {
    let state = reg.extractor();

    // Effects now use fine-grained sync — no blob stripping needed
    const json = JSON.stringify(state);
    const hash = quickHash(json);

    // Skip if unchanged
    if (_lastPushedHash.get(kind) === hash) return;

    // Guard: Jazz has a 1MB transaction limit
    const JAZZ_MAX_BYTES = 1_000_000;
    if (json.length > JAZZ_MAX_BYTES) {
      const now = Date.now();
      if (!_lastSkipWarn.has(kind) || now - _lastSkipWarn.get(kind)! > 30000) {
        console.warn(`[jazz-bridge] ⚠️ Blob "${kind}" too large for Jazz sync (${(json.length / 1024 / 1024).toFixed(1)}MB > 1MB) — skipping`);
        _lastSkipWarn.set(kind, now);
      }
      return;
    }

    _lastPushedHash.set(kind, hash);

    const group = _cachedGroup ?? _sessionRoot?.$jazz?.owner ?? _sessionRoot?._owner;
    const idx = findBlobIndex(kind);

    if (idx >= 0) {
      // Update existing blob
      const blob = blobs[idx];
      try {
        blob.$jazz.set("state", json);
        blob.$jazz.set("version", reg.version);
        blob.$jazz.set("updatedAt", new Date().toISOString());
      } catch (err) {
        console.error(`[jazz-bridge] Failed to update blob ${kind}:`, err);
      }
    } else {
      // Create new blob
      try {
        const blob = JazzDOBlobSchema.create({
          kind,
          version: reg.version,
          state: json,
          updatedAt: new Date().toISOString(),
        } as any, group);
        blobs.$jazz.push(blob);
      } catch (err) {
        console.error(`[jazz-bridge] Failed to create blob ${kind}:`, err);
      }
    }
    console.log(`[jazz-bridge] → Jazz blob: ${kind} (${json.length} chars)`);
  } catch (err) {
    console.error(`[jazz-bridge] Blob push error for ${kind}:`, err);
  }
}

/** Pull a single blob from Jazz into Zustand via the DO hydrator */
function pullBlobFromJazz(kind: string, stateJson: string): void {
  const reg = DurableObjectRegistry.get(kind);
  if (!reg) {
    console.warn(`[jazz-bridge] Unknown DO kind in blob: ${kind}`);
    return;
  }

  try {
    const state = JSON.parse(stateJson);
    const hash = quickHash(stateJson);

    // ── Guard against destructive hydration (creator only) ──
    if (_isCreator) {
      const inboundEmpty = isEmptyState(state);
      if (inboundEmpty) {
        const localState = reg.extractor();
        const localEmpty = isEmptyState(localState);
        if (!localEmpty) {
          console.warn(`[jazz-bridge] ✋ Blocked destructive hydration for "${kind}" — inbound is empty but local has data (creator guard)`);
          return;
        }
      }
    }

    _lastPushedHash.set(kind, hash); // prevent echo

    runFromJazz(() => {
      reg.hydrator(state);
    });
    console.log(`[jazz-bridge] ← Jazz blob: ${kind}`);
  } catch (err) {
    console.error(`[jazz-bridge] Blob pull error for ${kind}:`, err);
  }
}

/** Heuristic: check if a state object is "empty" */
function isEmptyState(state: unknown): boolean {
  if (state == null) return true;
  if (Array.isArray(state)) return state.length === 0;
  if (typeof state === 'object') {
    const values = Object.values(state as Record<string, unknown>);
    if (values.length === 0) return true;
    return values.every(v =>
      v == null ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === 'object' && !Array.isArray(v) && v !== null && Object.keys(v).length === 0) ||
      v === false || v === 0 || v === ''
    );
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════
// PUSH: Zustand → Jazz
// ══════════════════════════════════════════════════════════════════════════

/** Build a Set of existing tokenIds in a Jazz CoList */
function _getJazzTokenIds(jazzTokens: any): Set<string> {
  const ids = new Set<string>();
  const len = jazzTokens?.length ?? 0;
  for (let i = 0; i < len; i++) {
    const jt = jazzTokens[i];
    if (jt?.tokenId) ids.add(jt.tokenId);
  }
  return ids;
}

/** Push all current tokens from Zustand into Jazz (upsert — no duplicates) */
export function pushTokensToJazz(sessionRoot: any): void {
  const tokens = useSessionStore.getState().tokens;
  const jazzTokens = sessionRoot.tokens;
  if (!jazzTokens) {
    console.warn("[jazz-bridge] No tokens list on session root");
    return;
  }

  const existingIds = _getJazzTokenIds(jazzTokens);
  console.log(`[jazz-bridge] Pushing ${tokens.length} tokens to Jazz (${existingIds.size} already exist)`);
  const group = sessionRoot.$jazz?.owner ?? sessionRoot._owner ?? sessionRoot.$jazz?.group;

  for (const t of tokens) {
    if (existingIds.has(t.id)) {
      // Upsert: update existing entry instead of creating a duplicate
      const len = jazzTokens.length ?? 0;
      for (let i = 0; i < len; i++) {
        const jt = jazzTokens[i];
        if (jt && jt.tokenId === t.id) {
          try {
            const init = tokenToJazzInit(t);
            for (const [key, val] of Object.entries(init)) {
              if (key !== 'tokenId') jt.$jazz.set(key, val ?? undefined);
            }
          } catch (err) {
            console.error(`[jazz-bridge] Failed to upsert JazzToken ${t.id}:`, err);
          }
          break;
        }
      }
    } else {
      const init = tokenToJazzInit(t);
      try {
        const jt = JazzTokenSchema.create(init as any, group);
        jazzTokens.$jazz.push(jt);
        existingIds.add(t.id); // Track so subsequent dupes in same batch are caught
      } catch (err) {
        console.error(`[jazz-bridge] Failed to create/push JazzToken ${t.id}:`, err);
      }
    }
  }
}

/** Push all current regions from Zustand into Jazz */
export function pushRegionsToJazz(sessionRoot: any): void {
  const regions = useRegionStore.getState().regions;
  let jazzRegions = sessionRoot.regions;
  const group = sessionRoot.$jazz?.owner ?? sessionRoot._owner ?? sessionRoot.$jazz?.group;

  // Lazily create regions list for legacy sessions
  if (!jazzRegions && group) {
    try {
      jazzRegions = JazzRegionList.create([], group);
      sessionRoot.$jazz.set("regions", jazzRegions);
    } catch (err) {
      console.warn("[jazz-bridge] Could not create regions list:", err);
      return;
    }
  }
  if (!jazzRegions) {
    console.warn("[jazz-bridge] No regions list on session root");
    return;
  }

  console.log(`[jazz-bridge] Pushing ${regions.length} regions to Jazz`);

  for (const r of regions) {
    const init = regionToJazzInit(r);
    try {
      const jr = JazzRegionSchema.create(init as any, group);
      jazzRegions.$jazz.push(jr);
    } catch (err) {
      console.error(`[jazz-bridge] Failed to create/push JazzRegion ${r.id}:`, err);
    }
  }
}

/** Push all current map objects from Zustand into Jazz */
export function pushMapObjectsToJazz(sessionRoot: any): void {
  const mapObjects = useMapObjectStore.getState().mapObjects;
  let jazzMapObjects = sessionRoot.mapObjects;
  const group = sessionRoot.$jazz?.owner ?? sessionRoot._owner ?? sessionRoot.$jazz?.group;

  // Lazily create mapObjects list for legacy sessions
  if (!jazzMapObjects && group) {
    try {
      jazzMapObjects = JazzMapObjectList.create([], group);
      sessionRoot.$jazz.set("mapObjects", jazzMapObjects);
    } catch (err) {
      console.warn("[jazz-bridge] Could not create mapObjects list:", err);
      return;
    }
  }
  if (!jazzMapObjects) {
    console.warn("[jazz-bridge] No mapObjects list on session root");
    return;
  }

  console.log(`[jazz-bridge] Pushing ${mapObjects.length} map objects to Jazz`);

  for (const obj of mapObjects) {
    const init = mapObjectToJazzInit(obj);
    try {
      const jmo = JazzMapObjectSchema.create(init as any, group);
      jazzMapObjects.$jazz.push(jmo);
    } catch (err) {
      console.error(`[jazz-bridge] Failed to create/push JazzMapObject ${obj.id}:`, err);
    }
  }
}

/** Push all DO blob states to Jazz */
export function pushBlobsToJazz(sessionRoot: any): void {
  const group = sessionRoot.$jazz?.owner ?? sessionRoot._owner ?? sessionRoot.$jazz?.group;

  if (!sessionRoot.blobs) {
    console.warn("[jazz-bridge] No blobs list on session root");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const kind of BLOB_SYNC_KINDS) {
    const reg = DurableObjectRegistry.get(kind);
    if (!reg) {
      failCount++;
      continue;
    }

    try {
      let state = reg.extractor();

      // Effects use fine-grained sync — no blob stripping needed

      const json = JSON.stringify(state);
      _lastPushedHash.set(kind, quickHash(json));

      // Check for existing blob of this kind to avoid duplicates
      const blobs = sessionRoot.blobs;
      const blobLen = blobs.length ?? 0;
      let existingIdx = -1;
      for (let i = 0; i < blobLen; i++) {
        if (blobs[i]?.kind === kind) { existingIdx = i; break; }
      }

      if (existingIdx >= 0) {
        const existing = blobs[existingIdx];
        try {
          existing.$jazz.set("state", json);
          existing.$jazz.set("version", reg.version);
          existing.$jazz.set("updatedAt", new Date().toISOString());
        } catch (err) {
          console.error(`[jazz-bridge] Failed to update existing blob ${kind}:`, err);
        }
      } else {
        const blob = JazzDOBlobSchema.create({
          kind,
          version: reg.version,
          state: json,
          updatedAt: new Date().toISOString(),
        } as any, group);
        sessionRoot.blobs.$jazz.push(blob);
      }
      successCount++;
      console.log(`[jazz-bridge] → Jazz blob: ${kind} (${json.length} chars)`);
    } catch (err) {
      failCount++;
      console.error(`[jazz-bridge] Failed to push blob ${kind}:`, err);
    }
  }

  // ── Diagnostic: blob size report ──
  const MB = 1024 * 1024;
  const sizeEntries = Array.from(_lastPushedHash.entries()).map(([k]) => {
    // Re-extract to measure (cheap since we just did it)
    const reg = DurableObjectRegistry.get(k);
    if (!reg) return null;
    try {
      const bytes = new Blob([JSON.stringify(reg.extractor())]).size;
      const pct = ((bytes / MB) * 100).toFixed(1);
      const warn = bytes > 0.75 * MB ? ' ⚠️ APPROACHING 1MB LIMIT' : bytes > MB ? ' 🚨 OVER 1MB LIMIT' : '';
      return { kind: k, bytes, pct, warn };
    } catch { return null; }
  }).filter(Boolean) as { kind: string; bytes: number; pct: string; warn: string }[];

  if (sizeEntries.length > 0) {
    console.groupCollapsed(`[jazz-bridge] Blob size report (${successCount}/${BLOB_SYNC_KINDS.length} pushed, ${failCount} failed)`);
    sizeEntries
      .sort((a, b) => b.bytes - a.bytes)
      .forEach(e => console.log(`  ${e.kind}: ${(e.bytes / 1024).toFixed(1)} KB (${e.pct}% of 1MB)${e.warn}`));
    console.groupEnd();
  } else {
    console.log(`[jazz-bridge] Pushed ${successCount}/${BLOB_SYNC_KINDS.length} DO blobs (${failCount} failed)`);
  }
}

/** Push all effects (placed + custom templates) from Zustand into Jazz */
export function pushEffectsToJazz(sessionRoot: any): void {
  const group = sessionRoot.$jazz?.owner ?? sessionRoot._owner ?? sessionRoot.$jazz?.group;
  let effectState = sessionRoot.effects;

  // Lazily create effects container for legacy sessions
  if (!effectState && group) {
    try {
      const placedEffects = JazzPlacedEffectList.create([], group);
      const customTemplates = JazzCustomTemplateList.create([], group);
      effectState = JazzEffectState.create({ placedEffects, customTemplates }, group);
      sessionRoot.$jazz.set("effects", effectState);
    } catch (err) {
      console.warn("[jazz-bridge] Could not create effects container:", err);
      return;
    }
  }
  if (!effectState) {
    console.warn("[jazz-bridge] No effects container on session root");
    return;
  }

  const store = useEffectStore.getState();

  // Push custom templates (stripped of large data)
  console.log(`[jazz-bridge] Pushing ${store.customTemplates.length} custom templates to Jazz`);
  for (const t of store.customTemplates) {
    const stripped = stripTemplateForSync(t);
    try {
      const jt = JazzCustomTemplateSchema.create({
        templateId: t.id,
        templateJson: JSON.stringify(stripped),
      } as any, group);
      effectState.customTemplates.$jazz.push(jt);
    } catch (err) {
      console.error(`[jazz-bridge] Failed to push custom template ${t.id}:`, err);
    }
  }

  // Push placed effects (no template snapshot — reconstructed on pull)
  const activePlaced = store.placedEffects.filter(e => !e.dismissedAt);
  console.log(`[jazz-bridge] Pushing ${activePlaced.length} placed effects to Jazz`);
  for (const e of activePlaced) {
    const init = placedEffectToJazzInit(e);
    try {
      const je = JazzPlacedEffectSchema.create(init as any, group);
      effectState.placedEffects.$jazz.push(je);
    } catch (err) {
      console.error(`[jazz-bridge] Failed to push placed effect ${e.id}:`, err);
    }
  }
}

/** Push all current Zustand state into Jazz CoValues */
export function pushAllToJazz(sessionRoot: any): void {
  pushTokensToJazz(sessionRoot);
  pushRegionsToJazz(sessionRoot);
  pushMapObjectsToJazz(sessionRoot);
  pushEffectsToJazz(sessionRoot);
  pushBlobsToJazz(sessionRoot);
}

// ══════════════════════════════════════════════════════════════════════════
// PULL: Jazz → Zustand
// ══════════════════════════════════════════════════════════════════════════

/** Pull all tokens from Jazz into Zustand */
export function pullTokensFromJazz(sessionRoot: any): void {
  const jazzTokens = sessionRoot.tokens;
  if (!jazzTokens) {
    console.warn("[jazz-bridge] No tokens list on session root");
    return;
  }

  const len = jazzTokens.length ?? 0;
  const localTokenCount = useSessionStore.getState().tokens.length;

  if (len === 0 && localTokenCount > 0) {
    console.warn(`[jazz-bridge] ✋ Blocked token pull — Jazz has 0 tokens but local has ${localTokenCount}`);
    return;
  }

  console.log(`[jazz-bridge] Pulling ${len} tokens from Jazz (local had ${localTokenCount})`);

  runFromJazz(() => {
    const store = useSessionStore.getState();
    store.tokens.forEach((t) => store.removeToken(t.id));
    for (let i = 0; i < len; i++) {
      const jt = jazzTokens[i];
      if (jt) store.addToken(jazzToZustandToken(jt));
    }
  });
}

/** Pull all regions from Jazz into Zustand */
export function pullRegionsFromJazz(sessionRoot: any): void {
  const jazzRegions = sessionRoot.regions;
  if (!jazzRegions) {
    console.log("[jazz-bridge] No regions list on session root (legacy session)");
    return;
  }

  const len = jazzRegions.length ?? 0;
  const localCount = useRegionStore.getState().regions.length;

  if (len === 0 && localCount > 0 && _isCreator) {
    console.warn(`[jazz-bridge] ✋ Blocked region pull — Jazz has 0 but local has ${localCount} (creator guard)`);
    return;
  }

  console.log(`[jazz-bridge] Pulling ${len} regions from Jazz (local had ${localCount})`);

  runFromJazz(() => {
    const store = useRegionStore.getState();
    store.clearRegions();
    for (let i = 0; i < len; i++) {
      const jr = jazzRegions[i];
      if (jr) store.addRegion(jazzToZustandRegion(jr));
    }
  });
}

/** Pull all map objects from Jazz into Zustand */
export function pullMapObjectsFromJazz(sessionRoot: any): void {
  const jazzMapObjects = sessionRoot.mapObjects;
  if (!jazzMapObjects) {
    console.log("[jazz-bridge] No mapObjects list on session root (legacy session)");
    return;
  }

  const len = jazzMapObjects.length ?? 0;
  const localCount = useMapObjectStore.getState().mapObjects.length;

  if (len === 0 && localCount > 0 && _isCreator) {
    console.warn(`[jazz-bridge] ✋ Blocked mapObject pull — Jazz has 0 but local has ${localCount} (creator guard)`);
    return;
  }

  console.log(`[jazz-bridge] Pulling ${len} map objects from Jazz (local had ${localCount})`);

  runFromJazz(() => {
    const store = useMapObjectStore.getState();
    store.clearMapObjects();
    for (let i = 0; i < len; i++) {
      const jmo = jazzMapObjects[i];
      if (jmo) store.addMapObject(jazzToZustandMapObject(jmo));
    }
  });
}

/** Pull all DO blobs from Jazz into Zustand */
export function pullBlobsFromJazz(sessionRoot: any): void {
  if (!sessionRoot.blobs) {
    console.warn("[jazz-bridge] No blobs list on session root");
    return;
  }

  const len = sessionRoot.blobs.length ?? 0;
  console.log(`[jazz-bridge] Pulling ${len} DO blobs from Jazz`);

  // Deduplicate by kind — keep only the blob with the latest updatedAt
  const latestByKind = new Map<string, { state: string; updatedAt: string }>();
  for (let i = 0; i < len; i++) {
    const blob = sessionRoot.blobs[i];
    if (!blob || !blob.kind || !blob.state) continue;
    // Skip kinds that are now fine-grained (no longer blob-synced)
    if (!BLOB_SYNC_KINDS.includes(blob.kind)) continue;
    const existing = latestByKind.get(blob.kind);
    if (!existing || (blob.updatedAt && (!existing.updatedAt || blob.updatedAt > existing.updatedAt))) {
      latestByKind.set(blob.kind, { state: blob.state, updatedAt: blob.updatedAt ?? '' });
    }
  }

  console.log(`[jazz-bridge] Deduplicated ${len} blobs to ${latestByKind.size} unique kinds`);
  for (const [kind, { state }] of latestByKind) {
    pullBlobFromJazz(kind, state);
  }
}

/** Pull all effects from Jazz into Zustand */
export function pullEffectsFromJazz(sessionRoot: any): void {
  const effectState = sessionRoot.effects;
  if (!effectState) {
    console.log("[jazz-bridge] No effects container on session root (legacy session)");
    return;
  }

  // Pull custom templates first (needed for template reconstruction)
  const jazzCustomTemplates = effectState.customTemplates;
  const customTemplates: EffectTemplate[] = [];
  if (jazzCustomTemplates) {
    const ctLen = jazzCustomTemplates.length ?? 0;
    for (let i = 0; i < ctLen; i++) {
      const jct = jazzCustomTemplates[i];
      if (!jct?.templateJson) continue;
      try {
        const parsed = JSON.parse(jct.templateJson);
        customTemplates.push(parsed);
      } catch { /* invalid JSON */ }
    }
  }

  // Pull placed effects
  const jazzPlaced = effectState.placedEffects;
  const placedLen = jazzPlaced?.length ?? 0;
  const localPlacedCount = useEffectStore.getState().placedEffects.length;

  if (placedLen === 0 && customTemplates.length === 0 && localPlacedCount > 0 && _isCreator) {
    console.warn(`[jazz-bridge] ✋ Blocked effects pull — Jazz has 0 but local has ${localPlacedCount} (creator guard)`);
    return;
  }

  console.log(`[jazz-bridge] Pulling ${customTemplates.length} custom templates, ${placedLen} placed effects from Jazz`);

  const lookup = buildTemplateLookup(customTemplates);

  runFromJazz(() => {
    const store = useEffectStore.getState();
    // Clear existing
    const mapIds = new Set(store.placedEffects.map(e => e.mapId));
    mapIds.forEach(id => store.clearEffectsForMap(id));

    // Restore custom templates
    for (const t of customTemplates) {
      store.addCustomTemplate(t);
    }

    // Restore placed effects
    const restored: PlacedEffect[] = [];
    for (let i = 0; i < placedLen; i++) {
      const je = jazzPlaced[i];
      if (!je) continue;
      const effect = jazzToZustandPlacedEffect(je, lookup);
      if (effect) restored.push(effect);
    }
    if (restored.length > 0) {
      useEffectStore.setState({ placedEffects: restored });
    }
  });
}

/** Pull all Jazz CoValue state into Zustand stores */
export function pullAllFromJazz(sessionRoot: any): void {
  pullTokensFromJazz(sessionRoot);
  pullRegionsFromJazz(sessionRoot);
  pullMapObjectsFromJazz(sessionRoot);
  pullEffectsFromJazz(sessionRoot);
  pullBlobsFromJazz(sessionRoot);
}

// ══════════════════════════════════════════════════════════════════════════
// STORE SUBSCRIPTIONS FOR BLOB SYNC
// ══════════════════════════════════════════════════════════════════════════

/** Map of DO kind → the Zustand store to subscribe to */
const STORE_FOR_KIND: Record<string, () => any> = {
  maps: () => useMapStore,
  groups: () => useGroupStore,
  initiative: () => useInitiativeStore,
  roles: () => useRoleStore,
  visionProfiles: () => useVisionProfileStore,
  fog: () => useFogStore,
  lights: () => useLightStore,
  illumination: () => useIlluminationStore,
  dungeon: () => useDungeonStore,
  creatures: () => useCreatureStore,
  hatching: () => useHatchingStore,
  actions: () => useActionStore,
  dice: () => useDiceStore,
};

/** Throttle timers per kind */
const _throttleTimers = new Map<string, number>();
const BLOB_THROTTLE_MS = 1000; // 1Hz max per kind

function throttledPushBlob(kind: string): void {
  if (_throttleTimers.has(kind)) return;
  _throttleTimers.set(kind, window.setTimeout(() => {
    _throttleTimers.delete(kind);
    pushBlobToJazz(kind);
  }, BLOB_THROTTLE_MS));
}

// ══════════════════════════════════════════════════════════════════════════
// FINE-GRAINED SYNC HELPERS (regions & mapObjects outbound)
// ══════════════════════════════════════════════════════════════════════════

const FINE_GRAINED_THROTTLE_MS = 1000;
const _fineGrainedTimers = new Map<string, number>();

function throttledPushFineGrained(kind: string, fn: () => void): void {
  if (_fineGrainedTimers.has(kind)) return;
  _fineGrainedTimers.set(kind, window.setTimeout(() => {
    _fineGrainedTimers.delete(kind);
    fn();
  }, FINE_GRAINED_THROTTLE_MS));
}

/** Sync regions from Zustand → Jazz (diff-based) */
function syncRegionsToJazz(regions: CanvasRegion[], prevRegions: CanvasRegion[]): void {
  const jazzRegions = _cachedRegions ?? _sessionRoot?.regions;
  if (!jazzRegions) return;
  const group = _cachedGroup ?? _sessionRoot?.$jazz?.owner ?? _sessionRoot?._owner;

  const prevIds = new Set(prevRegions.map(r => r.id));
  const currentIds = new Set(regions.map(r => r.id));

  // Added
  for (const r of regions) {
    if (!prevIds.has(r.id)) {
      try {
        const jr = JazzRegionSchema.create(regionToJazzInit(r) as any, group);
        jazzRegions.$jazz.push(jr);
      } catch (err) {
        console.error(`[jazz-bridge] Failed to push new region ${r.id}:`, err);
      }
    }
  }

  // Updated
  for (const r of regions) {
    if (prevIds.has(r.id)) {
      const prev = prevRegions.find(pr => pr.id === r.id);
      if (!prev || JSON.stringify(regionToJazzInit(r)) === JSON.stringify(regionToJazzInit(prev))) continue;
      const len = jazzRegions.length ?? 0;
      for (let i = 0; i < len; i++) {
        const jr = jazzRegions[i];
        if (jr && jr.regionId === r.id) {
          try {
            const init = regionToJazzInit(r);
            for (const [key, val] of Object.entries(init)) {
              if (key !== 'regionId') jr.$jazz.set(key, val ?? undefined);
            }
          } catch (err) {
            console.error(`[jazz-bridge] Failed to update region ${r.id}:`, err);
          }
          break;
        }
      }
    }
  }

  // Removed
  for (const prev of prevRegions) {
    if (!currentIds.has(prev.id)) {
      const len = jazzRegions.length ?? 0;
      for (let i = 0; i < len; i++) {
        const jr = jazzRegions[i];
        if (jr && jr.regionId === prev.id) {
          try { jazzRegions.$jazz.splice(i, 1); } catch (err) {
            console.error(`[jazz-bridge] Failed to remove region ${prev.id}:`, err);
          }
          break;
        }
      }
    }
  }
}

/** Sync map objects from Zustand → Jazz (diff-based) */
function syncMapObjectsToJazz(objects: MapObject[], prevObjects: MapObject[]): void {
  const jazzMapObjects = _cachedMapObjects ?? _sessionRoot?.mapObjects;
  if (!jazzMapObjects) return;
  const group = _cachedGroup ?? _sessionRoot?.$jazz?.owner ?? _sessionRoot?._owner;

  const prevIds = new Set(prevObjects.map(o => o.id));
  const currentIds = new Set(objects.map(o => o.id));

  // Added
  for (const obj of objects) {
    if (!prevIds.has(obj.id)) {
      try {
        const jmo = JazzMapObjectSchema.create(mapObjectToJazzInit(obj) as any, group);
        jazzMapObjects.$jazz.push(jmo);
      } catch (err) {
        console.error(`[jazz-bridge] Failed to push new mapObject ${obj.id}:`, err);
      }
    }
  }

  // Updated
  for (const obj of objects) {
    if (prevIds.has(obj.id)) {
      const prev = prevObjects.find(po => po.id === obj.id);
      if (!prev || JSON.stringify(mapObjectToJazzInit(obj)) === JSON.stringify(mapObjectToJazzInit(prev))) continue;
      const len = jazzMapObjects.length ?? 0;
      for (let i = 0; i < len; i++) {
        const jmo = jazzMapObjects[i];
        if (jmo && jmo.objectId === obj.id) {
          try {
            const init = mapObjectToJazzInit(obj);
            for (const [key, val] of Object.entries(init)) {
              if (key !== 'objectId') jmo.$jazz.set(key, val ?? undefined);
            }
          } catch (err) {
            console.error(`[jazz-bridge] Failed to update mapObject ${obj.id}:`, err);
          }
          break;
        }
      }
    }
  }

  // Removed
  for (const prev of prevObjects) {
    if (!currentIds.has(prev.id)) {
      const len = jazzMapObjects.length ?? 0;
      for (let i = 0; i < len; i++) {
        const jmo = jazzMapObjects[i];
        if (jmo && jmo.objectId === prev.id) {
          try { jazzMapObjects.$jazz.splice(i, 1); } catch (err) {
            console.error(`[jazz-bridge] Failed to remove mapObject ${prev.id}:`, err);
          }
          break;
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// JAZZ COLIST DEDUP CLEANUP
// ══════════════════════════════════════════════════════════════════════════

/** Remove duplicate entries from a Jazz CoList by a key field.
 *  Keeps the LAST occurrence (most recent write). */
function _dedupeJazzCoList(coList: any, keyField: string): number {
  if (!coList) return 0;
  const len = coList.length ?? 0;
  if (len <= 1) return 0;

  // Build map of key → last index
  const lastIndex = new Map<string, number>();
  for (let i = 0; i < len; i++) {
    const item = coList[i];
    if (item && item[keyField]) {
      lastIndex.set(item[keyField], i);
    }
  }

  // Collect indices to remove (duplicates that aren't the last occurrence)
  const toRemove: number[] = [];
  for (let i = 0; i < len; i++) {
    const item = coList[i];
    if (item && item[keyField] && lastIndex.get(item[keyField]) !== i) {
      toRemove.push(i);
    }
  }

  // Remove in reverse order to preserve indices
  let removed = 0;
  for (let i = toRemove.length - 1; i >= 0; i--) {
    try {
      coList.$jazz.splice(toRemove[i], 1);
      removed++;
    } catch { /* */ }
  }

  if (removed > 0) {
    console.warn(`[jazz-bridge] 🧹 Cleaned ${removed} duplicate entries from CoList (key: ${keyField})`);
  }
  return removed;
}

// ══════════════════════════════════════════════════════════════════════════
// LIVE BRIDGE: bidirectional subscriptions
// ══════════════════════════════════════════════════════════════════════════

/**
 * Start the bidirectional bridge for all entity types.
 * @param isCreator — true if this client created the session
 */
export function startBridge(sessionRoot: any, isCreator = false): void {
  _sessionRoot = sessionRoot;
  _isCreator = isCreator;
  // Cache child refs immediately while the proxy is still live
  _cachedTokens = sessionRoot.tokens ?? null;
  _cachedRegions = sessionRoot.regions ?? null;
  _cachedMapObjects = sessionRoot.mapObjects ?? null;
  _cachedEffects = sessionRoot.effects ?? null;
  _cachedBlobs = sessionRoot.blobs ?? null;
  _cachedGroup = sessionRoot.$jazz?.owner ?? sessionRoot._owner ?? sessionRoot.$jazz?.group ?? null;
  console.log("[jazz-bridge] Starting bridge, cached refs:", {
    tokens: !!_cachedTokens,
    regions: !!_cachedRegions,
    mapObjects: !!_cachedMapObjects,
    effects: !!_cachedEffects,
    blobs: !!_cachedBlobs,
    group: !!_cachedGroup,
    isCreator,
  });

  // ── Startup dedup: clean any existing duplicates in Jazz CoLists ──
  if (_cachedTokens) _dedupeJazzCoList(_cachedTokens, 'tokenId');
  if (_cachedRegions) _dedupeJazzCoList(_cachedRegions, 'regionId');
  if (_cachedMapObjects) _dedupeJazzCoList(_cachedMapObjects, 'objectId');

  // ── Token sync: Zustand → Jazz ──
  let prevTokens = useSessionStore.getState().tokens;
  const unsubTokensZustand = useSessionStore.subscribe((state) => {
    const tokens = state.tokens;
    if (tokens === prevTokens) return;
    if (_fromJazz) { prevTokens = tokens; return; }

    // ── FAST PATH: if ALL changes are position-only on dragged tokens, skip entirely ──
    if (_localDragTokens.size > 0 && tokens.length === prevTokens.length) {
      let onlyDraggedPosChanges = true;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const p = prevTokens[i];
        if (t === p) continue; // same reference, no change
        if (!_localDragTokens.has(t.id)) { onlyDraggedPosChanges = false; break; }
        // Check if non-position fields changed
        if (t.label !== p.label || t.color !== p.color || t.name !== p.name ||
            (t as any).hp !== (p as any).hp || (t as any).maxHp !== (p as any).maxHp ||
            (t as any).ac !== (p as any).ac || t.isHidden !== p.isHidden ||
            t.mapId !== p.mapId || t.gridWidth !== p.gridWidth || t.gridHeight !== p.gridHeight) {
          onlyDraggedPosChanges = false;
          break;
        }
      }
      if (onlyDraggedPosChanges) {
        prevTokens = tokens;
        return; // Skip all Jazz work — only dragged positions changed
      }
    }

    const jazzTokens = _cachedTokens ?? _sessionRoot?.tokens;
    if (!jazzTokens) { prevTokens = tokens; return; }

    const group = _cachedGroup ?? _sessionRoot?.$jazz?.owner ?? _sessionRoot?._owner;

    // Detect added tokens — check Jazz list to prevent duplicates
    const prevIds = new Set(prevTokens.map((t: Token) => t.id));
    const jazzExistingIds = _getJazzTokenIds(jazzTokens);
    for (const t of tokens) {
      if (!prevIds.has(t.id)) {
        if (jazzExistingIds.has(t.id)) {
          console.log(`[jazz-bridge] ⚠️ Token ${t.id} already in Jazz — upsert instead of push`);
          // Upsert existing
          const len = jazzTokens.length ?? 0;
          for (let i = 0; i < len; i++) {
            const jt = jazzTokens[i];
            if (jt && jt.tokenId === t.id) {
              try {
                const init = tokenToJazzInit(t);
                for (const [key, val] of Object.entries(init)) {
                  if (key !== 'tokenId') jt.$jazz.set(key, val ?? undefined);
                }
              } catch (err) {
                console.error(`[jazz-bridge] Failed to upsert JazzToken:`, err);
              }
              break;
            }
          }
        } else {
          const init = tokenToJazzInit(t);
          try {
            const jt = JazzTokenSchema.create(init as any, group);
            jazzTokens.$jazz.push(jt);
          } catch (err) {
            console.error(`[jazz-bridge] Failed to create JazzToken:`, err);
          }
        }
      }
    }

    // Detect moved/updated tokens
    for (const t of tokens) {
      if (prevIds.has(t.id)) {
        const prev = prevTokens.find((pt: Token) => pt.id === t.id);
        if (!prev) continue;

        // During active local drag, skip position-only changes
        const isBeingDragged = _localDragTokens.has(t.id);
        const posChanged = prev.x !== t.x || prev.y !== t.y;
        const nonPosChanged = prev.label !== t.label ||
          prev.color !== t.color || prev.name !== t.name ||
          (prev as any).hp !== (t as any).hp || (prev as any).maxHp !== (t as any).maxHp ||
          (prev as any).ac !== (t as any).ac ||
          prev.isHidden !== t.isHidden || prev.mapId !== t.mapId ||
          prev.gridWidth !== t.gridWidth || prev.gridHeight !== t.gridHeight ||
          prev.imageHash !== t.imageHash;

        if (isBeingDragged && posChanged && !nonPosChanged) continue;
        if (!posChanged && !nonPosChanged) continue;

        const len = jazzTokens.length ?? 0;
        for (let i = 0; i < len; i++) {
          const jt = jazzTokens[i];
          if (jt && jt.tokenId === t.id) {
            try {
              const init = tokenToJazzInit(t);
              for (const [key, val] of Object.entries(init)) {
                if (key !== 'tokenId') jt.$jazz.set(key, val ?? undefined);
              }
            } catch (err) {
              console.error(`[jazz-bridge] Failed to update JazzToken:`, err);
            }
            break;
          }
        }
      }
    }

    // Detect removed tokens
    const currentIds = new Set(tokens.map((t: Token) => t.id));
    for (const prev of prevTokens) {
      if (!currentIds.has(prev.id)) {
        const len = jazzTokens.length ?? 0;
        for (let i = 0; i < len; i++) {
          const jt = jazzTokens[i];
          if (jt && jt.tokenId === prev.id) {
            try { jazzTokens.$jazz.splice(i, 1); } catch (err) {
              console.error(`[jazz-bridge] Failed to remove JazzToken:`, err);
            }
            break;
          }
        }
      }
    }

    prevTokens = tokens;
  });
  activeSubscriptions.push(unsubTokensZustand);

  // ── Token sync: Jazz → Zustand ──
  if (sessionRoot.tokens?.$jazz?.subscribe) {
    try {
      const unsubJazz = sessionRoot.tokens.$jazz.subscribe(
        { resolve: { $each: true } },
        (tokens: any) => {
          if (!tokens) return;

          const len = tokens.length ?? 0;
          const localTokens = useSessionStore.getState().tokens;

          if (len === 0 && localTokens.length > 0) {
            console.warn(`[jazz-bridge] ✋ Blocked inbound token sync — Jazz has 0 but local has ${localTokens.length}`);
            return;
          }

          runFromJazz(() => {
            const store = useSessionStore.getState();
            const localTokens = store.tokens;
            const currentIds = new Set(localTokens.map((t) => t.id));
            const jazzIds = new Set<string>();

            // Build the new token array in a single pass to avoid stale-state bugs
            // from multiple store mutations referencing an old getState() snapshot.
            let tokensChanged = false;
            const updatedTokens = localTokens.map(existing => {
              return existing;
            });

            // Deduplicate inbound Jazz tokens — only process the LAST entry per tokenId
            // Jazz CoLists can accumulate duplicates from repeated pushes
            const deduped = new Map<string, { jt: any; idx: number }>();
            for (let i = 0; i < len; i++) {
              const jt = tokens[i];
              if (!jt || !jt.tokenId) continue;
              deduped.set(jt.tokenId, { jt, idx: i }); // Last-write wins
            }

            for (const [tokenId, { jt }] of deduped) {
              jazzIds.add(tokenId);

              const isLocallyDragged = _isPositionSuppressed(tokenId);

              if (currentIds.has(tokenId)) {
                const localIdx = updatedTokens.findIndex((t) => t.id === tokenId);
                if (localIdx === -1) continue;
                const existing = updatedTokens[localIdx];

                // Build merged token: start with existing, overlay incoming non-position fields
                const incoming = jazzToZustandToken(jt);
                let hasChange = false;

                // Check position change
                const posChanged = !isLocallyDragged && (existing.x !== jt.x || existing.y !== jt.y);

                // Check non-position changes
                let hasNonPosChange = false;
                for (const key of Object.keys(incoming) as (keyof Token)[]) {
                  if (key === 'id' || key === 'x' || key === 'y' || key === 'imageUrl') continue;
                  if (incoming[key] !== existing[key]) { hasNonPosChange = true; break; }
                }

                hasChange = posChanged || hasNonPosChange;
                if (hasChange) {
                  const merged: Token = {
                    ...existing,
                    ...incoming,
                    // Preserve local-only fields
                    id: existing.id,
                    imageUrl: existing.imageUrl,
                    // Position: use Jazz values only if not suppressed
                    x: posChanged ? jt.x : existing.x,
                    y: posChanged ? jt.y : existing.y,
                  };
                  updatedTokens[localIdx] = merged;
                  tokensChanged = true;
                }
              } else {
                updatedTokens.push(jazzToZustandToken(jt));
                tokensChanged = true;
              }
            }

            // Remove tokens that no longer exist in Jazz (non-creator only)
            let finalTokens = updatedTokens;
            if (!_isCreator) {
              finalTokens = updatedTokens.filter(t => jazzIds.has(t.id));
              if (finalTokens.length !== updatedTokens.length) tokensChanged = true;
            }

            if (tokensChanged) {
              store.setTokens(finalTokens);
            }
          });
        },
      );
      activeSubscriptions.push(unsubJazz);
    } catch (err) {
      console.warn("[jazz-bridge] Could not subscribe to Jazz tokens:", err);
    }
  }

  // ── Region sync: Zustand → Jazz ──
  let prevRegions = useRegionStore.getState().regions;
  const unsubRegionsZustand = useRegionStore.subscribe((state) => {
    const regions = state.regions;
    if (regions === prevRegions) return;
    if (_fromJazz) { prevRegions = regions; return; }
    const capturedPrev = prevRegions;
    prevRegions = regions;
    throttledPushFineGrained('regions', () => syncRegionsToJazz(regions, capturedPrev));
  });
  activeSubscriptions.push(unsubRegionsZustand);

  // ── Region sync: Jazz → Zustand ──
  const jazzRegionsRef = sessionRoot.regions;
  if (jazzRegionsRef?.$jazz?.subscribe) {
    try {
      const unsubRegionsJazz = jazzRegionsRef.$jazz.subscribe(
        { resolve: { $each: true } },
        (regions: any) => {
          if (!regions) return;
          const len = regions.length ?? 0;
          const localCount = useRegionStore.getState().regions.length;

          if (len === 0 && localCount > 0 && _isCreator) return;

          runFromJazz(() => {
            const store = useRegionStore.getState();
            const currentIds = new Set(store.regions.map(r => r.id));
            const jazzIds = new Set<string>();

            for (let i = 0; i < len; i++) {
              const jr = regions[i];
              if (!jr) continue;
              jazzIds.add(jr.regionId);

              if (currentIds.has(jr.regionId)) {
                store.updateRegion(jr.regionId, jazzToZustandRegion(jr));
              } else {
                store.addRegion(jazzToZustandRegion(jr));
              }
            }

            if (!_isCreator) {
              for (const r of store.regions) {
                if (!jazzIds.has(r.id)) store.removeRegion(r.id);
              }
            }
          });
          // Update prev to prevent echo
          prevRegions = useRegionStore.getState().regions;
        },
      );
      activeSubscriptions.push(unsubRegionsJazz);
    } catch (err) {
      console.warn("[jazz-bridge] Could not subscribe to Jazz regions:", err);
    }
  }

  // ── MapObject sync: Zustand → Jazz ──
  let prevMapObjects = useMapObjectStore.getState().mapObjects;
  const unsubMapObjectsZustand = useMapObjectStore.subscribe((state) => {
    const mapObjects = state.mapObjects;
    if (mapObjects === prevMapObjects) return;
    if (_fromJazz) { prevMapObjects = mapObjects; return; }
    const capturedPrev = prevMapObjects;
    prevMapObjects = mapObjects;
    throttledPushFineGrained('mapObjects', () => syncMapObjectsToJazz(mapObjects, capturedPrev));
  });
  activeSubscriptions.push(unsubMapObjectsZustand);

  // ── MapObject sync: Jazz → Zustand ──
  const jazzMapObjectsRef = sessionRoot.mapObjects;
  if (jazzMapObjectsRef?.$jazz?.subscribe) {
    try {
      const unsubMapObjectsJazz = jazzMapObjectsRef.$jazz.subscribe(
        { resolve: { $each: true } },
        (mapObjects: any) => {
          if (!mapObjects) return;
          const len = mapObjects.length ?? 0;
          const localCount = useMapObjectStore.getState().mapObjects.length;

          if (len === 0 && localCount > 0 && _isCreator) return;

          runFromJazz(() => {
            const store = useMapObjectStore.getState();
            const currentIds = new Set(store.mapObjects.map(o => o.id));
            const jazzIds = new Set<string>();

            for (let i = 0; i < len; i++) {
              const jmo = mapObjects[i];
              if (!jmo) continue;
              jazzIds.add(jmo.objectId);

              if (currentIds.has(jmo.objectId)) {
                store.updateMapObject(jmo.objectId, jazzToZustandMapObject(jmo));
              } else {
                store.addMapObject(jazzToZustandMapObject(jmo));
              }
            }

            if (!_isCreator) {
              for (const obj of store.mapObjects) {
                if (!jazzIds.has(obj.id)) store.removeMapObject(obj.id);
              }
            }
          });
          prevMapObjects = useMapObjectStore.getState().mapObjects;
        },
      );
      activeSubscriptions.push(unsubMapObjectsJazz);
    } catch (err) {
      console.warn("[jazz-bridge] Could not subscribe to Jazz mapObjects:", err);
    }
  }

  // ── Effect sync: Zustand → Jazz ──
  let prevEffects = useEffectStore.getState().placedEffects;
  const unsubEffectsZustand = useEffectStore.subscribe((state) => {
    const effects = state.placedEffects;
    if (effects === prevEffects) return;
    if (_fromJazz) { prevEffects = effects; return; }
    prevEffects = effects;
    // Throttled full re-push of effects (simpler than diff for complex nested state)
    throttledPushFineGrained('effects', () => {
      const effectState = _cachedEffects ?? _sessionRoot?.effects;
      if (!effectState?.placedEffects) return;
      const group = _cachedGroup ?? _sessionRoot?.$jazz?.owner ?? _sessionRoot?._owner;
      // Clear and re-push all placed effects
      const jazzPlaced = effectState.placedEffects;
      const len = jazzPlaced.length ?? 0;
      for (let i = len - 1; i >= 0; i--) {
        try { jazzPlaced.$jazz.splice(i, 1); } catch { /* */ }
      }
      const active = useEffectStore.getState().placedEffects.filter((e: any) => !e.dismissedAt);
      for (const e of active) {
        try {
          const je = JazzPlacedEffectSchema.create(placedEffectToJazzInit(e) as any, group);
          jazzPlaced.$jazz.push(je);
        } catch { /* */ }
      }
    });
  });
  activeSubscriptions.push(unsubEffectsZustand);

  // ── Blob sync: Zustand → Jazz (remaining DO kinds) ──
  for (const kind of BLOB_SYNC_KINDS) {
    const getStore = STORE_FOR_KIND[kind];
    if (!getStore) continue;

    try {
      const store = getStore();
      const unsub = store.subscribe(() => {
        if (_fromJazz) return;
        throttledPushBlob(kind);
      });
      activeSubscriptions.push(unsub);
    } catch (err) {
      console.warn(`[jazz-bridge] Could not subscribe to store for ${kind}:`, err);
    }
  }

  // ── Blob sync: Jazz → Zustand (inbound blob changes) ──
  if (sessionRoot.blobs?.$jazz?.subscribe) {
    try {
      const unsubBlobs = sessionRoot.blobs.$jazz.subscribe(
        { resolve: { $each: true } },
        (blobs: any) => {
          if (!blobs) return;
          const len = blobs.length ?? 0;
          for (let i = 0; i < len; i++) {
            const blob = blobs[i];
            if (!blob || !blob.kind || !blob.state) continue;
            // Skip kinds that are now fine-grained
            if (!BLOB_SYNC_KINDS.includes(blob.kind)) continue;

            const hash = quickHash(blob.state);
            if (_lastPushedHash.get(blob.kind) === hash) continue;

            pullBlobFromJazz(blob.kind, blob.state);
          }
        },
      );
      activeSubscriptions.push(unsubBlobs);
    } catch (err) {
      console.warn("[jazz-bridge] Could not subscribe to Jazz blobs:", err);
    }
  }

  // ── Texture sync: subscribe to live texture additions ──
  try {
    import("./textureSync").then(({ subscribeToTextureChanges }) => {
      const unsubTextures = subscribeToTextureChanges(sessionRoot);
      activeSubscriptions.push(unsubTextures);
    }).catch(err => {
      console.warn("[jazz-bridge] Could not start texture subscription:", err);
    });
  } catch (err) {
    console.warn("[jazz-bridge] Could not start texture subscription:", err);
  }

  console.log(`[jazz-bridge] Bridge started: tokens + regions + mapObjects (fine-grained) + ${BLOB_SYNC_KINDS.length} DO blob kinds + texture FileStreams`);
}

/**
 * Tear down all active bridge subscriptions.
 */
export function stopBridge(): void {
  for (const unsub of activeSubscriptions) {
    unsub();
  }
  activeSubscriptions.length = 0;

  // Clear throttle timers
  for (const timer of _throttleTimers.values()) clearTimeout(timer);
  _throttleTimers.clear();
  for (const timer of _fineGrainedTimers.values()) clearTimeout(timer);
  _fineGrainedTimers.clear();
  _lastPushedHash.clear();

  _sessionRoot = null;
  _cachedTokens = null;
  _cachedRegions = null;
  _cachedMapObjects = null;
  _cachedEffects = null;
  _cachedBlobs = null;
  _cachedGroup = null;
  _isCreator = false;
  console.log("[jazz-bridge] Bridge stopped");
}
