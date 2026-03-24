import { BaseFlowNode, BaseNodeData } from '../campaign-editor/types/base';

export interface RuleNodeData extends BaseNodeData {
  jsonLogic: Record<string, any>;
  outputTarget?: string;
}

export interface RuleNode extends BaseFlowNode<RuleNodeData> {
  nodeType: 'rule' | 'function_node';
}

export interface TargetResult {
  challengeResult?: {
    type: 'attack' | 'save' | 'skill' | 'none';
    rolls: number[];
    modifier: number;
    total: number;
    targetValue: number;
    isSuccess: boolean;
    isCriticalHit?: boolean;
    isCriticalMiss?: boolean;
    targetProp?: string;
  };
  resistances?: Array<{ type: string; multiplier: number; reason: string }>;
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
  placedMapTemplateId?: string;
  activeEffectId?: string;
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

export interface RollRequestPayload {
  challengeType: 'attack' | 'save' | 'skill' | 'initiative' | 'none';
  targets: string[];
  dc?: number;
  versus?: string;
  sourceId?: string;
}

export interface RollResultPayload {
  results: Record<string, { total: number; natural?: number; modifier?: number }>;
}
