// src/lib/net/ephemeral/types.ts
// Typed payload definitions for all Ephemeral ops from NETWORKING-MATRIX.md.

import type { UserId } from "../../../../networking/contract/v1";

// ── Ephemeral Op Kind Union ─────────────────────────────────────

export type EphemeralOpKind =
  // Tokens
  | "token.handle.preview"
  | "token.hover"
  | "selection.preview"
  | "token.drag.begin"
  | "token.drag.update"
  | "token.drag.end"
  | "remote.drag.update"
  | "token.position.sync"
  | "token.meta.sync"
  // Map & Camera
  | "map.dm.viewport"
  | "map.dm.enforceFollow"
  | "map.ping"
  | "map.focus"
  // Regions
  | "region.drag.begin"
  | "region.drag.update"
  | "region.drag.end"
  | "region.handle.preview"
  // Map Objects
  | "mapObject.drag.begin"
  | "mapObject.drag.update"
  | "mapObject.drag.end"
  | "mapObject.handle.preview"
  | "mapObject.door.preview"
  // Fog & Vision
  | "fog.cursor.preview"
  | "fog.reveal.preview"
  // Chat
  | "chat.typing"
  | "chat.message"
  // Initiative
  | "initiative.drag.preview"
  | "initiative.hover"
  // Groups
  | "group.select.preview"
  | "group.drag.preview"
  // Roles & Presence
  | "role.handRaise"
  | "role.assign"
  | "presence.activity"
  // UI / Cursors
  | "cursor.update"
  | "cursor.visibility"
  | "presence.viewingMap"
  // Actions
  | "action.target.preview"
  | "action.flash"
  | "action.inProgress"
  | "action.queue.sync"
  | "action.pending"
  | "action.resolved"
  | "action.resolution.claim"
  // Assets
  | "asset.uploadProgress"
  | "asset.submission"
  | "asset.accepted"
  | "asset.rejected"
  // Effects & Auras
  | "effect.aura.state"
  | "effect.placement.preview"
  // Portal & Map Activation
  | "map.dm.selectMap"
  | "map.tree.sync"
  | "portal.activate"
  | "portal.teleport.request"
  | "portal.teleport.approved"
  | "portal.teleport.denied"
  // Ambient
  | "ambient.loop.play"
  | "ambient.loop.stop";

// ── Payload Interfaces ──────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// -- Tokens --

export interface TokenHandlePreviewPayload {
  tokenId: string;
  handleType: "rotate" | "scale";
  pos: Vec2;
  value?: number; // angle or scale factor
}

export interface TokenHoverPayload {
  tokenId: string | null; // null = hover cleared
}

export interface SelectionPreviewPayload {
  rect?: { x: number; y: number; width: number; height: number };
  polyline?: Vec2[];
}

// -- Map & Camera --

export interface DmViewportPayload {
  x: number;
  y: number;
  zoom: number;
}

export interface DmEnforceFollowPayload {
  enforce: boolean;
}

export interface MapPingPayload {
  pos: Vec2;
  color?: string;
  label?: string;
}

export interface MapFocusPayload {
  pos: Vec2;
  zoom?: number;
}

// -- Regions --

export interface RegionDragBeginPayload {
  regionId: string;
  startPos: Vec2;
}

export interface RegionDragUpdatePayload {
  regionId: string;
  pos: Vec2;
}

export interface RegionDragEndPayload {
  regionId: string;
}

export interface RegionHandlePreviewPayload {
  regionId: string;
  handleType: "rotate" | "scale";
  pos: Vec2;
  value?: number;
}

// -- Map Objects --

export interface MapObjectDragBeginPayload {
  objectId: string;
  startPos: Vec2;
}

export interface MapObjectDragUpdatePayload {
  objectId: string;
  pos: Vec2;
}

export interface MapObjectDragEndPayload {
  objectId: string;
}

export interface MapObjectHandlePreviewPayload {
  objectId: string;
  handleType: "rotate" | "scale";
  pos: Vec2;
  value?: number;
}

export interface MapObjectDoorPreviewPayload {
  objectId: string;
  open: boolean;
}

// -- Fog & Vision --

export interface FogCursorPreviewPayload {
  pos: Vec2;
  radius: number;
  tool: "reveal" | "hide";
}

