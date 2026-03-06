// src/stores/actionPendingStore.ts
// Player-facing store for pending and resolved action notifications.
// Players see these as toasts/overlays; they never see the full resolution UI.

import { create } from "zustand";

export interface PendingAction {
  actionId: string;
  sourceName: string;
  attackName: string;
  targetNames: string[];
  category: string;
  receivedAt: number;
}

export interface ResolvedAction {
  actionId: string;
  sourceName: string;
  attackName: string;
  category: string;
  targets: Array<{
    tokenName: string;
    resolution: string;
    totalDamage: number;
    damageType: string;
  }>;
  receivedAt: number;
}

export interface ResolutionClaim {
  actionId: string;
  claimedBy: string;
  claimedByName: string;
  receivedAt: number;
}

interface ActionPendingState {
  /** Actions currently being resolved by a DM (visible to players as pending). */
  pendingActions: Record<string, PendingAction>;
  /** Recently resolved action outcomes (player-readable summaries). */
  resolvedActions: ResolvedAction[];
  /** Active DM claims on actions (for multi-DM coordination). */
  claims: Record<string, ResolutionClaim>;

  setPending: (action: PendingAction) => void;
  clearPending: (actionId: string) => void;
  addResolved: (action: ResolvedAction) => void;
  clearOldResolved: (maxAge?: number) => void;
  setClaim: (actionId: string, claim: ResolutionClaim | null) => void;
}

const MAX_RESOLVED_HISTORY = 50;

export const useActionPendingStore = create<ActionPendingState>((set) => ({
  pendingActions: {},
  resolvedActions: [],
  claims: {},

  setPending: (action) =>
    set((s) => ({
      pendingActions: { ...s.pendingActions, [action.actionId]: action },
    })),

  clearPending: (actionId) =>
    set((s) => {
      const { [actionId]: _, ...rest } = s.pendingActions;
      return { pendingActions: rest };
    }),

  addResolved: (action) =>
    set((s) => ({
      resolvedActions: [action, ...s.resolvedActions].slice(0, MAX_RESOLVED_HISTORY),
      // Also clear from pending
      pendingActions: (() => {
        const { [action.actionId]: _, ...rest } = s.pendingActions;
        return rest;
      })(),
    })),

  clearOldResolved: (maxAge = 60_000) =>
    set((s) => ({
      resolvedActions: s.resolvedActions.filter(
        (a) => Date.now() - a.receivedAt < maxAge
      ),
    })),

  setClaim: (actionId, claim) =>
    set((s) => {
      if (!claim) {
        const { [actionId]: _, ...rest } = s.claims;
        return { claims: rest };
      }
      return { claims: { ...s.claims, [actionId]: claim } };
    }),
}));
