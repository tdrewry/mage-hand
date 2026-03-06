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
  DiceRollingPayload,
  ActionTargetPreviewPayload,
  EffectAuraStatePayload,
  EffectPlacementPreviewPayload,
} from "./types";
export { EPHEMERAL_OP_CONFIG } from "./types";
export { registerEffectHandlers, emitAuraState } from "./effectHandlers";
