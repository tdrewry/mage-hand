/**
 * Campaign Graph Runner — traverses campaign nodes using an execution handler.
 */

import type { BaseCampaign, BaseFlowNode, BaseNodeData } from '../types/base';
import type { BaseNodeType, NodeResult } from '../types/execution';

export interface GraphProgressSnapshot {
  currentNodeId: string | null;
  completedNodeIds: string[];
  failedNodeIds: string[];
  flags: Record<string, boolean>;
}

export interface GraphProgress {
  campaignId: string;
  currentNodeId: string | null;
  completedNodeIds: string[];
  failedNodeIds: string[];
  flags: Record<string, boolean>;
  startedAt: string;
  lastPlayedAt: string;
  isComplete: boolean;
  isFailed: boolean;
  /** Stack of previous states for back navigation */
  history: GraphProgressSnapshot[];
}

export interface GraphRunnerOptions<
  TNode extends BaseFlowNode = BaseFlowNode,
  TCampaign extends BaseCampaign<TNode> = BaseCampaign<TNode>,
> {
  campaign: TCampaign;
  onProgressUpdate?: (progress: GraphProgress) => void;
  onCampaignComplete?: (progress: GraphProgress) => void;
  onCampaignFailed?: (progress: GraphProgress) => void;
  onChoiceRequired?: (nodeId: string, options: { targetNodeId: string; label?: string }[]) => Promise<string>;
}

export interface GraphRunner {
  getProgress(): GraphProgress;
  initialize(existingProgress?: Partial<GraphProgress>): GraphProgress;
  resolveNode(nodeId: string, result: NodeResult): GraphProgress;
  getCurrentNode(): BaseFlowNode | null;
  getAvailableNodes(): BaseFlowNode[];
  setCurrentNode(nodeId: string): GraphProgress;
  isComplete(): boolean;
  canGoBack(): boolean;
  goBack(): GraphProgress;
  reset(): GraphProgress;
}

export function createGraphRunner<
  TNode extends BaseFlowNode = BaseFlowNode,
  TCampaign extends BaseCampaign<TNode> = BaseCampaign<TNode>,
