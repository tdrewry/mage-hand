// src/lib/net/dragOps.ts
// Emit helpers for token drag preview ops.
// Uses the ephemeral pipeline (not durable op-log) for low-latency, lossy previews.

import { ephemeralBus } from "@/lib/net";

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
  ephemeralBus.emit("token.drag.begin", {
    tokenId: payload.tokenId,
    startPos: payload.startPos,
    mode: payload.mode,
  });
}

/** Emit drag update via ephemeral bus (throttled by EphemeralBus config at 50ms). */
export function emitDragUpdate(payload: DragUpdatePayload): void {
  ephemeralBus.emit("token.drag.update", {
    tokenId: payload.tokenId,
    pos: payload.pos,
    path: payload.path,
  });
}

/** Emit drag end via ephemeral bus (unthrottled — fires once). */
export function emitDragEnd(payload: DragEndPayload): void {
  ephemeralBus.emit("token.drag.end", {
    tokenId: payload.tokenId,
  });
}
