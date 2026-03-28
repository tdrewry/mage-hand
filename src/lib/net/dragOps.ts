// src/lib/net/dragOps.ts
// Emit helpers for token drag preview ops and token meta sync.
// Uses the ephemeral pipeline (not durable op-log) for low-latency, lossy previews.

import { ephemeralBus } from "@/lib/net";
import { useSessionStore } from "@/stores/sessionStore";
import { FEATURE_EPHEMERAL_TOKEN_DRAG } from "@/lib/featureFlags";

export interface DragBeginPayload {
  tokenId: string;
  startPos: { x: number; y: number };
  mode: "freehand" | "directLine";
}

export interface DragUpdatePayload {
  tokenId: string;
  pos: { x: number; y: number };
  path?: { x: number; y: number }[];
}

export interface DragEndPayload {
  tokenId: string;
  finalPos: { x: number; y: number };
}

/** Emit drag begin via ephemeral bus (unthrottled — fires once). */
export function emitDragBegin(payload: DragBeginPayload): void {
  if (!FEATURE_EPHEMERAL_TOKEN_DRAG) return; // ephemeral token drag disabled
  ephemeralBus.emit("token.drag.begin", {
    tokenId: payload.tokenId,
    startPos: payload.startPos,
    mode: payload.mode,
  });
}

/** Emit drag update via ephemeral bus (throttled by EphemeralBus config at 50ms). */
export function emitDragUpdate(payload: DragUpdatePayload): void {
  if (!FEATURE_EPHEMERAL_TOKEN_DRAG) return; // ephemeral token drag disabled
  ephemeralBus.emit("token.drag.update", {
    tokenId: payload.tokenId,
    pos: payload.pos,
    path: payload.path,
  });
}

/** Emit drag end via ephemeral bus (unthrottled — fires once). */
export function emitDragEnd(payload: DragEndPayload): void {
  if (!FEATURE_EPHEMERAL_TOKEN_DRAG) return; // ephemeral token drag disabled
  ephemeralBus.emit("token.drag.end", {
    tokenId: payload.tokenId,
    finalPos: payload.finalPos,
  });
}

/**
 * Emit token metadata sync via ephemeral bus (throttled at 200ms per token).
 * Broadcasts label, color, pathStyle, appearance, size, etc. for live preview
 * on remote clients. Excludes position (handled by drag/position sync).
 */
export function emitTokenMetaSync(tokenId: string): void {
  const token = useSessionStore.getState().tokens.find(t => t.id === tokenId);
  if (!token) return;
  // Send all metadata fields except position and large blobs
  const { x: _x, y: _y, imageUrl: _img, statBlockJson: _sb, ...meta } = token;
  ephemeralBus.emit("token.meta.sync", {
    tokenId,
    meta,
  });
}
