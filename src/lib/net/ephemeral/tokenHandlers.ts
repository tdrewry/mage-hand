// src/lib/net/ephemeral/tokenHandlers.ts
// Registers ephemeral handlers for token.hover, token.handle.preview,
// selection.preview, action.target.preview, token.drag.*, token.position.sync,
// and token.meta.sync.

import { ephemeralBus } from "@/lib/net";
import { useTokenEphemeralStore } from "@/stores/tokenEphemeralStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { useRemoteDragStore } from "@/stores/remoteDragStore";
import { FEATURE_EPHEMERAL_TOKEN_DRAG } from "@/lib/featureFlags";
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
  // Gated by FEATURE_EPHEMERAL_TOKEN_DRAG. When false, no drag events are
  // processed ephemerally — Jazz CRDT durable sync on drag end is the sole
  // mechanism for propagating token positions to remote clients.

  ephemeralBus.on("token.drag.begin", (data: { tokenId: string; startPos: { x: number; y: number }; mode?: "freehand" | "directLine" }, userId) => {
    if (!FEATURE_EPHEMERAL_TOKEN_DRAG) return;
    if (!userId || userId === useMultiplayerStore.getState().currentUserId) return;
    useRemoteDragStore.getState().beginDrag(
      data.tokenId,
      data.startPos,
      data.mode || "freehand",
      userId,
    );
    // Tell the Jazz bridge to suppress inbound CRDT position updates for this
    // token while the remote drag is in flight — prevents Jazz callbacks from
    // fighting the ephemeral drag preview and causing flicker.
    import("@/lib/jazz/bridge").then(({ markTokenDragStart }) => {
      markTokenDragStart(data.tokenId);
      console.log(`[tokenHandlers] token.drag.begin: suppressing Jazz inbound for ${data.tokenId}`);
    });
  });

  ephemeralBus.on("token.drag.update", (data: { tokenId: string; pos: { x: number; y: number }; path?: { x: number; y: number }[] }, userId) => {
    if (!FEATURE_EPHEMERAL_TOKEN_DRAG) return;
    if (!userId || userId === useMultiplayerStore.getState().currentUserId) return;
    // Write exclusively to the remote drag state; do NOT mutate durable sessionStore here
    useRemoteDragStore.getState().updateDrag(data.tokenId, data.pos, data.path || []);
  });

  ephemeralBus.on("token.drag.end", (data: { tokenId: string; finalPos?: { x: number; y: number } }, userId) => {
    if (!FEATURE_EPHEMERAL_TOKEN_DRAG) return;
    if (!userId || userId === useMultiplayerStore.getState().currentUserId) return;
    useRemoteDragStore.getState().endDrag(data.tokenId);

    // Apply the authoritative final position immediately so the remote client
    // snaps to the correct landing spot without waiting for the Jazz CRDT cycle.
    // finalPos may be absent from older peers — degrade gracefully by letting Jazz catch up.
    if (data.finalPos) {
      useSessionStore.getState().updateTokenPosition(data.tokenId, data.finalPos.x, data.finalPos.y);
      console.log(`[tokenHandlers] token.drag.end: applying finalPos ${JSON.stringify(data.finalPos)} for ${data.tokenId}`);
    }

    // Signal the Jazz bridge to enter its post-drag grace period for this token.
    // This prevents any stale CRDT update arriving in the next ~600 ms from
    // snapping the token back to its pre-drag position.
    import("@/lib/jazz/bridge").then(({ markTokenDragEnd }) => {
      markTokenDragEnd(data.tokenId);
    });
  });

  // ── Staleness auto-clear ──
  // Only needed when ephemeral drag is active. Skipped otherwise.
  if (FEATURE_EPHEMERAL_TOKEN_DRAG && !staleCheckInterval) {
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