export interface FogRevealPreviewPayload {
  shape: "circle" | "polygon" | "committed";
  points: Vec2[];
  radius?: number;
  /** When shape === "committed", carries the full serialized explored geometry */
  serializedExploredAreas?: string;
  /** Map ID this fog data belongs to (per-map explored areas) */
  mapId?: string;
}

// -- Chat --

export interface ChatTypingPayload {
  /** empty = cleared typing indicator */
}

export interface ChatMessagePayload {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  /** If set, this is a whisper visible only to these user IDs */
  whisperTo?: string[];
}

// -- Initiative --

export interface InitiativeDragPreviewPayload {
  entryIndex: number;
  targetIndex: number;
}

export interface InitiativeHoverPayload {
  entryIndex: number | null;
}

// -- Groups --

export interface GroupSelectPreviewPayload {
  groupId: string | null;
}

export interface GroupDragPreviewPayload {
  groupId: string;
  delta: Vec2;
}

// -- Roles & Presence --

export interface RoleHandRaisePayload {
  /** empty = hand raised; receiver uses userId from envelope */
}

export interface RoleAssignPayload {
  /** The userId of the target user whose roles are being changed */
  targetUserId: string;
  /** The new set of roleIds for the target user */
  roleIds: string[];
}

export interface PresenceActivityPayload {
  activity: string; // e.g. "editing map", "viewing tokens"
}

// -- UI / Cursors --

export interface CursorUpdatePayload {
  pos: Vec2;
  color?: string;
  tool?: string;
}

export interface CursorVisibilityPayload {
  visible: boolean;
}

export interface PresenceViewingMapPayload {
  mapId: string | null;
}

// -- Actions --

export interface ActionTargetPreviewPayload {
  sourceTokenId: string;
  pos: Vec2;
}

export interface ActionFlashPayload {
  targetTokenId: string;
  result: "hit" | "miss" | "crit";
}

export interface ActionInProgressPayload {
  actionType: string;
  sourceTokenId?: string;
}

export interface ActionQueueSyncPayload {
  currentAction: any | null;
  pendingActions: any[];
  actionHistory: any[];
}

/** Broadcast by DM when an action enters resolve phase — visible to all players. */
export interface ActionPendingPayload {
  actionId: string;
  sourceName: string;
  attackName: string;
  targetNames: string[];
  category: string;
}

/** Broadcast by DM when an action is committed — players see outcome summary. */
export interface ActionResolvedPayload {
  actionId: string;
  sourceName: string;
  attackName: string;
  category: string;
  targets: Array<{
    tokenName: string;
    resolution: string;     // hit/miss/half/critical_hit etc.
    totalDamage: number;
    damageType: string;
  }>;
}

/** Optimistic lock: DM claims exclusive resolution of an action. */
export interface ActionResolutionClaimPayload {
  actionId: string;
  /** null = release claim */
  claimedBy: string | null;
  claimedByName: string | null;
}

// -- Assets --

export interface AssetUploadProgressPayload {
  assetId: string;
  percent: number; // 0-100
}

export interface AssetSubmissionPayload {
  submissionId: string;
  targetType: 'token' | 'region' | 'mapObject' | 'effectTemplate';
  targetId: string;
  targetName: string;
  playerName: string;
  textureHash: string;
  /** Compressed base64 data URL */
  textureDataUrl: string;
}

export interface AssetAcceptedPayload {
  submissionId: string;
  targetType: 'token' | 'region' | 'mapObject' | 'effectTemplate';
  targetId: string;
  textureHash: string;
  textureDataUrl: string;
}

export interface AssetRejectedPayload {
  submissionId: string;
  reason?: string;
}

// -- Effects & Auras --

export interface EffectAuraStatePayload {
  effectId: string;
  origin: Vec2;
  insideIds: string[];
  impacts: Array<{
    targetId: string;
    targetType: string;
    distanceFromOrigin: number;
    overlapPercent: number;
  }>;
}

export interface EffectPlacementPreviewPayload {
  templateId: string;
  origin: Vec2;
  direction?: number;
}

// -- Portal & Map Activation --

export interface MapDmSelectMapPayload {
  mapId: string;
}

