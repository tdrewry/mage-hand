// src/stores/tokenEphemeralStore.ts
// Ephemeral overlay store for remote token interactions:
// token.hover, token.handle.preview, selection.preview, action.target.preview

import { create } from "zustand";

export interface RemoteTokenHover {
  userId: string;
  tokenId: string | null;
}

export interface RemoteHandlePreview {
  userId: string;
  tokenId: string;
  handleType: "rotate" | "scale";
  pos: { x: number; y: number };
  value?: number;
}

export interface RemoteSelectionPreview {
  userId: string;
  rect?: { x: number; y: number; width: number; height: number };
  polyline?: { x: number; y: number }[];
}

export interface RemoteActionTarget {
  userId: string;
  sourceTokenId: string;
  pos: { x: number; y: number };
}

interface TokenEphemeralState {
  /** Remote token hovers keyed by userId */
  hovers: Record<string, RemoteTokenHover>;
  /** Remote handle previews keyed by userId */
  handlePreviews: Record<string, RemoteHandlePreview>;
  /** Remote selection previews keyed by userId */
  selectionPreviews: Record<string, RemoteSelectionPreview>;
  /** Remote action target previews keyed by userId */
  actionTargets: Record<string, RemoteActionTarget>;

  setHover: (userId: string, tokenId: string | null) => void;
  removeHover: (userId: string) => void;
  setHandlePreview: (userId: string, preview: RemoteHandlePreview) => void;
  removeHandlePreview: (userId: string) => void;
  setSelectionPreview: (userId: string, preview: RemoteSelectionPreview) => void;
  removeSelectionPreview: (userId: string) => void;
  setActionTarget: (userId: string, target: RemoteActionTarget) => void;
  removeActionTarget: (userId: string) => void;
}

export const useTokenEphemeralStore = create<TokenEphemeralState>((set) => ({
  hovers: {},
  handlePreviews: {},
  selectionPreviews: {},
  actionTargets: {},

  setHover: (userId, tokenId) =>
    set((s) => {
      // Skip update if value hasn't changed — prevents unnecessary canvas redraws
      const existing = s.hovers[userId];
      if (existing && existing.tokenId === tokenId) return s;
      return { hovers: { ...s.hovers, [userId]: { userId, tokenId } } };
    }),
  removeHover: (userId) =>
    set((s) => {
      const { [userId]: _, ...rest } = s.hovers;
      return { hovers: rest };
    }),

  setHandlePreview: (userId, preview) =>
    set((s) => ({
      handlePreviews: { ...s.handlePreviews, [userId]: preview },
    })),
  removeHandlePreview: (userId) =>
    set((s) => {
      const { [userId]: _, ...rest } = s.handlePreviews;
      return { handlePreviews: rest };
    }),

  setSelectionPreview: (userId, preview) =>
    set((s) => ({
      selectionPreviews: { ...s.selectionPreviews, [userId]: preview },
    })),
  removeSelectionPreview: (userId) =>
    set((s) => {
      const { [userId]: _, ...rest } = s.selectionPreviews;
      return { selectionPreviews: rest };
    }),

  setActionTarget: (userId, target) =>
    set((s) => ({
      actionTargets: { ...s.actionTargets, [userId]: target },
    })),
  removeActionTarget: (userId) =>
    set((s) => {
      const { [userId]: _, ...rest } = s.actionTargets;
      return { actionTargets: rest };
    }),
}));
