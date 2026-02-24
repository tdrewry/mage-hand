// src/lib/net/ephemeral/presenceHandlers.ts
// Registers ephemeral handlers for presence.viewingMap and presence.activity.

import { ephemeralBus } from "@/lib/net";
import { usePresenceStore } from "@/stores/presenceStore";
import type { PresenceViewingMapPayload, PresenceActivityPayload } from "./types";

let registered = false;

export function registerPresenceHandlers(): void {
  if (registered) return;
  registered = true;

  ephemeralBus.on("presence.viewingMap", (data: PresenceViewingMapPayload, userId) => {
    usePresenceStore.getState().setViewingMap(userId, data.mapId);
  });

  ephemeralBus.on("presence.activity", (data: PresenceActivityPayload, userId) => {
    usePresenceStore.getState().setActivity(userId, data.activity);
  });

  // Wire TTL cache expiry to clean up stale presence
  ephemeralBus.onCacheChange((key, entry) => {
    if (!entry) {
      if (key.startsWith("presence.viewingMap::")) {
        const userId = key.replace("presence.viewingMap::", "");
        if (userId) usePresenceStore.getState().setViewingMap(userId, null);
      } else if (key.startsWith("presence.activity::")) {
        const userId = key.replace("presence.activity::", "");
        if (userId) usePresenceStore.getState().setActivity(userId, null);
      }
    }
  });
}
