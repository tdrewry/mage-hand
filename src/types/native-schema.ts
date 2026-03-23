export interface MageHandAction {
  id: string;
  name: string;
  category: string;
  pipelineId?: string;
  executionPolicy: 'shared' | 'per-target';
  targetingMode: 'manual' | 'template' | 'self';
  templateId?: string;
  cost?: Record<string, number>;
}

export interface MageHandEntity {
  id: string;
  name: string;
  resources: Record<string, { current: number; max: number }>;
  stats: Record<string, number>;
  actions: MageHandAction[];
}
