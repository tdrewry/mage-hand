// src/lib/net/ephemeral/ambientHandlers.ts
// Registers ephemeral handlers for ambient loop sync (host → all clients).

import { ephemeralBus } from "@/lib/net";
import { playAmbientLoop, stopAmbientLoop } from "@/lib/ambientEngine";
import { useSoundStore } from "@/stores/soundStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import type { AmbientLoopPlayPayload, AmbientLoopStopPayload } from "./types";

let registered = false;

export function registerAmbientHandlers(): void {
  if (registered) return;
  registered = true;

  // Inbound: host broadcasts a loop — all clients start playing it
  ephemeralBus.on("ambient.loop.play", (data: AmbientLoopPlayPayload, userId) => {
    // Ignore our own echo — we already started playback locally
    const myId = useMultiplayerStore.getState().currentUserId;
    if (userId === myId) return;

    useSoundStore.getState().setActiveAmbientLoopId(data.loopId);
    useSoundStore.getState().setAmbientVolume(data.volume);
    playAmbientLoop(data.loopId, data.volume).catch(() => {});
  });

  // Inbound: host stops the ambient loop
  ephemeralBus.on("ambient.loop.stop", (_data: AmbientLoopStopPayload, userId) => {
    const myId = useMultiplayerStore.getState().currentUserId;
    if (userId === myId) return;

    useSoundStore.getState().setActiveAmbientLoopId(null);
    stopAmbientLoop();
  });
}

// ── Outbound helpers ──────────────────────────────────────────────────────

/** Host broadcasts "start playing this loop" to all connected clients. */
export function emitAmbientLoopPlay(loopId: string, volume: number): void {
  ephemeralBus.emit("ambient.loop.play", { loopId, volume });
}

/** Host broadcasts "stop the ambient loop" to all connected clients. */
export function emitAmbientLoopStop(): void {
  ephemeralBus.emit("ambient.loop.stop", {});
}
