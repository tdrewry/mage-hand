// src/lib/net/ephemeral/mapHandlers.ts
// Registers ephemeral handlers for map, region, and map object ops.

import { ephemeralBus } from "@/lib/net";
import { useMapEphemeralStore } from "@/stores/mapEphemeralStore";
import type {
  DmViewportPayload,
  MapPingPayload,
  MapFocusPayload,
  RegionDragUpdatePayload,
  MapObjectDragUpdatePayload,
} from "./types";

let registered = false;

export function registerMapHandlers(): void {
  if (registered) return;
  registered = true;

  const store = useMapEphemeralStore;

  ephemeralBus.on("map.dm.viewport", (data: DmViewportPayload, userId) => {
    store.getState().setDmViewport({ userId, x: data.x, y: data.y, zoom: data.zoom });
  });

  ephemeralBus.on("map.ping", (data: MapPingPayload, userId) => {
    store.getState().addPing(userId, {
      userId,
      pos: data.pos,
      color: data.color,
      label: data.label,
      ts: Date.now(),
    });
  });

  ephemeralBus.on("map.focus", (data: MapFocusPayload, _userId) => {
    store.getState().setFocus({ pos: data.pos, zoom: data.zoom });
  });

  ephemeralBus.on("region.drag.update", (data: RegionDragUpdatePayload, userId) => {
    store.getState().setRegionDrag(data.regionId, {
      entityId: data.regionId,
      userId,
      pos: data.pos,
    });
  });

  ephemeralBus.on("mapObject.drag.update", (data: MapObjectDragUpdatePayload, userId) => {
    store.getState().setMapObjectDrag(data.objectId, {
      entityId: data.objectId,
      userId,
      pos: data.pos,
    });
  });

  // TTL expiry cleanup
  ephemeralBus.onCacheChange((key, entry) => {
    if (entry) return;

    if (key.startsWith("map.dm.viewport::")) {
      store.getState().setDmViewport(null);
    } else if (key.startsWith("map.ping::")) {
      const userId = key.replace("map.ping::", "");
      store.getState().removePing(userId);
    } else if (key.startsWith("map.focus::")) {
      store.getState().setFocus(null);
    } else if (key.startsWith("region.drag.update::")) {
      const entityId = key.replace("region.drag.update::", "");
      store.getState().removeRegionDrag(entityId);
    } else if (key.startsWith("mapObject.drag.update::")) {
      const entityId = key.replace("mapObject.drag.update::", "");
      store.getState().removeMapObjectDrag(entityId);
    }
  });
}
