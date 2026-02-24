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

  setDmViewport: (vp: RemoteDmViewport | null) => void;
  addPing: (userId: string, ping: RemoteMapPing) => void;
  removePing: (userId: string) => void;
  setFocus: (f: RemoteMapFocus | null) => void;
  setRegionDrag: (entityId: string, drag: RemoteEntityDrag) => void;
  removeRegionDrag: (entityId: string) => void;
  setMapObjectDrag: (entityId: string, drag: RemoteEntityDrag) => void;
  removeMapObjectDrag: (entityId: string) => void;

  /** Follow DM viewport toggle (player-side) */
  followDM: boolean;
  setFollowDM: (v: boolean) => void;
}

export const useMapEphemeralStore = create<MapEphemeralState>((set) => ({
  dmViewport: null,
  pings: {},
  focus: null,
  regionDrags: {},
  mapObjectDrags: {},
  followDM: false,
  setFollowDM: (v) => set({ followDM: v }),

  setDmViewport: (vp) => set({ dmViewport: vp }),
  addPing: (userId, ping) =>
    set((s) => ({ pings: { ...s.pings, [userId]: ping } })),
  removePing: (userId) =>
    set((s) => {
      const { [userId]: _, ...rest } = s.pings;
      return { pings: rest };
    }),
  setFocus: (f) => set({ focus: f }),
  setRegionDrag: (entityId, drag) =>
    set((s) => ({ regionDrags: { ...s.regionDrags, [entityId]: drag } })),
  removeRegionDrag: (entityId) =>
    set((s) => {
      const { [entityId]: _, ...rest } = s.regionDrags;
      return { regionDrags: rest };
    }),
  setMapObjectDrag: (entityId, drag) =>
    set((s) => ({ mapObjectDrags: { ...s.mapObjectDrags, [entityId]: drag } })),
  removeMapObjectDrag: (entityId) =>
    set((s) => {
      const { [entityId]: _, ...rest } = s.mapObjectDrags;
      return { mapObjectDrags: rest };
    }),
}));
