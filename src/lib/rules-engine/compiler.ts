import { RuleNode } from './types';
import jsonLogic from 'json-logic-js';

// Register extended mathematical operations used by Function Nodes
jsonLogic.add_operation("floor", Math.floor);
jsonLogic.add_operation("ceil", Math.ceil);
jsonLogic.add_operation("round", Math.round);
jsonLogic.add_operation("abs", Math.abs);

/**
 * Safely sets a deeply nested property on an object (like lodash/set).
 */
export function setNestedProperty(obj: any, path: string, value: any): void {
  if (!obj || !path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Recursively extracts dot-notation variables evaluated by a jsonLogic AST node.
 */
export function extractVariables(logic: any): string[] {
  const vars = new Set<string>();

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const keys = Object.keys(node);
    for (const key of keys) {
      if (key === 'var') {
        const val = node[key];
        if (typeof val === 'string' && val.trim() !== '') {
          vars.add(val);
        } else if (Array.isArray(val) && typeof val[0] === 'string' && val[0].trim() !== '') {
          vars.add(val[0]);
        }
      } else {
        walk(node[key]);
      }
    }
  }

  walk(logic);
  return Array.from(vars);
}

/**
 * Builds a JSON skeleton object dynamically across a list of dot-notation strings.
 */
export function buildSkeletonFromVariables(vars: string[]): any {
  const skeleton: any = {};
  for (const v of vars) {
    setNestedProperty(skeleton, v, null);
  }
  return skeleton;
}

/**
 * Performs a topological sort to flatten a RuleGraph pipeline into an array 
 * representing sequential execution order. Handles branching sequentially.
 */
export function compilePipeline(nodes: RuleNode[], startNodeId?: string): RuleNode[] {
  if (!nodes || nodes.length === 0) return [];

  const executionOrder: RuleNode[] = [];
  const visited = new Set<string>();
  
  // Build a lookup map
  const nodeMap = new Map<string, RuleNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const queue: string[] = [];
  if (startNodeId && nodeMap.has(startNodeId)) {
    queue.push(startNodeId);
  } else {
    // If no start node designated, pick the first connected roots, or simply the first node
    queue.push(nodes[0].id);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue; // avoid cycles
    
    visited.add(currentId);
    const node = nodeMap.get(currentId);
    if (!node) continue;

    executionOrder.push(node);

    // Enqueue successors (failure branch might be 'retry' or 'end', only enqueue valid nodes)
    for (const nextId of node.nextOnSuccess) {
      if (!visited.has(nextId) && nodeMap.has(nextId)) {
        queue.push(nextId);
      }
    }
    
    const nextFail = node.nextOnFailure;
    if (typeof nextFail === 'string' && nextFail !== 'retry' && nextFail !== 'end') {
      if (!visited.has(nextFail) && nodeMap.has(nextFail)) {
        queue.push(nextFail);
      }
    }
  }

  // Fallback: If disconnected nodes remain, they won't be executed unless manually placed
  return executionOrder;
}

/**
 * Executes a pre-compiled array of RuleNodes sequentially against a state object.
 */
export function executePipeline(compiledNodes: RuleNode[], initialState: any): any {
  // Deep clone to prevent mutating the original passed-in mock state directly
  const state = JSON.parse(JSON.stringify(initialState || {}));

  for (const node of compiledNodes) {
    const logic = node.nodeData.jsonLogic;
    if (!logic || Object.keys(logic).length === 0) continue;

    try {
      // Evaluate current node
      const result = jsonLogic.apply(logic, state);

      // If there is an output target, assign the returned value back into state
      if (node.nodeData.outputTarget) {
        setNestedProperty(state, node.nodeData.outputTarget, result);
      }
    } catch (e) {
      console.warn(`Execution failed at node ${node.id} (${node.nodeData.name})`, e);
      // Determine if we should halt or continue based on pipeline rules, simplified for now
    }
  }

  return state;
}
