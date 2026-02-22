// src/lib/net/demo.ts
// Helper functions for testing the networking round-trip.

import { emitLocalOp } from "./index";

/** Send a ping op (shows as toast on other clients). */
export function sendPing(message = "hello"): void {
  emitLocalOp({ kind: "ping", data: { message } });
}

/** Send a chat message op. */
export function sendChat(text: string): void {
  emitLocalOp({ kind: "chat.post", data: { text } });
}

/** Send a token move op. */
export function sendTokenMove(tokenId: string, x: number, y: number): void {
  emitLocalOp({ kind: "token.move", data: { tokenId, x, y } });
}
