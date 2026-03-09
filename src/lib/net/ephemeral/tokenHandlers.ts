// src/lib/net/ephemeral/tokenHandlers.ts
// Registers ephemeral handlers for token.hover, token.handle.preview,
// selection.preview, action.target.preview, token.drag.*, and token.position.sync.

import { ephemeralBus } from "@/lib/net";
import { useTokenEphemeralStore } from "@/stores/tokenEphemeralStore";
import { useDragPreviewStore } from "@/stores/dragPreviewStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
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

  // ── Token drag preview ops (migrated from durable OpBridge) ──

  ephemeralBus.on("token.drag.begin", (data: { tokenId: string; startPos: { x: number; y: number }; mode?: "freehand" | "directLine" }, userId) => {
    useDragPreviewStore.getState().beginDrag(data.tokenId, userId, data.startPos, data.mode ?? "freehand");
  });

  ephemeralBus.on("token.drag.update", (data: { tokenId: string; pos: { x: number; y: number }; path?: { x: number; y: number }[] }, userId) => {
    useDragPreviewStore.getState().updateDrag(data.tokenId, data.pos, data.path);
    // Move the actual token sprite so it renders via the normal pipeline
    useSessionStore.getState().updateTokenPosition(data.tokenId, data.pos.x, data.pos.y);
  });

  ephemeralBus.on("token.drag.end", (data: { tokenId: string }, _userId) => {
    useDragPreviewStore.getState().endDrag(data.tokenId);
  });

  // ── Token position sync (10Hz delta broadcast) ──
  // When Jazz is active, position sync is handled by Jazz CoValue subscriptions.
  ephemeralBus.on("token.position.sync", (data: TokenPositionSyncPayload, userId) => {
    // Skip when Jazz handles position sync
    if (useMultiplayerStore.getState().activeTransport === 'jazz') return;
    // Skip our own echoed position syncs
    if (userId === useMultiplayerStore.getState().currentUserId) return;
    const sessionStore = useSessionStore.getState();
    const activeDragPreviews = useDragPreviewStore.getState().previews;
    for (const p of data.positions) {
      // Skip tokens with active remote drag previews — drag.update handles those
      if (activeDragPreviews[p.tokenId]) continue;
      sessionStore.updateTokenPosition(p.tokenId, p.x, p.y);
    }
  });

}