/** Full map tree state broadcast from DM → all clients. */
export interface MapTreeSyncPayload {
  /** Per-map activation state */
  mapActivations: Array<{ mapId: string; active: boolean }>;
  /** DM's currently selected/focused map */
  selectedMapId: string | null;
  /** Structure definitions (buildings, floors) */
  structures: Array<{ id: string; name: string; exclusiveFocus?: boolean }>;
  /** Map focus/blur settings */
  focusSettings: {
    unfocusedOpacity: number;
    unfocusedBlur: number;
    selectionLockEnabled: boolean;
  };
}

export interface PortalActivatePayload {
  objectId: string;
}

export interface PortalTeleportRequestPayload {
  requestId: string;
  tokenId: string;
  tokenName: string;
  sourcePortalId: string;
  sourcePortalName: string;
  targetPortalId: string;
  targetPortalName: string;
  requestingPlayerName: string;
  dropPosition?: { x: number; y: number };
}

export interface PortalTeleportApprovedPayload {
  requestId: string;
  tokenId: string;
  sourcePortalId: string;
  targetPortalId: string;
  dropPosition?: { x: number; y: number };
  /** If the teleport switches maps, the new active map ID */
  activeMapId?: string;
  /** Full map tree activation state so all clients match DM */
  mapActivations?: Array<{ mapId: string; active: boolean }>;
}

export interface PortalTeleportDeniedPayload {
  requestId: string;
  reason?: string;
}

// -- Ambient --

export interface AmbientLoopPlayPayload {
  loopId: string;
  volume: number;
}

export interface AmbientLoopStopPayload {
  // intentionally empty
}

// -- Token Position Sync --

export interface TokenPositionSyncPayload {
  positions: Array<{ tokenId: string; x: number; y: number }>;
}

// -- Token Meta Sync --

export interface TokenMetaSyncPayload {
  tokenId: string;
  /** Partial token fields — only changed metadata, no position */
  meta: Record<string, unknown>;
}

// ── Payload Map (opKind → payload type) ─────────────────────────

export interface EphemeralPayloadMap {
  "token.handle.preview": TokenHandlePreviewPayload;
  "token.hover": TokenHoverPayload;
  "selection.preview": SelectionPreviewPayload;
  "token.drag.begin": { tokenId: string; startPos: Vec2; mode?: "freehand" | "directLine" };
  "token.drag.update": { tokenId: string; pos: Vec2; path?: Vec2[] };
  "token.drag.end": { tokenId: string };
  "remote.drag.update": { tokenId: string };
  "token.position.sync": TokenPositionSyncPayload;
  "token.meta.sync": TokenMetaSyncPayload;
  "map.dm.viewport": DmViewportPayload;
  "map.dm.enforceFollow": DmEnforceFollowPayload;
  "map.ping": MapPingPayload;
  "map.focus": MapFocusPayload;
  "region.drag.begin": RegionDragBeginPayload;
  "region.drag.update": RegionDragUpdatePayload;
  "region.drag.end": RegionDragEndPayload;
  "region.handle.preview": RegionHandlePreviewPayload;
  "mapObject.drag.begin": MapObjectDragBeginPayload;
  "mapObject.drag.update": MapObjectDragUpdatePayload;
  "mapObject.drag.end": MapObjectDragEndPayload;
  "mapObject.handle.preview": MapObjectHandlePreviewPayload;
  "mapObject.door.preview": MapObjectDoorPreviewPayload;
  "fog.cursor.preview": FogCursorPreviewPayload;
  "fog.reveal.preview": FogRevealPreviewPayload;
  "chat.typing": ChatTypingPayload;
  "chat.message": ChatMessagePayload;
  "initiative.drag.preview": InitiativeDragPreviewPayload;
  "initiative.hover": InitiativeHoverPayload;
  "group.select.preview": GroupSelectPreviewPayload;
  "group.drag.preview": GroupDragPreviewPayload;
  "role.handRaise": RoleHandRaisePayload;
  "role.assign": RoleAssignPayload;
  "presence.activity": PresenceActivityPayload;
  "cursor.update": CursorUpdatePayload;
  "cursor.visibility": CursorVisibilityPayload;
  "presence.viewingMap": PresenceViewingMapPayload;
  "action.target.preview": ActionTargetPreviewPayload;
  "action.flash": ActionFlashPayload;
  "action.inProgress": ActionInProgressPayload;
  "action.queue.sync": ActionQueueSyncPayload;
  "action.pending": ActionPendingPayload;
  "action.resolved": ActionResolvedPayload;
  "action.resolution.claim": ActionResolutionClaimPayload;
  "asset.uploadProgress": AssetUploadProgressPayload;
  "asset.submission": AssetSubmissionPayload;
  "asset.accepted": AssetAcceptedPayload;
  "asset.rejected": AssetRejectedPayload;
  "effect.aura.state": EffectAuraStatePayload;
  "effect.placement.preview": EffectPlacementPreviewPayload;
  "map.dm.selectMap": MapDmSelectMapPayload;
  "map.tree.sync": MapTreeSyncPayload;
  "portal.activate": PortalActivatePayload;
  "portal.teleport.request": PortalTeleportRequestPayload;
  "portal.teleport.approved": PortalTeleportApprovedPayload;
  "portal.teleport.denied": PortalTeleportDeniedPayload;
  "ambient.loop.play": AmbientLoopPlayPayload;
  "ambient.loop.stop": AmbientLoopStopPayload;
}

