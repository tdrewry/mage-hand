// src/lib/net/ephemeral/miscHandlers.ts
// Registers ephemeral handlers for fog, dice, initiative, groups, roles, actions, and assets.

import { ephemeralBus } from "@/lib/net";
import { useMiscEphemeralStore } from "@/stores/miscEphemeralStore";
import { useFogStore } from "@/stores/fogStore";
import { useActionStore } from "@/stores/actionStore";
import { useChatStore } from "@/stores/chatStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { useActionPendingStore } from "@/stores/actionPendingStore";
import { useArtSubmissionStore } from "@/stores/artSubmissionStore";
import { useSessionStore } from "@/stores/sessionStore";
import { saveTextureByHash } from "@/lib/textureStorage";
import { saveTextureByHash as saveTokenTextureByHash } from "@/lib/tokenTextureStorage";
import { toast } from "sonner";
import type {
  FogCursorPreviewPayload,
  FogRevealPreviewPayload,
  ChatTypingPayload,
  ChatMessagePayload,
  DiceRollingPayload,
  InitiativeDragPreviewPayload,
  InitiativeHoverPayload,
  GroupSelectPreviewPayload,
  GroupDragPreviewPayload,
  RoleHandRaisePayload,
  AssetUploadProgressPayload,
  AssetSubmissionPayload,
  AssetAcceptedPayload,
  AssetRejectedPayload,
  ActionQueueSyncPayload,
  ActionPendingPayload,
  ActionResolvedPayload,
  ActionResolutionClaimPayload,
} from "./types";

let registered = false;

