import { RuleNode } from './types';
import jsonLogic from 'json-logic-js';
import { resolveVocabulary } from '@/stores/globalConfigStore';

// Register extended mathematical operations used by Function Nodes
jsonLogic.add_operation("floor", Math.floor);
jsonLogic.add_operation("ceil", Math.ceil);
jsonLogic.add_operation("round", Math.round);
jsonLogic.add_operation("abs", Math.abs);

export interface RollResult {
  formula: string;
  rolls: number[];
  modifier: number;
  total: number;
}

// Operator 1: roll
jsonLogic.add_operation("roll", (formula: any) => {
  const strExpr = String(formula).trim();
  const match = strExpr.toLowerCase().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/);
  if (!match) return { formula: strExpr, rolls: [], modifier: 0, total: 0 };
  
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const sign = match[3] === '-' ? -1 : (match[3] === '+' ? 1 : 0);
  const mod = match[4] ? parseInt(match[4], 10) * sign : 0;
  
  const rolls: number[] = [];
  let total = mod;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    total += r;
  }
  
  return {
    formula: strExpr,
    rolls,
    modifier: mod,
    total
  };
});

// Operator 2: has_trait
jsonLogic.add_operation("has_trait", (array: any, trait: string) => {
  if (!Array.isArray(array)) return false;
  return array.includes(trait);
});

// Operator 3: vocab_match
jsonLogic.add_operation("vocab_match", (category: string, varToCheck: string, expectedVal: string) => {
  if (!category || typeof varToCheck !== 'string' || typeof expectedVal !== 'string') return false;
  
  const resolvedVar = resolveVocabulary(category, varToCheck);
  const resolvedExpected = resolveVocabulary(category, expectedVal);
  
  if (!resolvedVar || !resolvedExpected) return false;
  return resolvedVar === resolvedExpected;
});

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
 * When evaluating multiple targets, `sharedNodeResults` can cache execution of nodes
 * that do not belong to a specific target, ensuring exactly-once evaluation for dice rolls.
 */
export function executePipeline(compiledNodes: RuleNode[], initialState: any, sharedNodeResults?: Record<string, any>): any {
  // Deep clone to prevent mutating the original passed-in mock state directly
  const state = JSON.parse(JSON.stringify(initialState || {}));

  for (const node of compiledNodes) {
    const logic = node.nodeData.jsonLogic;
    if (!logic || Object.keys(logic).length === 0) continue;

    try {
      let result;
      // If evaluating multiple targets (AoE), deterministic nodes (no `target.` dependency) should only roll once
      const vars = extractVariables(logic);
      const isTargetIndependent = !vars.some(v => v.startsWith('target.'));
      
      if (sharedNodeResults && isTargetIndependent && sharedNodeResults.hasOwnProperty(node.id)) {
        result = sharedNodeResults[node.id];
      } else {
        // Evaluate current node
        result = jsonLogic.apply(logic, state);
        
        if (sharedNodeResults && isTargetIndependent) {
          sharedNodeResults[node.id] = result;
        }
      }

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
