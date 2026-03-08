// src/stores/miscEphemeralStore.ts
// Ephemeral overlay store for fog, dice, initiative, groups, roles, and assets.

import { create } from "zustand";

export interface RemoteFogCursor {
  userId: string;
  pos: { x: number; y: number };
  radius: number;
  tool: "reveal" | "hide";
}

export interface RemoteChatTyping {
  userId: string;
}

export interface RemoteDiceRolling {
  userId: string;
  formula?: string;
}

export interface RemoteInitiativeDrag {
  userId: string;
  entryIndex: number;
  targetIndex: number;
}

export interface RemoteInitiativeHover {
  userId: string;
  entryIndex: number | null;
}

export interface RemoteGroupSelect {
  userId: string;
  groupId: string | null;
}

export interface RemoteGroupDrag {
  userId: string;
  groupId: string;
  delta: { x: number; y: number };
}

export interface RemoteHandRaise {
  userId: string;
}

export interface RemoteUploadProgress {
  userId: string;
  assetId: string;
  percent: number;
}

export interface RemoteEffectPlacementPreview {
  templateId: string;
  origin: { x: number; y: number };
  direction?: number;
}

interface MiscEphemeralState {
  fogCursors: Record<string, RemoteFogCursor>;
  chatTyping: Record<string, RemoteChatTyping>;
  diceRolling: Record<string, RemoteDiceRolling>;
  initiativeDrags: Record<string, RemoteInitiativeDrag>;
  initiativeHovers: Record<string, RemoteInitiativeHover>;
  groupSelects: Record<string, RemoteGroupSelect>;
  groupDrags: Record<string, RemoteGroupDrag>;
  handRaises: Record<string, RemoteHandRaise>;
  uploadProgress: Record<string, RemoteUploadProgress>;
  effectPlacementPreviews: Record<string, RemoteEffectPlacementPreview>;

  // Setters
  setFogCursor: (userId: string, data: RemoteFogCursor) => void;
  removeFogCursor: (userId: string) => void;
  setChatTyping: (userId: string) => void;
  removeChatTyping: (userId: string) => void;
  setDiceRolling: (userId: string, formula?: string) => void;
  removeDiceRolling: (userId: string) => void;
  setInitiativeDrag: (userId: string, data: RemoteInitiativeDrag) => void;
  removeInitiativeDrag: (userId: string) => void;
  setInitiativeHover: (userId: string, entryIndex: number | null) => void;
  removeInitiativeHover: (userId: string) => void;
  setGroupSelect: (userId: string, groupId: string | null) => void;
  removeGroupSelect: (userId: string) => void;
  setGroupDrag: (userId: string, data: RemoteGroupDrag) => void;
  removeGroupDrag: (userId: string) => void;
  setHandRaise: (userId: string) => void;
  removeHandRaise: (userId: string) => void;
  setUploadProgress: (userId: string, data: RemoteUploadProgress) => void;
  removeUploadProgress: (userId: string) => void;
  setEffectPlacementPreview: (userId: string, data: RemoteEffectPlacementPreview) => void;
  removeEffectPlacementPreview: (userId: string) => void;
}

const removeKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _, ...rest } = record;
  return rest;
};

export const useMiscEphemeralStore = create<MiscEphemeralState>((set) => ({
  fogCursors: {},
  chatTyping: {},
  diceRolling: {},
  initiativeDrags: {},
  initiativeHovers: {},
  groupSelects: {},
  groupDrags: {},
  handRaises: {},
  uploadProgress: {},
  effectPlacementPreviews: {},

  setFogCursor: (userId, data) => set((s) => ({ fogCursors: { ...s.fogCursors, [userId]: data } })),
  removeFogCursor: (userId) => set((s) => ({ fogCursors: removeKey(s.fogCursors, userId) })),
  setChatTyping: (userId) => set((s) => ({ chatTyping: { ...s.chatTyping, [userId]: { userId } } })),
  removeChatTyping: (userId) => set((s) => ({ chatTyping: removeKey(s.chatTyping, userId) })),
  setDiceRolling: (userId, formula) => set((s) => ({ diceRolling: { ...s.diceRolling, [userId]: { userId, formula } } })),
  removeDiceRolling: (userId) => set((s) => ({ diceRolling: removeKey(s.diceRolling, userId) })),
  setInitiativeDrag: (userId, data) => set((s) => ({ initiativeDrags: { ...s.initiativeDrags, [userId]: data } } )),
  removeInitiativeDrag: (userId) => set((s) => ({ initiativeDrags: removeKey(s.initiativeDrags, userId) })),
  setInitiativeHover: (userId, entryIndex) => set((s) => ({ initiativeHovers: { ...s.initiativeHovers, [userId]: { userId, entryIndex } } })),
  removeInitiativeHover: (userId) => set((s) => ({ initiativeHovers: removeKey(s.initiativeHovers, userId) })),
  setGroupSelect: (userId, groupId) => set((s) => ({ groupSelects: { ...s.groupSelects, [userId]: { userId, groupId } } })),
  removeGroupSelect: (userId) => set((s) => ({ groupSelects: removeKey(s.groupSelects, userId) })),
  setGroupDrag: (userId, data) => set((s) => ({ groupDrags: { ...s.groupDrags, [userId]: data } })),
  removeGroupDrag: (userId) => set((s) => ({ groupDrags: removeKey(s.groupDrags, userId) })),
  setHandRaise: (userId) => set((s) => ({ handRaises: { ...s.handRaises, [userId]: { userId } } })),
  removeHandRaise: (userId) => set((s) => ({ handRaises: removeKey(s.handRaises, userId) })),
  setUploadProgress: (userId, data) => set((s) => ({ uploadProgress: { ...s.uploadProgress, [userId]: data } })),
  removeUploadProgress: (userId) => set((s) => ({ uploadProgress: removeKey(s.uploadProgress, userId) })),
}));
