import { BaseFlowNode, BaseNodeData } from '../campaign-editor/types/base';

export interface RuleNodeData extends BaseNodeData {
  jsonLogic: Record<string, any>;
  outputTarget?: string;
}

export interface RuleNode extends BaseFlowNode<RuleNodeData> {
  nodeType: 'rule' | 'function_node';
}

export interface TargetResult {
  challengeResult?: { rolls: number[]; modifier: number; total: number; isSuccess: boolean };
  damage: Record<string, { amount: number | { formula?: string; rolls?: number[]; total: number; modifier?: number } }>;
  effectsApplied: Record<string, { duration: number; unit: string; trigger?: string; pipelineId?: string }>;
  suggestedResolution: string;
}

export interface IntentPayload {
  actorId: string;
  actionId: string;
  actionType: 'attack' | 'spell' | 'skill' | 'trait';
  targets: string[];
  modifiers: Record<string, any>;
}

export interface ResolutionPayload {
  source: { name: string; type: string };
  targets: Array<{ id: string; name: string }>;
  challenge?: { type: string; versus: string; target: number };
  rawResults: { 
    damage: Record<string, { amount: number; formula: string; rolls: number[] }>; 
    effects: Record<string, { duration: number; unit: string; trigger?: string; pipelineId?: string }>;
  };
  targetResults: Record<string, TargetResult>;
}
