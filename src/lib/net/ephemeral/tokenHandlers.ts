// src/lib/net/ephemeral/tokenHandlers.ts
// Registers ephemeral handlers for token.hover, token.handle.preview,
// selection.preview, action.target.preview, token.drag.*, and token.position.sync.

import { ephemeralBus } from "@/lib/net";
import { useTokenEphemeralStore } from "@/stores/tokenEphemeralStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { useRemoteDragStore } from "@/stores/remoteDragStore";
import type {
  TokenHoverPayload,
  TokenHandlePreviewPayload,
  SelectionPreviewPayload,
  ActionTargetPreviewPayload,
  TokenPositionSyncPayload,
} from "./types";

let registered = false;

export function registerTokenHandlers(): void {
  if (registered) return;
  registered = true;

  const store = useTokenEphemeralStore;

  ephemeralBus.on("token.hover", (data: TokenHoverPayload, userId) => {
    store.getState().setHover(userId, data.tokenId);
  });

  ephemeralBus.on("token.handle.preview", (data: TokenHandlePreviewPayload, userId) => {
    store.getState().setHandlePreview(userId, {
      userId,
      tokenId: data.tokenId,
      handleType: data.handleType,
      pos: data.pos,
      value: data.value,
    });
  });

  ephemeralBus.on("selection.preview", (data: SelectionPreviewPayload, userId) => {
    store.getState().setSelectionPreview(userId, {
      userId,
      rect: data.rect,
      polyline: data.polyline,
    });
  });

  ephemeralBus.on("action.target.preview", (data: ActionTargetPreviewPayload, userId) => {
    store.getState().setActionTarget(userId, {
      userId,
      sourceTokenId: data.sourceTokenId,
      pos: data.pos,
    });
  });

  // ── Token drag preview ops ──
  // Remote drags move the real token sprite AND track decoration metadata
  // (start position + path) so remote clients render the same ghost/path visuals.

  ephemeralBus.on("token.drag.begin", (data: { tokenId: string; startPos: { x: number; y: number }; mode?: "freehand" | "directLine" }, userId) => {
    useRemoteDragStore.getState().beginDrag(
      data.tokenId,
      data.startPos,
      data.mode || "freehand",
      userId,
    );
  });

  ephemeralBus.on("token.drag.update", (data: { tokenId: string; pos: { x: number; y: number }; path?: { x: number; y: number }[] }, _userId) => {
    // Move the actual token sprite so it renders via the normal pipeline
    useSessionStore.getState().updateTokenPosition(data.tokenId, data.pos.x, data.pos.y);
    // Update path decoration data
    if (data.path) {
      useRemoteDragStore.getState().updateDrag(data.tokenId, data.path);
    }
  });

  ephemeralBus.on("token.drag.end", (data: { tokenId: string }, _userId) => {
    useRemoteDragStore.getState().endDrag(data.tokenId);
  });

  // ── Token position sync (10Hz delta broadcast) ──
  // When Jazz is active, position sync is handled by Jazz CoValue subscriptions.
  ephemeralBus.on("token.position.sync", (data: TokenPositionSyncPayload, userId) => {
    // Skip when Jazz handles position sync
    if (useMultiplayerStore.getState().activeTransport === 'jazz') return;
    // Skip our own echoed position syncs
    if (userId === useMultiplayerStore.getState().currentUserId) return;
    const sessionStore = useSessionStore.getState();
    for (const p of data.positions) {
      sessionStore.updateTokenPosition(p.tokenId, p.x, p.y);
    }
  });

}
