// src/lib/net/dragOps.ts
// Emit helpers for token drag preview ops.
// Throttled at 20 Hz (50ms) for drag updates.

import { emitLocalOp } from "./index";
import { throttle } from "@/lib/throttle";

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

/** Emit drag begin (unthrottled — fires once). */
export function emitDragBegin(payload: DragBeginPayload): void {
  emitLocalOp({ kind: "token.drag.begin", data: payload });
}

/** Emit drag update (throttled at 20 Hz / 50ms). */
export const emitDragUpdate = throttle((payload: DragUpdatePayload): void => {
  emitLocalOp({ kind: "token.drag.update", data: payload });
}, 50);

/** Emit drag end (unthrottled — fires once, also flushes last position). */
export function emitDragEnd(payload: DragEndPayload): void {
  emitLocalOp({ kind: "token.drag.end", data: payload });
}
