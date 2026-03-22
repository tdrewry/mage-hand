import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TelemetryRule {
  id: string;
  name: string;
  logic: any;
}

interface TelemetryState {
  webhooks: string[];
  rules: TelemetryRule[];
  addWebhook: (url: string) => void;
  removeWebhook: (url: string) => void;
  saveRule: (rule: TelemetryRule) => void;
  removeRule: (id: string) => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set) => ({
      webhooks: [],
      rules: [
        {
          id: '1',
          name: 'High Ops Spike',
          logic: { ">": [{ "var": "outOps" }, 100] }
        }
      ],
      addWebhook: (url) => set((state) => ({ 
        webhooks: state.webhooks.includes(url) ? state.webhooks : [...state.webhooks, url] 
      })),
      removeWebhook: (url) => set((state) => ({ 
        webhooks: state.webhooks.filter((w) => w !== url) 
      })),
      saveRule: (rule) => set((state) => {
        const index = state.rules.findIndex((r) => r.id === rule.id);
        if (index >= 0) {
          const newRules = [...state.rules];
          newRules[index] = rule;
          return { rules: newRules };
        } else {
          return { rules: [...state.rules, rule] };
        }
      }),
      removeRule: (id) => set((state) => ({ 
        rules: state.rules.filter((r) => r.id !== id) 
      })),
    }),
    {
      name: 'mage-hand-telemetry-settings',
    }
  )
);
