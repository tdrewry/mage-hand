// src/lib/net/tokenPositionSync.ts
// Emits token.position.sync at 10Hz (100ms) with delta-only positions.
// Only sends positions that changed since the last emission.

import { ephemeralBus } from "@/lib/net";
import { useSessionStore } from "@/stores/sessionStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";

/** Snapshot of last-emitted positions keyed by tokenId. */
const lastPositions = new Map<string, { x: number; y: number }>();

/** Interval handle for cleanup. */
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Diff current token positions against last snapshot and emit changes. */
function tickPositionSync(): void {
  // When Jazz is the active transport, it handles durable position sync —
  // skip the ephemeral position broadcast to avoid duplicating updates.
  if (useMultiplayerStore.getState().activeTransport === 'jazz') return;

  const tokens = useSessionStore.getState().tokens;
  const changed: Array<{ tokenId: string; x: number; y: number }> = [];

  for (const t of tokens) {
    const prev = lastPositions.get(t.id);
    if (!prev || prev.x !== t.x || prev.y !== t.y) {
      changed.push({ tokenId: t.id, x: t.x, y: t.y });
      lastPositions.set(t.id, { x: t.x, y: t.y });
    }
  }

  // Clean up removed tokens
  if (lastPositions.size > tokens.length) {
    const currentIds = new Set(tokens.map((t) => t.id));
    for (const id of lastPositions.keys()) {
      if (!currentIds.has(id)) lastPositions.delete(id);
    }
  }

  if (changed.length === 0) return;

  ephemeralBus.emit("token.position.sync", { positions: changed });
}

/** Start the 10Hz position sync loop. Idempotent. */
export function startPositionSync(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(tickPositionSync, 100);
}

/** Stop the position sync loop. */
export function stopPositionSync(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastPositions.clear();
}
