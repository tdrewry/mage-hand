/**
 * Configuration-driven node type system for the Campaign Editor.
 */

export type CustomFieldType = 'string' | 'number' | 'boolean' | 'select';

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  defaultValue: unknown;
  options?: CustomFieldOption[];
  min?: number;
  max?: number;
  description?: string;
  group?: string;
}

export interface NodeFeatureFlags {
  hasMap?: boolean;
  hasDialogLines?: boolean;
  hasOutcomes?: boolean;
  hasHandouts?: boolean;
  hasSceneSettings?: boolean;
  hasAutoAdvance?: boolean;
  hasVictoryDefeat?: boolean;
  hasContinue?: boolean;
  hasBriefing?: boolean;
}

export interface NodeTypeConfig {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
  features: NodeFeatureFlags;
  customFields?: CustomFieldDefinition[];
}

export const DEFAULT_NODE_TYPE_CONFIGS: NodeTypeConfig[] = [
  {
    id: 'combat',
    label: 'Combat',
    icon: 'swords',
    color: '220 70% 50%',
    features: { hasMap: true, hasVictoryDefeat: true, hasBriefing: true },
  },
  {
    id: 'cutscene',
    label: 'Cutscene',
    icon: 'film',
    color: '270 60% 55%',
    features: { hasDialogLines: true, hasSceneSettings: true, hasAutoAdvance: true, hasContinue: true },
  },
  {
    id: 'dialog',
    label: 'Dialog',
    icon: 'message-square',
    color: '45 85% 55%',
    features: { hasDialogLines: true, hasOutcomes: true, hasSceneSettings: true, hasContinue: true },
  },
  {
    id: 'downtime',
    label: 'Downtime',
    icon: 'coffee',
    color: '170 60% 45%',
    features: { hasContinue: true },
  },
];

export function buildDefaultCustomData(config: NodeTypeConfig): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (config.customFields) {
    for (const field of config.customFields) {
      data[field.key] = field.defaultValue;
    }
  }
  return data;
}

export function getNodeTypeConfig(
  configs: NodeTypeConfig[],
  nodeTypeId: string,
): NodeTypeConfig | undefined {
  return configs.find(c => c.id === nodeTypeId);
}
