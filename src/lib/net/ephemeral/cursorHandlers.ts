// src/lib/net/ephemeral/cursorHandlers.ts
// Registers ephemeral handlers for cursor.update and cursor.visibility.
// Call registerCursorHandlers() once at app startup.

import { ephemeralBus } from "@/lib/net";
import { useCursorStore } from "@/stores/cursorStore";
import { useTokenEphemeralStore } from "@/stores/tokenEphemeralStore";
import type { CursorUpdatePayload, CursorVisibilityPayload } from "./types";

let registered = false;

export function registerCursorHandlers(): void {
  if (registered) return;
  registered = true;

  // Track last cursor update timestamp per user to throttle heavy re-renders
  const lastCursorUpdate = new Map<string, number>();

  ephemeralBus.on("cursor.update", (data: CursorUpdatePayload, userId) => {
    // Skip store update if cursor sharing is disabled — reduces unnecessary state churn
    if (!useCursorStore.getState().cursorSharingEnabled) return;

    // Fast path throttle: limit updates to ~30fps (33ms) to prevent UI thread lockup on Host
    const now = performance.now();
    const lastUpdate = lastCursorUpdate.get(userId) || 0;
    if (now - lastUpdate < 33) {
      return;
    }
    lastCursorUpdate.set(userId, now);

    useCursorStore.getState().setCursor(userId, {
      userId,
      x: data.pos.x,
      y: data.pos.y,
      color: data.color ?? "",
      tool: data.tool,
      name: data.name,
    });
  });

  ephemeralBus.on("cursor.visibility", (data: CursorVisibilityPayload, _userId) => {
    useCursorStore.getState().setCursorSharingEnabled(data.visible);
    // When DM disables sharing, also clear remote token hovers to stop
    // ephemeral-driven canvas redraws that cause selection flicker
    if (!data.visible) {
      const hoverStore = useTokenEphemeralStore.getState();
      for (const uid of Object.keys(hoverStore.hovers)) {
        hoverStore.removeHover(uid);
      }
    }
  });

  // Wire TTL cache expiry to remove stale cursors
  ephemeralBus.onCacheChange((key, entry) => {
    if (!entry && key.startsWith("cursor.update::")) {
      // Key format: "cursor.update::{userId}"
      const userId = key.replace("cursor.update::", "");
      if (userId) {
        useCursorStore.getState().removeCursor(userId);
      }
    }
  });
}
