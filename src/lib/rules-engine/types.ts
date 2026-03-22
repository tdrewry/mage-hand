import { BaseFlowNode, BaseNodeData } from '../campaign-editor/types/base';

export interface RuleNodeData extends BaseNodeData {
  jsonLogic: Record<string, any>;
  outputTarget?: string;
}

export interface RuleNode extends BaseFlowNode<RuleNodeData> {
  nodeType: 'rule' | 'function_node';
}

export interface ResolutionPayload {
  source: { name: string; type: string };
  attacker: { id: string; name: string };
  defender: { id: string; name: string };
  attackRoll?: { formula: string; total: number; versusAC: number };
  damage: Array<{ type: string; amount: number; formula: string }>;
  suggestedResolution: string;
  outcomes: Record<string, any>;
}
