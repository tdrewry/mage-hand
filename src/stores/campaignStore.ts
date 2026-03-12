/**
 * Campaign Store — manages campaign CRUD, active campaign, and graph progress.
 * Persisted via zustand/persist for refresh survival.
 * Also included in DurableObjectRegistry (kind: 'campaigns') for .mhdo/.mhsession.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BaseCampaign, BaseFlowNode, BaseNodeData, FlowNodePosition } from '@/lib/campaign-editor/types/base';
import type { GraphProgress } from '@/lib/campaign-editor/lib/graphRunner';
import { createEmptyGraphProgress } from '@/lib/campaign-editor/lib/graphRunner';

export interface CampaignState {
  campaigns: BaseCampaign[];
  activeCampaignId: string | null;
  activeProgress: GraphProgress | null;

  /** Node positions for the flow canvas, keyed by campaignId → nodeId → position */
  nodePositions: Record<string, Record<string, FlowNodePosition>>;

  /** When set, the Campaign Editor card should open to this campaign's editor view */
  requestedEditorCampaignId: string | null;

  // CRUD
  addCampaign: (campaign: BaseCampaign) => void;
  updateCampaign: (id: string, patch: Partial<BaseCampaign>) => void;
  removeCampaign: (id: string) => void;

  // Activation
  setActiveCampaign: (id: string | null) => void;

  // Node management
  addNode: (campaignId: string, node: BaseFlowNode) => void;
  updateNode: (campaignId: string, nodeId: string, patch: Partial<BaseFlowNode>) => void;
  removeNode: (campaignId: string, nodeId: string) => void;
  setNodePosition: (campaignId: string, nodeId: string, pos: FlowNodePosition) => void;

  // Connections
  addConnection: (campaignId: string, sourceId: string, targetId: string, type: 'success' | 'failure') => void;
  removeConnection: (campaignId: string, sourceId: string, targetId: string, type: 'success' | 'failure') => void;

  // Progress
  setProgress: (progress: GraphProgress | null) => void;
  advanceNode: (nodeId: string) => void;
  resolveNode: (nodeId: string, outcome: 'success' | 'failure') => void;
  resetProgress: () => void;

  // Editor navigation
  requestOpenEditor: (campaignId: string) => void;
  clearEditorRequest: () => void;
}

// Helper to access campaign node count
function findCampaign(s: CampaignState, campaignId: string) {
  return s.campaigns.find((c) => c.id === campaignId);
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set, get) => ({
      campaigns: [],
      activeCampaignId: null,
      activeProgress: null,
      nodePositions: {},
      requestedEditorCampaignId: null,

      addCampaign: (campaign) =>
        set((s) => ({ campaigns: [...s.campaigns, campaign] })),

      updateCampaign: (id, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
          ),
        })),

      removeCampaign: (id) =>
        set((s) => ({
          campaigns: s.campaigns.filter((c) => c.id !== id),
          activeCampaignId: s.activeCampaignId === id ? null : s.activeCampaignId,
          activeProgress: s.activeCampaignId === id ? null : s.activeProgress,
        })),

      setActiveCampaign: (id) => {
        const campaign = id ? get().campaigns.find((c) => c.id === id) : null;
        set({
          activeCampaignId: id,
          activeProgress: campaign
            ? createEmptyGraphProgress(campaign.id, campaign.startNodeId)
            : null,
        });
      },

      addNode: (campaignId, node) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, nodes: [...c.nodes, node], updatedAt: new Date().toISOString() }
              : c
          ),
          nodePositions: {
            ...s.nodePositions,
            [campaignId]: {
              ...s.nodePositions[campaignId],
              [node.id]: { x: 50 + (findCampaign(s, campaignId)?.nodes.length ?? 0) * 220, y: 100 },
            },
          },
        })),

      updateNode: (campaignId, nodeId, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  nodes: c.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      removeNode: (campaignId, nodeId) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  nodes: c.nodes.filter((n) => n.id !== nodeId).map((n) => ({
                    ...n,
                    nextOnSuccess: n.nextOnSuccess.filter((id) => id !== nodeId),
                    nextOnFailure: n.nextOnFailure === nodeId ? 'end' as const : n.nextOnFailure,
                    prerequisites: n.prerequisites.filter((id) => id !== nodeId),
                  })),
                  startNodeId: c.startNodeId === nodeId ? (c.nodes.find((n) => n.id !== nodeId)?.id || '') : c.startNodeId,
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      setNodePosition: (campaignId, nodeId, pos) =>
        set((s) => ({
          nodePositions: {
            ...s.nodePositions,
            [campaignId]: { ...s.nodePositions[campaignId], [nodeId]: pos },
          },
        })),

      addConnection: (campaignId, sourceId, targetId, type) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  nodes: c.nodes.map((n) => {
                    if (n.id !== sourceId) return n;
                    if (type === 'success') {
                      return { ...n, nextOnSuccess: [...new Set([...n.nextOnSuccess, targetId])] };
                    }
                    return { ...n, nextOnFailure: targetId };
                  }),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      removeConnection: (campaignId, sourceId, targetId, type) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  nodes: c.nodes.map((n) => {
                    if (n.id !== sourceId) return n;
                    if (type === 'success') {
                      return { ...n, nextOnSuccess: n.nextOnSuccess.filter((id) => id !== targetId) };
                    }
                    return { ...n, nextOnFailure: 'end' as const };
                  }),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      setProgress: (progress) => set({ activeProgress: progress }),

      advanceNode: (nodeId) =>
        set((s) => {
          if (!s.activeProgress) return s;
          return {
            activeProgress: {
              ...s.activeProgress,
              currentNodeId: nodeId,
              lastPlayedAt: new Date().toISOString(),
            },
          };
        }),

      resolveNode: (nodeId, outcome) =>
        set((s) => {
          if (!s.activeProgress) return s;
          const prog = s.activeProgress;
          const list = outcome === 'success' ? 'completedNodeIds' : 'failedNodeIds';
          return {
            activeProgress: {
              ...prog,
              [list]: [...prog[list], nodeId],
              lastPlayedAt: new Date().toISOString(),
            },
          };
        }),

      resetProgress: () =>
        set((s) => {
          if (!s.activeCampaignId) return s;
          const campaign = s.campaigns.find((c) => c.id === s.activeCampaignId);
          if (!campaign) return s;
          return { activeProgress: createEmptyGraphProgress(campaign.id, campaign.startNodeId) };
        }),

      requestOpenEditor: (campaignId: string) => set({ requestedEditorCampaignId: campaignId }),
      clearEditorRequest: () => set({ requestedEditorCampaignId: null }),
    }),
    {
      name: 'campaign-store',
      version: 1,
    }
  )
);
