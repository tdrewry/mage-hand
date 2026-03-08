// src/stores/mapEphemeralStore.ts
// Ephemeral overlay store for remote map/region/mapObject interactions.

import { create } from "zustand";

export interface RemoteDmViewport {
  userId: string;
  x: number;
  y: number;
  zoom: number;
}

export interface RemoteMapPing {
  userId: string;
  pos: { x: number; y: number };
  color?: string;
  label?: string;
  ts: number;
}

export interface RemoteMapFocus {
  pos: { x: number; y: number };
  zoom?: number;
}

export interface RemoteEntityDrag {
  entityId: string;
  userId: string;
  pos: { x: number; y: number };
}

export interface RemoteHandlePreview {
  userId: string;
  entityId: string;
  entityType: "region" | "mapObject";
  handleType: "rotate" | "scale";
  pos: { x: number; y: number };
  value?: number;
}

const removeKey = <T extends Record<string, any>>(obj: T, key: string): T => {
  const { [key]: _, ...rest } = obj;
  return rest as T;
};

interface MapEphemeralState {
  /** Latest DM viewport broadcast */
  dmViewport: RemoteDmViewport | null;
  /** Active map pings keyed by `${userId}` */
  pings: Record<string, RemoteMapPing>;
  /** Latest map focus command from DM */
  focus: RemoteMapFocus | null;
  /** Remote region drag previews keyed by regionId */
  regionDrags: Record<string, RemoteEntityDrag>;
  /** Remote map object drag previews keyed by objectId */
  mapObjectDrags: Record<string, RemoteEntityDrag>;
  /** Remote region/mapObject handle previews keyed by entityId */
  handlePreviews: Record<string, RemoteHandlePreview>;

  setDmViewport: (vp: RemoteDmViewport | null) => void;
  addPing: (userId: string, ping: RemoteMapPing) => void;
  removePing: (userId: string) => void;
  setFocus: (f: RemoteMapFocus | null) => void;
  setRegionDrag: (entityId: string, drag: RemoteEntityDrag) => void;
  removeRegionDrag: (entityId: string) => void;
  setMapObjectDrag: (entityId: string, drag: RemoteEntityDrag) => void;
  removeMapObjectDrag: (entityId: string) => void;
  setHandlePreview: (entityId: string, preview: RemoteHandlePreview) => void;
  removeHandlePreview: (entityId: string) => void;

  /** Follow DM viewport toggle (player-side) */
  followDM: boolean;
  setFollowDM: (v: boolean) => void;

  /** DM-side: whether enforce-follow is active (broadcast to players) */
  enforceFollowDM: boolean;
  setEnforceFollowDM: (v: boolean) => void;
}

export const useMapEphemeralStore = create<MapEphemeralState>((set) => ({
  dmViewport: null,
  pings: {},
  focus: null,
  regionDrags: {},
  mapObjectDrags: {},
  handlePreviews: {},
  followDM: false,
  setFollowDM: (v) => set({ followDM: v }),
  enforceFollowDM: false,
  setEnforceFollowDM: (v) => set({ enforceFollowDM: v }),

  setDmViewport: (vp) => set({ dmViewport: vp }),
  addPing: (userId, ping) =>
    set((s) => ({ pings: { ...s.pings, [userId]: ping } })),
  removePing: (userId) =>
    set((s) => ({ pings: removeKey(s.pings, userId) })),
  setFocus: (f) => set({ focus: f }),
  setRegionDrag: (entityId, drag) =>
    set((s) => ({ regionDrags: { ...s.regionDrags, [entityId]: drag } })),
  removeRegionDrag: (entityId) =>
    set((s) => ({ regionDrags: removeKey(s.regionDrags, entityId) })),
  setMapObjectDrag: (entityId, drag) =>
    set((s) => ({ mapObjectDrags: { ...s.mapObjectDrags, [entityId]: drag } })),
  removeMapObjectDrag: (entityId) =>
    set((s) => ({ mapObjectDrags: removeKey(s.mapObjectDrags, entityId) })),
  setHandlePreview: (entityId, preview) =>
    set((s) => ({ handlePreviews: { ...s.handlePreviews, [entityId]: preview } })),
  removeHandlePreview: (entityId) =>
    set((s) => ({ handlePreviews: removeKey(s.handlePreviews, entityId) })),
}));
