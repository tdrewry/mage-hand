// src/lib/net/ephemeral/effectHandlers.ts
// Registers ephemeral handlers for effect.aura.state and effect.placement.preview.

import { ephemeralBus } from "@/lib/net";
import { useEffectStore } from "@/stores/effectStore";
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
      data.impacts,
      data.insideIds,
    );
  });

  // ── Placement Preview (inbound from other players) ──
  // Currently a no-op placeholder; rendering of remote placement ghosts
  // will be implemented in Phase 3.
  ephemeralBus.on("effect.placement.preview", (_data: EffectPlacementPreviewPayload, _userId) => {
    // Phase 3: store preview in an ephemeral overlay store for rendering
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
