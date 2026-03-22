import { BaseFlowNode, BaseNodeData } from '../campaign-editor/types/base';

export interface RuleNodeData extends BaseNodeData {
  jsonLogic: Record<string, any>;
  outputTarget?: string;
}

export interface RuleNode extends BaseFlowNode<RuleNodeData> {
  nodeType: 'rule' | 'function_node';
}