>(options: GraphRunnerOptions<TNode, TCampaign>): GraphRunner {
  const { campaign, onProgressUpdate, onCampaignComplete, onCampaignFailed } = options;
  const nodeMap = new Map<string, TNode>(campaign.nodes.map(n => [n.id, n]));
  let progress: GraphProgress = createEmptyGraphProgress(campaign.id, campaign.startNodeId);

  function notifyProgress() { onProgressUpdate?.(progress); }

  function getAvailableNodesInternal(): TNode[] {
    if (progress.isComplete || progress.isFailed) return [];
    return campaign.nodes.filter(node => {
      if (progress.completedNodeIds.includes(node.id)) return false;
      return node.prerequisites.every(prereqId => progress.completedNodeIds.includes(prereqId));
    });
  }

  function resolveNextNode(currentNode: TNode, result: NodeResult): string | null {
    if (result.outcome === 'failure') {
      const failurePath = currentNode.nextOnFailure;
      if (failurePath === 'retry') return currentNode.id;
      if (failurePath === 'end') return null;
      return failurePath;
    }
    if (result.outcome === 'choice' && result.choiceId) {
      // Check unified outcomes field first, then deprecated dialogContent
      const outcomes = currentNode.outcomes || currentNode.dialogContent?.outcomes;
      if (outcomes) {
        // Match by outcome id first, then by targetNodeId matching the choiceId
        const outcome = outcomes.find((o: any) => o.id === result.choiceId)
          || outcomes.find((o: any) => o.targetNodeId === result.choiceId);
        if (outcome?.targetNodeId) return outcome.targetNodeId;
      }
      // Direct node ID match in successPaths (choiceId IS the target node)
      if (currentNode.nextOnSuccess.includes(result.choiceId)) {
        return result.choiceId;
      }
    }
    const successPaths = currentNode.nextOnSuccess;
    if (successPaths.length === 0) return null;
    if (successPaths.length === 1) return successPaths[0];
    if (currentNode.isChoicePoint && result.choiceId) {
      const matching = successPaths.find(id => id === result.choiceId);
      if (matching) return matching;
    }
    return successPaths[0];
  }

  return {
    getProgress() { return { ...progress }; },

    initialize(existingProgress?: Partial<GraphProgress>): GraphProgress {
      if (existingProgress) {
        progress = { ...createEmptyGraphProgress(campaign.id, campaign.startNodeId), ...existingProgress };
      } else {
        progress = createEmptyGraphProgress(campaign.id, campaign.startNodeId);
      }
      notifyProgress();
      return { ...progress };
    },

    resolveNode(nodeId: string, result: NodeResult): GraphProgress {
      const node = nodeMap.get(nodeId);
      if (!node) { console.warn(`[GraphRunner] Node not found: ${nodeId}`); return { ...progress }; }

      // Save snapshot before mutation for back navigation
      const snapshot: GraphProgressSnapshot = {
        currentNodeId: progress.currentNodeId,
        completedNodeIds: [...progress.completedNodeIds],
        failedNodeIds: [...progress.failedNodeIds],
        flags: { ...progress.flags },
      };
      progress.history = [...progress.history, snapshot];

      if (result.flagsSet) { progress.flags = { ...progress.flags, ...result.flagsSet }; }

      if (result.outcome === 'success' || result.outcome === 'choice') {
        progress.completedNodeIds = [...progress.completedNodeIds, nodeId];
      } else if (result.outcome === 'failure') {
        const failurePath = node.nextOnFailure;
        if (failurePath === 'retry') { /* don't mark */ }
        else if (failurePath === 'end') {
          progress.failedNodeIds = [...progress.failedNodeIds, nodeId];
          progress.isFailed = true;
          progress.currentNodeId = null;
          progress.lastPlayedAt = new Date().toISOString();
          notifyProgress();
          onCampaignFailed?.(progress);
          return { ...progress };
        } else {
          progress.failedNodeIds = [...progress.failedNodeIds, nodeId];
        }
      }

      const nextNodeId = resolveNextNode(node, result);
      if (nextNodeId === null && (node.isEndNode || node.nextOnSuccess.length === 0)) {
        progress.isComplete = true;
        progress.currentNodeId = null;
        progress.lastPlayedAt = new Date().toISOString();
        notifyProgress();
        onCampaignComplete?.(progress);
        return { ...progress };
      }

      progress.currentNodeId = nextNodeId;
      progress.lastPlayedAt = new Date().toISOString();
      notifyProgress();
      return { ...progress };
    },

    getCurrentNode() {
      if (!progress.currentNodeId) return null;
      return nodeMap.get(progress.currentNodeId) ?? null;
    },

    getAvailableNodes() { return getAvailableNodesInternal(); },

    setCurrentNode(nodeId: string): GraphProgress {
      const node = nodeMap.get(nodeId);
      if (!node) { console.warn(`[GraphRunner] Node not found: ${nodeId}`); return { ...progress }; }
      progress.currentNodeId = nodeId;
      progress.lastPlayedAt = new Date().toISOString();
      notifyProgress();
      return { ...progress };
    },

    isComplete() { return progress.isComplete; },

    reset(): GraphProgress {
      progress = createEmptyGraphProgress(campaign.id, campaign.startNodeId);
      notifyProgress();
      return { ...progress };
    },
  };
}

export function createEmptyGraphProgress(campaignId: string, startNodeId: string): GraphProgress {
  const now = new Date().toISOString();
  return {
    campaignId,
    currentNodeId: startNodeId,
    completedNodeIds: [],
    failedNodeIds: [],
    flags: {},
    startedAt: now,
    lastPlayedAt: now,
    isComplete: false,
    isFailed: false,
  };
}
