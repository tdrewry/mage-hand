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
import { useCardStore } from "@/stores/cardStore";
import { CardType } from "@/types/cardTypes";
import { saveTextureByHash } from "@/lib/textureStorage";
import { triggerSound } from "@/lib/soundEngine";
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
  RoleAssignPayload,
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

/** Open the Action Card for DMs when a remote action arrives */
function openActionCardForDM() {
  const cardStore = useCardStore.getState();
  let actionCard = cardStore.cards.find(c => c.type === CardType.ACTION_CARD);
  if (!actionCard) {
    const newId = cardStore.registerCard({
      type: CardType.ACTION_CARD,
      title: 'Action',
      defaultPosition: { x: 400, y: 200 },
      defaultSize: { width: 420, height: 480 },
      defaultVisible: true,
    });
    actionCard = cardStore.getCard(newId) ?? undefined;
  }
  if (actionCard) {
    cardStore.setVisibility(actionCard.id, true);
    cardStore.bringToFront(actionCard.id);
  }
}

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

  // ── Role Assignment (DM → all) ──
  ephemeralBus.on("role.assign", (data: RoleAssignPayload, _userId) => {
    const myUserId = useMultiplayerStore.getState().currentUserId;
    // Update the connected user's roles in the multiplayer store
    useMultiplayerStore.getState().updateUserRoles(data.targetUserId, data.roleIds);
    
    // If this change targets us, update our own roles
    if (data.targetUserId === myUserId) {
      useMultiplayerStore.getState().setRoles(data.roleIds);
      toast.info(`Your roles have been updated to: ${data.roleIds.join(', ')}`, { duration: 5000 });
    }
  });

  // ── Actions (DM queue sync) ──
  ephemeralBus.on("action.queue.sync", (data: ActionQueueSyncPayload, _userId) => {
    const hadAction = !!useActionStore.getState().currentAction;
    useActionStore.getState().hydrateQueue(data.currentAction, data.pendingActions, data.actionHistory);

    // Auto-open Action Card for DMs when a new action arrives
    if (!hadAction && data.currentAction) {
      const roles = useMultiplayerStore.getState().roles;
      if (roles.includes("dm")) {
        openActionCardForDM();
      }
    }
  });

  // ── Action Pending (broadcast to all — players see toast, DMs see Action Card) ──
  ephemeralBus.on("action.pending", (data: ActionPendingPayload, _userId) => {
    const roles = useMultiplayerStore.getState().roles;
    if (roles.includes("dm")) {
      openActionCardForDM();
    }
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

  // ── Art Submission (player → DM) ──
  ephemeralBus.on("asset.submission", (data: AssetSubmissionPayload, userId) => {
    // Only DMs should process incoming submissions
    const roles = useMultiplayerStore.getState().roles;
    if (!roles.includes("dm")) return;

    useArtSubmissionStore.getState().addSubmission({
      id: data.submissionId,
      playerId: userId,
      playerName: data.playerName,
      targetType: data.targetType,
      targetId: data.targetId,
      targetName: data.targetName,
      textureHash: data.textureHash,
      textureDataUrl: data.textureDataUrl,
      status: 'pending',
      submittedAt: Date.now(),
    });

    toast.info(`${data.playerName} submitted art for ${data.targetName}`, {
      description: "Check the Art Approval card to review.",
    });
  });

  // ── Art Accepted (DM → all) ──
  ephemeralBus.on("asset.accepted", (data: AssetAcceptedPayload, _userId) => {
    // Apply the accepted texture to the target entity
    applyAcceptedArt(data);
  });

  // ── Art Rejected (DM → submitter) ──
  ephemeralBus.on("asset.rejected", (data: AssetRejectedPayload, _userId) => {
    toast.info(`Art submission was declined${data.reason ? `: ${data.reason}` : ""}`, {
      description: "The DM did not approve your art submission.",
    });
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

// ── Helpers ──

/** Apply accepted art to the target entity and persist the texture */
async function applyAcceptedArt(data: AssetAcceptedPayload): Promise<void> {
  try {
    if (data.targetType === 'token') {
      await saveTextureByHash(data.textureHash, data.textureDataUrl);
      useSessionStore.getState().updateTokenImage(data.targetId, data.textureDataUrl, data.textureHash);
      toast.success(`Art applied to token`);
    } else if (data.targetType === 'region') {
      await saveTextureByHash(data.textureHash, data.textureDataUrl);
      // Region texture application would go through regionStore
      toast.success(`Art applied to region`);
    } else {
      toast.success(`Art accepted for ${data.targetType}`);
    }
  } catch (err) {
    console.error("[miscHandlers] Failed to apply accepted art:", err);
  }
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

/**
 * Emit upload progress to peers.
 * Call periodically during texture uploads.
 */
export function emitAssetUploadProgress(assetId: string, percent: number): void {
  ephemeralBus.emit("asset.uploadProgress", { assetId, percent });
}

/**
 * Submit art for DM approval.
 * Called by players when they upload art for an entity they own.
 */
export function emitArtSubmission(
  targetType: AssetSubmissionPayload['targetType'],
  targetId: string,
  targetName: string,
  textureHash: string,
  textureDataUrl: string,
): void {
  const submissionId = `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const playerName = useMultiplayerStore.getState().currentUsername || "Unknown";
  ephemeralBus.emit("asset.submission", {
    submissionId,
    targetType,
    targetId,
    targetName,
    playerName,
    textureHash,
    textureDataUrl,
  });
  toast.success("Art submitted for DM approval");
}

/**
 * Accept a player's art submission (DM only).
 * Broadcasts the accepted texture to all peers.
 */
export function emitArtAccepted(submission: {
  id: string;
  targetType: AssetSubmissionPayload['targetType'];
  targetId: string;
  textureHash: string;
  textureDataUrl: string;
}): void {
  ephemeralBus.emit("asset.accepted", {
    submissionId: submission.id,
    targetType: submission.targetType,
    targetId: submission.targetId,
    textureHash: submission.textureHash,
    textureDataUrl: submission.textureDataUrl,
  });
  // Also apply locally on the DM side
  applyAcceptedArt({
    submissionId: submission.id,
    targetType: submission.targetType,
    targetId: submission.targetId,
    textureHash: submission.textureHash,
    textureDataUrl: submission.textureDataUrl,
  });
}

/**
 * Reject a player's art submission (DM only).
 */
export function emitArtRejected(submissionId: string, reason?: string): void {
  ephemeralBus.emit("asset.rejected", { submissionId, reason });
}
