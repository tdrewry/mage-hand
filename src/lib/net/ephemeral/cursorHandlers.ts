// src/lib/net/ephemeral/cursorHandlers.ts
// Registers ephemeral handlers for cursor.update and cursor.visibility.
// Call registerCursorHandlers() once at app startup.

import { ephemeralBus } from "@/lib/net";
import { useCursorStore } from "@/stores/cursorStore";
import type { CursorUpdatePayload, CursorVisibilityPayload } from "./types";

let registered = false;

export function registerCursorHandlers(): void {
  if (registered) return;
  registered = true;

  ephemeralBus.on("cursor.update", (data: CursorUpdatePayload, userId) => {
    // Skip store update if cursor sharing is disabled — reduces unnecessary state churn
    if (!useCursorStore.getState().cursorSharingEnabled) return;
    useCursorStore.getState().setCursor(userId, {
      userId,
      x: data.pos.x,
      y: data.pos.y,
      color: data.color ?? "",
      tool: data.tool,
    });
  });

  ephemeralBus.on("cursor.visibility", (data: CursorVisibilityPayload, _userId) => {
    useCursorStore.getState().setCursorSharingEnabled(data.visible);
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
