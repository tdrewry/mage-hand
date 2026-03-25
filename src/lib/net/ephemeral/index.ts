// src/lib/net/ephemeral/index.ts
// Public API surface for the Ephemeral networking subsystem.

export { EphemeralBus, isEphemeralOp } from "./EphemeralBus";
export type { EphemeralHandler, EphemeralEvent } from "./EphemeralBus";
export { TTLCache } from "./TTLCache";
export type { TTLEntry } from "./TTLCache";
export { ThrottleManager } from "./ThrottleManager";
export type {
  EphemeralOpKind,
  EphemeralPayloadMap,
  EphemeralOpConfig,
  Vec2,
  // Payload types re-exported for convenience
  TokenHandlePreviewPayload,
  TokenHoverPayload,
  SelectionPreviewPayload,
  TokenPositionSyncPayload,
  TokenMetaSyncPayload,
  DmViewportPayload,
  MapPingPayload,
  MapFocusPayload,
  RegionDragUpdatePayload,
  RegionHandlePreviewPayload,
  MapObjectDragUpdatePayload,
  MapObjectHandlePreviewPayload,
  CursorUpdatePayload,
  CursorVisibilityPayload,
  FogCursorPreviewPayload,
  ChatTypingPayload,
  ChatMessagePayload,
  ActionTargetPreviewPayload,
  ActionPendingPayload,
  ActionResolvedPayload,
  ActionResolutionClaimPayload,
  EffectAuraStatePayload,
  EffectPlacementPreviewPayload,
  MapDmSelectMapPayload,
  MapTreeSyncPayload,
  PortalActivatePayload,
  PortalTeleportRequestPayload,
  PortalTeleportApprovedPayload,
  PortalTeleportDeniedPayload,
} from "./types";
export { EPHEMERAL_OP_CONFIG } from "./types";
export { registerEffectHandlers, emitAuraState } from "./mapTemplateHandlers";
export { emitChatTyping, emitChatMessage, emitAssetUploadProgress, emitArtSubmission, emitArtAccepted, emitArtRejected, emitIntentSubmit } from "./miscHandlers";
export { emitMapSelectMap, emitMapTreeSync, emitPortalActivate, emitRegionDragUpdate, emitPortalTeleportRequest, emitPortalTeleportApproved, emitPortalTeleportDenied } from "./mapHandlers";
export { registerAmbientHandlers, emitAmbientLoopPlay, emitAmbientLoopStop } from "./ambientHandlers";