export function registerMiscHandlers(): void {
  if (registered) return;
  registered = true;

  const store = useMiscEphemeralStore;

  // ── Fog ──
  ephemeralBus.on("fog.cursor.preview", (data: FogCursorPreviewPayload, userId) => {
    store.getState().setFogCursor(userId, { userId, pos: data.pos, radius: data.radius, tool: data.tool });
  });

  ephemeralBus.on("fog.reveal.preview", (data: FogRevealPreviewPayload, _userId) => {
    // Committed reveal — update the fog store so the canvas redraws with the new explored area
    if (data.shape === "committed" && data.serializedExploredAreas != null) {
      const mapId = data.mapId || 'default-map';
      useFogStore.getState().setSerializedExploredAreasForMap(mapId, data.serializedExploredAreas);
    }
  });

  // ── Chat & Dice ──
  ephemeralBus.on("chat.typing", (_data: ChatTypingPayload, userId) => {
    store.getState().setChatTyping(userId);
  });

  ephemeralBus.on("chat.message", (data: ChatMessagePayload, userId) => {
    // If whisper, only show to intended recipients
    if (data.whisperTo && data.whisperTo.length > 0) {
      const myId = useMultiplayerStore.getState().currentUserId;
      if (myId && !data.whisperTo.includes(myId)) return; // Not for us
    }
    useChatStore.getState().addRemoteMessage(data.id, userId, data.senderName, data.text, data.timestamp, data.whisperTo);
  });

  ephemeralBus.on("dice.rolling", (data: DiceRollingPayload, userId) => {
    store.getState().setDiceRolling(userId, data.formula);
  });

  // ── Initiative ──
  ephemeralBus.on("initiative.drag.preview", (data: InitiativeDragPreviewPayload, userId) => {
    store.getState().setInitiativeDrag(userId, { userId, entryIndex: data.entryIndex, targetIndex: data.targetIndex });
  });

  ephemeralBus.on("initiative.hover", (data: InitiativeHoverPayload, userId) => {
    store.getState().setInitiativeHover(userId, data.entryIndex);
  });

  // ── Groups ──
  ephemeralBus.on("group.select.preview", (data: GroupSelectPreviewPayload, userId) => {
    store.getState().setGroupSelect(userId, data.groupId);
  });

  ephemeralBus.on("group.drag.preview", (data: GroupDragPreviewPayload, userId) => {
    store.getState().setGroupDrag(userId, { userId, groupId: data.groupId, delta: data.delta });
  });

  // ── Roles ──
  ephemeralBus.on("role.handRaise", (_data: RoleHandRaisePayload, userId) => {
    store.getState().setHandRaise(userId);
  });

  // ── Actions (DM queue sync) ──
  ephemeralBus.on("action.queue.sync", (data: ActionQueueSyncPayload, _userId) => {
    useActionStore.getState().hydrateQueue(data.currentAction, data.pendingActions, data.actionHistory);
  });

  // ── Action Pending (broadcast to all — players see toast) ──
  ephemeralBus.on("action.pending", (data: ActionPendingPayload, _userId) => {
    useActionPendingStore.getState().setPending({
      ...data,
      receivedAt: Date.now(),
    });
  });

  // ── Action Resolved (broadcast to all — players see outcome summary) ──
  ephemeralBus.on("action.resolved", (data: ActionResolvedPayload, _userId) => {
    useActionPendingStore.getState().addResolved({
      ...data,
      receivedAt: Date.now(),
    });
  });

  // ── Action Resolution Claim (multi-DM coordination) ──
  ephemeralBus.on("action.resolution.claim", (data: ActionResolutionClaimPayload, _userId) => {
    if (data.claimedBy) {
      useActionPendingStore.getState().setClaim(data.actionId, {
        actionId: data.actionId,
        claimedBy: data.claimedBy,
        claimedByName: data.claimedByName || "Unknown DM",
        receivedAt: Date.now(),
      });
    } else {
      useActionPendingStore.getState().setClaim(data.actionId, null);
    }
  });

  // ── Assets ──
  ephemeralBus.on("asset.uploadProgress", (data: AssetUploadProgressPayload, userId) => {
    store.getState().setUploadProgress(userId, { userId, assetId: data.assetId, percent: data.percent });
  });

  // ── TTL expiry cleanup ──
  ephemeralBus.onCacheChange((key, entry) => {
    if (entry) return;

    if (key.startsWith("fog.cursor.preview::")) {
      store.getState().removeFogCursor(key.replace("fog.cursor.preview::", ""));
    } else if (key.startsWith("chat.typing::")) {
      store.getState().removeChatTyping(key.replace("chat.typing::", ""));
    } else if (key.startsWith("dice.rolling::")) {
      store.getState().removeDiceRolling(key.replace("dice.rolling::", ""));
    } else if (key.startsWith("initiative.drag.preview::")) {
      store.getState().removeInitiativeDrag(key.replace("initiative.drag.preview::", ""));
    } else if (key.startsWith("initiative.hover::")) {
      store.getState().removeInitiativeHover(key.replace("initiative.hover::", ""));
    } else if (key.startsWith("group.select.preview::")) {
      store.getState().removeGroupSelect(key.replace("group.select.preview::", ""));
    } else if (key.startsWith("group.drag.preview::")) {
      store.getState().removeGroupDrag(key.replace("group.drag.preview::", ""));
    } else if (key.startsWith("role.handRaise::")) {
      store.getState().removeHandRaise(key.replace("role.handRaise::", ""));
    } else if (key.startsWith("asset.uploadProgress::")) {
      store.getState().removeUploadProgress(key.replace("asset.uploadProgress::", ""));
    }
  });
}

// ── Outbound helpers ──

/**
 * Emit a chat.typing indicator to peers.
 * Call on keypress in chat input; throttled at 200ms by EphemeralBus config.
 */
export function emitChatTyping(): void {
  ephemeralBus.emit("chat.typing", {});
}

/**
 * Broadcast a chat message to all peers.
 */
export function emitChatMessage(id: string, senderName: string, text: string, whisperTo?: string[]): void {
  ephemeralBus.emit("chat.message", { id, senderName, text, timestamp: Date.now(), whisperTo });
}
