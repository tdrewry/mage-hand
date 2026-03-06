// src/lib/net/ephemeral/tokenHandlers.ts
// Registers ephemeral handlers for token.hover, token.handle.preview,
// selection.preview, and action.target.preview.

import { ephemeralBus } from "@/lib/net";
import { useTokenEphemeralStore } from "@/stores/tokenEphemeralStore";
import { useDragPreviewStore } from "@/stores/dragPreviewStore";
import type {
  TokenHoverPayload,
  TokenHandlePreviewPayload,
  SelectionPreviewPayload,
  ActionTargetPreviewPayload,
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
  });

  ephemeralBus.on("token.drag.end", (data: { tokenId: string }, _userId) => {
    useDragPreviewStore.getState().endDrag(data.tokenId);
  });
  ephemeralBus.onCacheChange((key, entry) => {
    if (entry) return; // only care about removals

    if (key.startsWith("token.hover::")) {
      const userId = key.replace("token.hover::", "");
      store.getState().removeHover(userId);
    } else if (key.startsWith("token.handle.preview::")) {
      const userId = key.replace("token.handle.preview::", "");
      store.getState().removeHandlePreview(userId);
    } else if (key.startsWith("selection.preview::")) {
      const userId = key.replace("selection.preview::", "");
      store.getState().removeSelectionPreview(userId);
    } else if (key.startsWith("action.target.preview::")) {
      const userId = key.replace("action.target.preview::", "");
      store.getState().removeActionTarget(userId);
    }
  });
}
