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
  // Map & Camera
  | "map.dm.viewport"
  | "map.ping"
  | "map.focus"
  // Regions
  | "region.drag.update"
  | "region.handle.preview"
  // Map Objects
  | "mapObject.drag.update"
  | "mapObject.handle.preview"
  | "mapObject.door.preview"
  // Fog & Vision
  | "fog.cursor.preview"
  | "fog.reveal.preview"
  // Chat & Dice
  | "chat.typing"
  | "dice.rolling"
  // Initiative
  | "initiative.drag.preview"
  | "initiative.hover"
  // Groups
  | "group.select.preview"
  | "group.drag.preview"
  // Roles & Presence
  | "role.handRaise"
  | "presence.activity"
  // UI / Cursors
  | "cursor.update"
  | "cursor.visibility"
  | "presence.viewingMap"
  // Actions
  | "action.target.preview"
  | "action.flash"
  | "action.inProgress"
  // Assets
  | "asset.uploadProgress";

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

export interface RegionDragUpdatePayload {
  regionId: string;
  pos: Vec2;
}

export interface RegionHandlePreviewPayload {
  regionId: string;
  handleType: "rotate" | "scale";
  pos: Vec2;
  value?: number;
}

// -- Map Objects --

export interface MapObjectDragUpdatePayload {
  objectId: string;
  pos: Vec2;
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
  shape: "circle" | "polygon";
  points: Vec2[];
  radius?: number;
}

// -- Chat & Dice --

export interface ChatTypingPayload {
  /** empty = cleared typing indicator */
}

export interface DiceRollingPayload {
  formula?: string;
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

// -- Assets --

export interface AssetUploadProgressPayload {
  assetId: string;
  percent: number; // 0-100
}

// ── Payload Map (opKind → payload type) ─────────────────────────

export interface EphemeralPayloadMap {
  "token.handle.preview": TokenHandlePreviewPayload;
  "token.hover": TokenHoverPayload;
  "selection.preview": SelectionPreviewPayload;
  "token.drag.begin": { tokenId: string; startPos: Vec2; mode?: "freehand" | "directLine" };
  "token.drag.update": { tokenId: string; pos: Vec2; path?: Vec2[] };
  "token.drag.end": { tokenId: string };
  "map.dm.viewport": DmViewportPayload;
  "map.ping": MapPingPayload;
  "map.focus": MapFocusPayload;
  "region.drag.update": RegionDragUpdatePayload;
  "region.handle.preview": RegionHandlePreviewPayload;
  "mapObject.drag.update": MapObjectDragUpdatePayload;
  "mapObject.handle.preview": MapObjectHandlePreviewPayload;
  "mapObject.door.preview": MapObjectDoorPreviewPayload;
  "fog.cursor.preview": FogCursorPreviewPayload;
  "fog.reveal.preview": FogRevealPreviewPayload;
  "chat.typing": ChatTypingPayload;
  "dice.rolling": DiceRollingPayload;
  "initiative.drag.preview": InitiativeDragPreviewPayload;
  "initiative.hover": InitiativeHoverPayload;
  "group.select.preview": GroupSelectPreviewPayload;
  "group.drag.preview": GroupDragPreviewPayload;
  "role.handRaise": RoleHandRaisePayload;
  "presence.activity": PresenceActivityPayload;
  "cursor.update": CursorUpdatePayload;
  "cursor.visibility": CursorVisibilityPayload;
  "presence.viewingMap": PresenceViewingMapPayload;
  "action.target.preview": ActionTargetPreviewPayload;
  "action.flash": ActionFlashPayload;
  "action.inProgress": ActionInProgressPayload;
  "asset.uploadProgress": AssetUploadProgressPayload;
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
  "token.handle.preview":   { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },
  "token.hover":            { throttleMs: 100, ttlMs: 500,  keyStrategy: "userId" },
  "selection.preview":      { throttleMs: 50,  ttlMs: 400,  keyStrategy: "userId" },
  "token.drag.begin":       { throttleMs: 0,   ttlMs: 400,  keyStrategy: "entityId" },
  "token.drag.update":      { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },
  "token.drag.end":         { throttleMs: 0,   ttlMs: 400,  keyStrategy: "entityId" },

  // Map & Camera
  "map.dm.viewport":        { throttleMs: 100, ttlMs: 1000, keyStrategy: "session", dmOnly: true },
  "map.ping":               { throttleMs: 0,   ttlMs: 1000, keyStrategy: "userId" },
  "map.focus":              { throttleMs: 0,   ttlMs: 1000, keyStrategy: "session", dmOnly: true },

  // Regions
  "region.drag.update":     { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },
  "region.handle.preview":  { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },

  // Map Objects
  "mapObject.drag.update":  { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },
  "mapObject.handle.preview": { throttleMs: 50, ttlMs: 400, keyStrategy: "entityId" },
  "mapObject.door.preview": { throttleMs: 0,   ttlMs: 500,  keyStrategy: "entityId" },

  // Fog & Vision
  "fog.cursor.preview":     { throttleMs: 50,  ttlMs: 500,  keyStrategy: "userId", dmOnly: true },
  "fog.reveal.preview":     { throttleMs: 50,  ttlMs: 500,  keyStrategy: "userId", dmOnly: true },

  // Chat & Dice
  "chat.typing":            { throttleMs: 200, ttlMs: 2000, keyStrategy: "userId" },
  "dice.rolling":           { throttleMs: 0,   ttlMs: 3000, keyStrategy: "userId" },

  // Initiative
  "initiative.drag.preview": { throttleMs: 50, ttlMs: 400,  keyStrategy: "userId" },
  "initiative.hover":       { throttleMs: 100, ttlMs: 500,  keyStrategy: "userId" },

  // Groups
  "group.select.preview":   { throttleMs: 100, ttlMs: 500,  keyStrategy: "userId" },
  "group.drag.preview":     { throttleMs: 50,  ttlMs: 400,  keyStrategy: "entityId" },

  // Roles & Presence
  "role.handRaise":         { throttleMs: 0,   ttlMs: 30000, keyStrategy: "userId" },
  "presence.activity":      { throttleMs: 200, ttlMs: 5000,  keyStrategy: "userId" },

  // UI / Cursors
  "cursor.update":          { throttleMs: 67,  ttlMs: 500,  keyStrategy: "userId" },
  "cursor.visibility":      { throttleMs: 0,   ttlMs: 0,    keyStrategy: "session", dmOnly: true },
  "presence.viewingMap":    { throttleMs: 200, ttlMs: 5000, keyStrategy: "userId" },

  // Actions
  "action.target.preview":  { throttleMs: 50,  ttlMs: 500,  keyStrategy: "userId" },
  "action.flash":           { throttleMs: 0,   ttlMs: 1000, keyStrategy: "entityId" },
  "action.inProgress":      { throttleMs: 0,   ttlMs: 3000, keyStrategy: "userId" },

  // Assets
  "asset.uploadProgress":   { throttleMs: 200, ttlMs: 5000, keyStrategy: "userId" },
};
