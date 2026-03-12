/**
 * Generic campaign validation utilities.
 */

import {
  BaseCampaign,
  BaseFlowNode,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types/base';

export function validateCampaign<N extends BaseFlowNode, C extends BaseCampaign<N>>(
  campaign: C
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const nodeMap = new Map(campaign.nodes.map(n => [n.id, n]));

  if (!campaign.startNodeId) {
    errors.push({ type: 'missing-start', message: 'Campaign has no start node defined' });
  } else if (!nodeMap.has(campaign.startNodeId)) {
    errors.push({ type: 'missing-start', message: `Start node "${campaign.startNodeId}" does not exist` });
  }

  for (const node of campaign.nodes) {
    for (const successTarget of node.nextOnSuccess) {
      if (!nodeMap.has(successTarget)) {
        errors.push({ type: 'invalid-branch', nodeId: node.id, message: `Node "${node.id}" references non-existent success target "${successTarget}"` });
      }
    }
    if (typeof node.nextOnFailure === 'string' && node.nextOnFailure !== 'retry' && node.nextOnFailure !== 'end' && !nodeMap.has(node.nextOnFailure)) {
      errors.push({ type: 'invalid-branch', nodeId: node.id, message: `Node "${node.id}" references non-existent failure target "${node.nextOnFailure}"` });
    }
    for (const prereq of node.prerequisites) {
      if (!nodeMap.has(prereq)) {
        errors.push({ type: 'missing-node', nodeId: node.id, message: `Node "${node.id}" has prerequisite "${prereq}" that doesn't exist` });
      }
    }
  }

  const circularNodes = findCircularPrerequisites(campaign.nodes);
  for (const nodeId of circularNodes) {
    errors.push({ type: 'circular-required', nodeId, message: `Node "${nodeId}" is part of a circular prerequisite chain` });
  }

  const reachableNodes = findReachableNodes(campaign.nodes, campaign.startNodeId);
  for (const node of campaign.nodes) {
    if (!reachableNodes.has(node.id) && !node.isStartNode) {
      warnings.push({ type: 'unreachable-node', nodeId: node.id, message: `Node "${node.id}" is not reachable from the start node` });
    }
  }

  for (const node of campaign.nodes) {
    if (!node.isEndNode && node.nextOnSuccess.length === 0 && node.nextOnFailure !== 'retry') {
      warnings.push({ type: 'dead-end', nodeId: node.id, message: `Node "${node.id}" has no outgoing connections and is not marked as an end node` });
    }
  }

  if (!campaign.nodes.some(n => n.isEndNode)) {
    warnings.push({ type: 'dead-end', message: 'Campaign has no end nodes - players cannot complete it' });
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function findCircularPrerequisites<N extends BaseFlowNode>(nodes: N[]): Set<string> {
  const circular = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function hasCycle(nodeId: string, visited: Set<string>, path: Set<string>): boolean {
    if (path.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    path.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) {
      for (const prereq of node.prerequisites) {
        if (hasCycle(prereq, visited, path)) { circular.add(nodeId); return true; }
      }
    }
    path.delete(nodeId);
    return false;
  }

  for (const node of nodes) { hasCycle(node.id, new Set(), new Set()); }
  return circular;
}

function findReachableNodes<N extends BaseFlowNode>(nodes: N[], startId: string): Set<string> {
  const reachable = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function visit(nodeId: string) {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;
    for (const next of node.nextOnSuccess) visit(next);
    if (typeof node.nextOnFailure === 'string' && node.nextOnFailure !== 'retry' && node.nextOnFailure !== 'end') {
      visit(node.nextOnFailure);
    }
  }

  visit(startId);
  return reachable;
}
