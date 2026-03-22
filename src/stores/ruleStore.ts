import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RuleNode } from '@/lib/rules-engine/types';
import { FlowNodePosition } from '@/lib/campaign-editor/types/base';

export interface LogicPipeline {
  id: string;
  name: string;
  description: string;
  nodes: RuleNode[];
  positions: Record<string, FlowNodePosition>;
  entryNodeId?: string;
  mockStateJson?: string;
  updatedAt: string;
}

interface RuleStore {
  pipelines: LogicPipeline[];
  addPipeline: (pipeline: LogicPipeline) => void;
  updatePipeline: (id: string, updates: Partial<LogicPipeline>) => void;
  deletePipeline: (id: string) => void;
}

export const useRuleStore = create<RuleStore>()(
  persist(
    (set) => ({
      pipelines: [],
      addPipeline: (pipeline) => set((state) => ({ pipelines: [...state.pipelines, pipeline] })),
      updatePipeline: (id, updates) => set((state) => ({
        pipelines: state.pipelines.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      })),
      deletePipeline: (id) => set((state) => ({
        pipelines: state.pipelines.filter((p) => p.id !== id),
      })),
    }),
    {
      name: 'vtt-rules-storage',
    }
  )
);
