// src/lib/net/ephemeral/effectHandlers.ts
// Registers ephemeral handlers for effect.aura.state and effect.placement.preview.

import { ephemeralBus } from "@/lib/net";
import { useEffectStore } from "@/stores/effectStore";
import { useMiscEphemeralStore } from "@/stores/miscEphemeralStore";
import { triggerSound } from "@/lib/soundEngine";
import type { EffectImpact } from "@/types/effectTypes";
import type {
  EffectAuraStatePayload,
  EffectPlacementPreviewPayload,
} from "./types";

let registered = false;

export function registerEffectHandlers(): void {
  if (registered) return;
  registered = true;

  // ── Aura State (inbound from DM/owner) ──
  ephemeralBus.on("effect.aura.state", (data: EffectAuraStatePayload, _userId) => {
    useEffectStore.getState().updateAuraState(
      data.effectId,
      data.origin,
      data.impacts as EffectImpact[],
      data.insideIds,
    );
  });

  // ── Placement Preview (inbound from other players) ──
  ephemeralBus.on("effect.placement.preview", (data: EffectPlacementPreviewPayload, userId) => {
    useMiscEphemeralStore.getState().setEffectPlacementPreview(userId, {
      templateId: data.templateId,
      origin: data.origin,
      direction: data.direction,
    });
  });

  // TTL expiry cleanup for placement previews
  ephemeralBus.onCacheChange((key, entry) => {
    if (entry) return;
    if (key.startsWith("effect.placement.preview::")) {
      const userId = key.replace("effect.placement.preview::", "");
      useMiscEphemeralStore.getState().removeEffectPlacementPreview(userId);
    }
  });
}

// ── Outbound helpers ──

/**
 * Broadcast aura state after tickAuras. Should only be called by the
 * authoritative client (DM or aura owner).
 */
export function emitAuraState(
  effectId: string,
  origin: { x: number; y: number },
  insideIds: string[],
  impacts: Array<{
    targetId: string;
    targetType: string;
    distanceFromOrigin: number;
    overlapPercent: number;
  }>,
): void {
  ephemeralBus.emit("effect.aura.state", {
    effectId,
    origin,
    insideIds,  
    impacts,
  });
}