// ── Ephemeral Config (throttle + TTL per op kind) ───────────────

export interface EphemeralOpConfig {
  /** Minimum interval between outbound sends (ms). 0 = unthrottled. */
  throttleMs: number;
  /** Time-to-live for received state (ms). After TTL, state is expired. */
  ttlMs: number;
  /** Entity key strategy for "latest wins" deduplication. */
  keyStrategy: "userId" | "entityId" | "session" | "none";
  /** If true, only DM-role clients may emit this op. */
  dmOnly?: boolean;
}

/**
 * Default config for every ephemeral op kind.
 * Values sourced from NETWORKING-MATRIX.md and EPHEMERAL-NETWORKING-CONTRACT.md.
 */
export const EPHEMERAL_OP_CONFIG: Record<EphemeralOpKind, EphemeralOpConfig> = {
  // Tokens
  "token.handle.preview":   { throttleMs: 50,  ttlMs: 0,    keyStrategy: "entityId" },
  "token.hover":            { throttleMs: 100, ttlMs: 0,    keyStrategy: "userId" },
  "selection.preview":      { throttleMs: 50,  ttlMs: 0,    keyStrategy: "userId" },
  "token.drag.begin":       { throttleMs: 0,   ttlMs: 0,    keyStrategy: "entityId" },
  "token.drag.update":      { throttleMs: 50,  ttlMs: 0,    keyStrategy: "entityId" },
  "token.drag.end":         { throttleMs: 0,   ttlMs: 400,  keyStrategy: "entityId" },
  "remote.drag.update":     { throttleMs: 0,   ttlMs: 0,    keyStrategy: "entityId" },
  "token.position.sync":    { throttleMs: 100, ttlMs: 500,  keyStrategy: "session" },
  "token.meta.sync":        { throttleMs: 200, ttlMs: 2000, keyStrategy: "entityId" },

  // Map & Camera
  "map.dm.viewport":        { throttleMs: 100, ttlMs: 1000, keyStrategy: "session", dmOnly: true },
  "map.dm.enforceFollow":   { throttleMs: 0,   ttlMs: 2000, keyStrategy: "session", dmOnly: true },
  "map.ping":               { throttleMs: 0,   ttlMs: 1000, keyStrategy: "userId" },
  "map.focus":              { throttleMs: 0,   ttlMs: 1000, keyStrategy: "session", dmOnly: true },

  // Regions
  "region.drag.begin":      { throttleMs: 0,   ttlMs: 0,    keyStrategy: "entityId" },
  "region.drag.update":     { throttleMs: 50,  ttlMs: 0,    keyStrategy: "entityId" },
  "region.drag.end":        { throttleMs: 0,   ttlMs: 400,  keyStrategy: "entityId" },
  "region.handle.preview":  { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },

  // Map Objects
  "mapObject.drag.begin":   { throttleMs: 0,   ttlMs: 0,    keyStrategy: "entityId" },
  "mapObject.drag.update":  { throttleMs: 50,  ttlMs: 0,    keyStrategy: "entityId" },
  "mapObject.drag.end":     { throttleMs: 0,   ttlMs: 400,  keyStrategy: "entityId" },
  "mapObject.handle.preview": { throttleMs: 50, ttlMs: 400, keyStrategy: "entityId" },
  "mapObject.door.preview": { throttleMs: 0,   ttlMs: 500,  keyStrategy: "entityId" },

  // Fog & Vision
  "fog.cursor.preview":     { throttleMs: 100,  ttlMs: 500,  keyStrategy: "userId", dmOnly: true },
  "fog.reveal.preview":     { throttleMs: 50,  ttlMs: 500,  keyStrategy: "userId", dmOnly: true },

  // Chat
  "chat.typing":            { throttleMs: 200, ttlMs: 2000, keyStrategy: "userId" },
  "chat.message":           { throttleMs: 0,   ttlMs: 0,    keyStrategy: "none" },

  // Initiative
  "initiative.drag.preview": { throttleMs: 50, ttlMs: 400,  keyStrategy: "userId" },
  "initiative.hover":       { throttleMs: 100, ttlMs: 500,  keyStrategy: "userId" },

  // Groups
  "group.select.preview":   { throttleMs: 100, ttlMs: 500,  keyStrategy: "userId" },
  "group.drag.preview":     { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },

  // Roles & Presence
  "role.handRaise":         { throttleMs: 0,   ttlMs: 30000, keyStrategy: "userId" },
  "role.assign":            { throttleMs: 0,   ttlMs: 0,     keyStrategy: "none", dmOnly: true },
  "presence.activity":      { throttleMs: 200, ttlMs: 5000,  keyStrategy: "userId" },

  // UI / Cursors
  "cursor.update":          { throttleMs: 100, ttlMs: 500,  keyStrategy: "userId" },
  "cursor.visibility":      { throttleMs: 0,   ttlMs: 0,    keyStrategy: "session", dmOnly: true },
  "presence.viewingMap":    { throttleMs: 200, ttlMs: 5000, keyStrategy: "userId" },

  // Actions
  "action.target.preview":  { throttleMs: 50,  ttlMs: 0,    keyStrategy: "userId" },
  "action.flash":           { throttleMs: 0,   ttlMs: 1000, keyStrategy: "entityId" },
  "action.inProgress":      { throttleMs: 0,   ttlMs: 3000, keyStrategy: "userId" },
  "action.queue.sync":      { throttleMs: 500, ttlMs: 10000, keyStrategy: "session" },
  "action.pending":         { throttleMs: 0,   ttlMs: 15000, keyStrategy: "entityId", dmOnly: true },
  "action.resolved":        { throttleMs: 0,   ttlMs: 5000,  keyStrategy: "entityId", dmOnly: true },
  "action.resolution.claim": { throttleMs: 0,  ttlMs: 30000, keyStrategy: "entityId", dmOnly: true },

  // Assets
  "asset.uploadProgress":   { throttleMs: 200, ttlMs: 5000, keyStrategy: "userId" },
  "asset.submission":       { throttleMs: 0,   ttlMs: 60000, keyStrategy: "none" },
  "asset.accepted":         { throttleMs: 0,   ttlMs: 10000, keyStrategy: "none", dmOnly: true },
  "asset.rejected":         { throttleMs: 0,   ttlMs: 5000,  keyStrategy: "none", dmOnly: true },

  // Effects & Auras
  "effect.aura.state":      { throttleMs: 200, ttlMs: 0,    keyStrategy: "entityId" },
  "effect.placement.preview": { throttleMs: 67, ttlMs: 0,    keyStrategy: "userId" },

  // Portal & Map Activation
  "map.dm.selectMap":       { throttleMs: 0,   ttlMs: 2000, keyStrategy: "session", dmOnly: true },
  "map.tree.sync":          { throttleMs: 300, ttlMs: 5000, keyStrategy: "session", dmOnly: true },
  "portal.activate":        { throttleMs: 100, ttlMs: 1000, keyStrategy: "entityId" },
  "portal.teleport.request": { throttleMs: 0,  ttlMs: 30000, keyStrategy: "none" },
  "portal.teleport.approved": { throttleMs: 0, ttlMs: 10000, keyStrategy: "none", dmOnly: true },
  "portal.teleport.denied": { throttleMs: 0,   ttlMs: 5000,  keyStrategy: "none", dmOnly: true },

  // Ambient
  "ambient.loop.play":      { throttleMs: 0,   ttlMs: 0,    keyStrategy: "none", dmOnly: true },
  "ambient.loop.stop":      { throttleMs: 0,   ttlMs: 0,    keyStrategy: "none", dmOnly: true },
};
