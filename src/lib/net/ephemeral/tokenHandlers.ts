// src/lib/net/ephemeral/tokenHandlers.ts
// Registers ephemeral handlers for token.hover, token.handle.preview,
// selection.preview, action.target.preview, token.drag.*, token.position.sync,
// and token.meta.sync.

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
  TokenMetaSyncPayload,
} from "./types";

let registered = false;
/** Interval handle for staleness auto-clear of remote drags */
let staleCheckInterval: ReturnType<typeof setInterval> | null = null;

/** Max age (ms) before a remote drag with no updates is auto-cleared.
 *  Acts as a safety net if token.drag.end is lost. */
const REMOTE_DRAG_STALE_MS = 3000;

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
    if (!userId || userId === useMultiplayerStore.getState().currentUserId) return;
    useRemoteDragStore.getState().beginDrag(
      data.tokenId,
      data.startPos,
      data.mode || "freehand",
      userId,
    );
  });

  ephemeralBus.on("token.drag.update", (data: { tokenId: string; pos: { x: number; y: number }; path?: { x: number; y: number }[] }, userId) => {
    if (!userId || userId === useMultiplayerStore.getState().currentUserId) return;
    // Write exclusively to the remote drag state; do NOT mutate durable sessionStore here
    useRemoteDragStore.getState().updateDrag(data.tokenId, data.pos, data.path || []);
  });

  ephemeralBus.on("token.drag.end", (data: { tokenId: string }, userId) => {
    if (!userId || userId === useMultiplayerStore.getState().currentUserId) return;
    useRemoteDragStore.getState().endDrag(data.tokenId);
  });

  // ── Staleness auto-clear ──
  // Safety net: if token.drag.end is lost over the network, remote decorations
  // will auto-expire after REMOTE_DRAG_STALE_MS of no updates.
  if (!staleCheckInterval) {
    staleCheckInterval = setInterval(() => {
      useRemoteDragStore.getState().expireStale(REMOTE_DRAG_STALE_MS);
    }, 1000);
  }

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

  // ── Token metadata sync ──
  // Broadcasts label, color, pathStyle, appearance, size changes for live preview
  // on remote clients without requiring a card save.
  ephemeralBus.on("token.meta.sync", (data: TokenMetaSyncPayload, userId) => {
    // Skip our own echoed meta syncs
    if (userId === useMultiplayerStore.getState().currentUserId) return;
    const { tokenId, meta } = data;
    const sessionStore = useSessionStore.getState();
    const existing = sessionStore.tokens.find(t => t.id === tokenId);
    if (!existing) return;
    // Merge meta fields into the token — excludes position (handled by drag/position sync)
    const { x: _x, y: _y, ...safeMeta } = meta as Record<string, unknown>;
    useSessionStore.setState((state) => ({
      tokens: state.tokens.map(t =>
        t.id === tokenId ? { ...t, ...safeMeta } : t
      ),
    }));
  });

}
