import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdapterMapping {
  /** The path on the source user-resource JSON (e.g. ".", "system.attributes.hp", "classes[0]") */
  sourcePath: string;
  /** The mount point on the target Mage-Hand resource (e.g. "adapter.raw", "hp", "ac") */
  mountPoint: string;
}

export interface AdapterDefinition {
  /** Unique ID for this adapter instance */
  id: string;
  /** Human readable name (e.g. "5e.tools Monster Adapter") */
  name: string;
  /** The source resource identity signature (e.g. "monster-5e") */
  sourceId: string;
  /** The target resource identity signature in Mage-Hand (e.g. "mage-hand-entity") */
  targetId: string;
  /** Array of path translation objects */
  mappings: AdapterMapping[];
  createdAt: number;
  updatedAt: number;
}

interface AdapterStore {
  adapters: AdapterDefinition[];
  addAdapter: (adapter: Omit<AdapterDefinition, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAdapter: (id: string, updates: Partial<AdapterDefinition>) => void;
  removeAdapter: (id: string) => void;
  // helper to query active mappings
  getAdaptersForSource: (sourceId: string) => AdapterDefinition[];
}

// Temporary built-in seed for the default 5e integration requested by the user
const SEED_ADAPTERS: AdapterDefinition[] = [
  {
    id: 'base-json-adapter',
    name: 'Raw JSON Mount Adapter',
    sourceId: 'any', // generic fallback
    targetId: 'mage-hand-entity',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mappings: [
      { sourcePath: '.', mountPoint: 'adapter.raw' }
    ]
  }
];

export const useAdapterStore = create<AdapterStore>()(
  persist(
    (set, get) => ({
      adapters: [...SEED_ADAPTERS],

  addAdapter: (adapter) => {
    set((state) => ({
      adapters: [...state.adapters, { 
        ...adapter, 
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }]
    }));
  },

  updateAdapter: (id, updates) => {
    set((state) => ({
      adapters: state.adapters.map(a => 
        a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
      )
    }));
  },

  removeAdapter: (id) => {
    set((state) => ({
      adapters: state.adapters.filter(a => a.id !== id)
    }));
  },

    getAdaptersForSource: (sourceId) => {
      return get().adapters.filter(a => a.sourceId === sourceId || a.sourceId === 'any');
    }
  }),
  {
    name: 'vtt-adapter-store',
  }
));
