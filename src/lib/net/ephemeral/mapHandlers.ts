// src/lib/net/ephemeral/mapHandlers.ts
// Registers ephemeral handlers for map, region, map object, and portal ops.

import { ephemeralBus } from "@/lib/net";
import { useMapEphemeralStore } from "@/stores/mapEphemeralStore";
import { useMapObjectStore } from "@/stores/mapObjectStore";
import { useMapStore } from "@/stores/mapStore";
import { useMapFocusStore } from "@/stores/mapFocusStore";
import { triggerSound } from "@/lib/soundEngine";
import type {
  DmViewportPayload,
  DmEnforceFollowPayload,
  MapPingPayload,
  MapFocusPayload,
  MapTreeSyncPayload,
  RegionDragUpdatePayload,
  MapObjectDragUpdatePayload,
  MapObjectDoorPreviewPayload,
  RegionHandlePreviewPayload,
  MapObjectHandlePreviewPayload,
  TokenHandlePreviewPayload,
  MapDmSelectMapPayload,
  PortalActivatePayload,
  PortalTeleportRequestPayload,
  PortalTeleportApprovedPayload,
  PortalTeleportDeniedPayload,
} from "./types";

let registered = false;

export function registerMapHandlers(): void {
  if (registered) return;
  registered = true;

  const store = useMapEphemeralStore;

  ephemeralBus.on("map.dm.viewport", (data: DmViewportPayload, userId) => {
    store.getState().setDmViewport({ userId, x: data.x, y: data.y, zoom: data.zoom });
  });

  ephemeralBus.on("map.dm.enforceFollow", (data: DmEnforceFollowPayload, _userId) => {
    // DM is commanding all players to follow/unfollow
    store.getState().setFollowDM(data.enforce);
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

  // Door toggle preview — remote peer toggled a door
  ephemeralBus.on("mapObject.door.preview", (data: MapObjectDoorPreviewPayload, _userId) => {
    useMapObjectStore.getState().setDoorState(data.objectId, data.open);
  });

  // Region handle preview (rotate/scale)
  ephemeralBus.on("region.handle.preview", (data: RegionHandlePreviewPayload, userId) => {
    store.getState().setHandlePreview(data.regionId, {
      userId,
      entityId: data.regionId,
      entityType: "region",
      handleType: data.handleType,
      pos: data.pos,
      value: data.value,
    });
  });

  // MapObject handle preview (rotate/scale)
  ephemeralBus.on("mapObject.handle.preview", (data: MapObjectHandlePreviewPayload, userId) => {
    store.getState().setHandlePreview(data.objectId, {
      userId,
      entityId: data.objectId,
      entityType: "mapObject",
      handleType: data.handleType,
      pos: data.pos,
      value: data.value,
    });
  });

  // Map selection sync (DM selects/switches map → players follow)
  ephemeralBus.on("map.dm.selectMap", (data: MapDmSelectMapPayload, _userId) => {
    console.log(`[mapHandlers] DM switched to map: ${data.mapId}`);
    useMapStore.getState().setSelectedMap(data.mapId);
  });

  // Full map tree sync from DM → all clients
  ephemeralBus.on("map.tree.sync", (data: MapTreeSyncPayload, _userId) => {
    console.log(`[mapHandlers] Received map tree sync from DM — ${data.mapActivations.length} maps`);

    // Apply map activations
    const mapStore = useMapStore.getState();
    for (const ma of data.mapActivations) {
      const existing = mapStore.maps.find(m => m.id === ma.mapId);
      if (existing && existing.active !== ma.active) {
        mapStore.updateMap(ma.mapId, { active: ma.active });
      }
    }

    // Apply structures
    if (data.structures) {
      useMapStore.setState({ structures: data.structures });
    }

    // Apply selected map
    if (data.selectedMapId) {
      const exists = useMapStore.getState().maps.some(m => m.id === data.selectedMapId);
      if (exists) {
        useMapStore.getState().setSelectedMap(data.selectedMapId);
      }
    }

    // Apply focus settings
    if (data.focusSettings) {
      const fs = useMapFocusStore.getState();
      fs.setUnfocusedOpacity(data.focusSettings.unfocusedOpacity);
      fs.setUnfocusedBlur(data.focusSettings.unfocusedBlur);
      fs.setSelectionLockEnabled(data.focusSettings.selectionLockEnabled);
    }
  });

  // Portal activation flash (remote portal animation trigger)
  ephemeralBus.on("portal.activate", (data: PortalActivatePayload, _userId) => {
    triggerSound('portal.activate');
    store.getState().setPortalActivation(data.objectId);
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
    } else if (key.startsWith("region.handle.preview::")) {
      const entityId = key.replace("region.handle.preview::", "");
      store.getState().removeHandlePreview(entityId);
    } else if (key.startsWith("mapObject.handle.preview::")) {
      const entityId = key.replace("mapObject.handle.preview::", "");
      store.getState().removeHandlePreview(entityId);
    } else if (key.startsWith("portal.activate::")) {
      const objectId = key.replace("portal.activate::", "");
      store.getState().removePortalActivation(objectId);
    }
  });
}

// ── Outbound helpers ──

/** Broadcast a door toggle to peers. */
export function emitDoorPreview(objectId: string, open: boolean): void {
  ephemeralBus.emit("mapObject.door.preview", { objectId, open });
}

/** Broadcast a region handle (rotate/scale) preview to peers. */
export function emitRegionHandlePreview(regionId: string, handleType: "rotate" | "scale", pos: { x: number; y: number }, value?: number): void {
  ephemeralBus.emit("region.handle.preview", { regionId, handleType, pos, value });
}

/** Broadcast a map object handle (rotate/scale) preview to peers. */
export function emitMapObjectHandlePreview(objectId: string, handleType: "rotate" | "scale", pos: { x: number; y: number }, value?: number): void {
  ephemeralBus.emit("mapObject.handle.preview", { objectId, handleType, pos, value });
}

/** Broadcast a token handle (rotate/scale) preview to peers. */
export function emitTokenHandlePreview(tokenId: string, handleType: "rotate" | "scale", pos: { x: number; y: number }, value?: number): void {
  ephemeralBus.emit("token.handle.preview", { tokenId, handleType, pos, value });
}

/** Broadcast group selection preview to peers. */
export function emitGroupSelectPreview(groupId: string | null): void {
  ephemeralBus.emit("group.select.preview", { groupId });
}

/** Broadcast group drag preview to peers. */
export function emitGroupDragPreview(groupId: string, delta: { x: number; y: number }): void {
  ephemeralBus.emit("group.drag.preview", { groupId, delta });
}

/** Broadcast a map focus command to all connected players (DM only). */
export function emitMapFocus(pos: { x: number; y: number }, zoom?: number): void {
  ephemeralBus.emit("map.focus", { pos, zoom });
}

/** Broadcast DM map selection to all connected players. */
export function emitMapSelectMap(mapId: string): void {
  ephemeralBus.emit("map.dm.selectMap", { mapId });
}

/** Broadcast full map tree state from DM to all clients. */
export function emitMapTreeSync(): void {
  const maps = useMapStore.getState().maps;
  const structures = useMapStore.getState().structures;
  const selectedMapId = useMapStore.getState().selectedMapId;
  const focus = useMapFocusStore.getState();

  const payload: MapTreeSyncPayload = {
    mapActivations: maps.map(m => ({ mapId: m.id, active: m.active })),
    selectedMapId,
    structures: structures.map(s => ({ id: s.id, name: s.name, exclusiveFocus: s.exclusiveFocus })),
    focusSettings: {
      unfocusedOpacity: focus.unfocusedOpacity,
      unfocusedBlur: focus.unfocusedBlur,
      selectionLockEnabled: focus.selectionLockEnabled,
    },
  };

  ephemeralBus.emit("map.tree.sync", payload);
}

/** Broadcast portal activation flash to all peers. */
export function emitPortalActivate(objectId: string): void {
  ephemeralBus.emit("portal.activate", { objectId });
}

/** Player requests DM approval for a portal teleport. */
export function emitPortalTeleportRequest(payload: PortalTeleportRequestPayload): void {
  ephemeralBus.emit("portal.teleport.request", payload);
}

/** DM approves a portal teleport request — broadcast to all clients. */
export function emitPortalTeleportApproved(payload: PortalTeleportApprovedPayload): void {
  ephemeralBus.emit("portal.teleport.approved", payload);
}

/** DM denies a portal teleport request. */
export function emitPortalTeleportDenied(payload: PortalTeleportDeniedPayload): void {
  ephemeralBus.emit("portal.teleport.denied", payload);
}

/** Broadcast a region drag update to peers. */
export function emitRegionDragUpdate(regionId: string, pos: { x: number; y: number }): void {
  ephemeralBus.emit("region.drag.update", { regionId, pos });
}
