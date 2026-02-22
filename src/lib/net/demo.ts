// src/lib/net/demo.ts
// Helper functions for testing the networking round-trip.

import { emitLocalOp } from "./index";
import { useSessionStore, type Token } from "@/stores/sessionStore";

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

/** Minimal token data sent over the wire for sync demo. */
export interface SyncTokenData {
  id: string;
  name: string;
  x: number;
  y: number;
  gridWidth: number;
  gridHeight: number;
  color?: string;
  label: string;
}

/** Broadcast all current tokens to remote clients (creates/updates them). */
export function sendSyncTokens(): void {
  const tokens = useSessionStore.getState().tokens;
  const payload: SyncTokenData[] = tokens.map((t) => ({
    id: t.id,
    name: t.name,
    x: t.x,
    y: t.y,
    gridWidth: t.gridWidth,
    gridHeight: t.gridHeight,
    color: t.color,
    label: t.label,
  }));
  emitLocalOp({ kind: "token.sync", data: { tokens: payload } });
}

/** Create a demo token locally and broadcast it. */
export function createAndSyncDemoToken(): void {
  const id = `demo-${Date.now().toString(16)}`;
  const token: Token = {
    id,
    name: `Demo Token`,
    imageUrl: "",
    x: 200 + Math.random() * 400,
    y: 200 + Math.random() * 400,
    gridWidth: 1,
    gridHeight: 1,
    label: `Demo ${id.slice(-4)}`,
    labelPosition: "below",
    roleId: "",
    isHidden: false,
    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
  };
  useSessionStore.getState().addToken(token);
  // Sync all tokens so remote gets the full picture
  sendSyncTokens();
}
