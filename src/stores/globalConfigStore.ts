import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CONTEXT_REGISTRY_SEED, type SchemaNode } from '@/lib/rules-engine/schemas';
import { applySystemSeeds } from '@/lib/utils/stateMerge';

export interface ConfigItem {
  value: string;
  aliases: string[];
}

export interface CategorySpec {
  id: string;
  label: string;
  items: ConfigItem[];
}

export interface SchemaSpec {
  id: string;
  label: string;
  rootSchema: SchemaNode;
  sourceUrl?: string;
  version?: string;
  role?: 'character' | 'creature' | 'item' | 'system' | 'custom';
}

export interface GlobalConfigState {
  categories: Record<string, CategorySpec>;
  schemas: Record<string, SchemaSpec>;
  
  addCategory: (id: string, label: string) => void;
  removeCategory: (id: string) => void;
  updateCategoryLabel: (id: string, label: string) => void;

  addItem: (categoryId: string, value: string) => void;
  removeItem: (categoryId: string, indexOrValue: number | string) => void;
  updateItem: (categoryId: string, index: number, newValue: string) => void;
  
  addAlias: (categoryId: string, itemIndex: number, alias: string) => void;
  removeAlias: (categoryId: string, itemIndex: number, aliasIndex: number) => void;

  addSchema: (id: string, label: string, rootSchema: SchemaNode, options?: { sourceUrl?: string, version?: string, role?: SchemaSpec['role'] }) => void;
  removeSchema: (id: string) => void;
}

const defaultCategories: Record<string, CategorySpec> = {
  damageTypes: {
    id: 'damageTypes',
    label: 'Damage Types',
    items: ["slashing", "piercing", "bludgeoning", "fire", "cold", "acid", "lightning", "thunder", "poison", "radiant", "necrotic", "force", "psychic"].map(v => ({ value: v, aliases: [] }))
  },
  conditions: {
    id: 'conditions',
    label: 'Conditions',
    items: ["prone", "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "restrained", "stunned", "unconscious", "exhaustion"].map(v => ({ value: v, aliases: [] }))
  },
  abilities: {
    id: 'abilities',
    label: 'Abilities',
    items: [
      { value: "str", aliases: ["strength", "STR"] },
      { value: "dex", aliases: ["dexterity", "DEX"] },
      { value: "con", aliases: ["constitution", "CON"] },
      { value: "int", aliases: ["intelligence", "INT"] },
      { value: "wis", aliases: ["wisdom", "WIS"] },
      { value: "cha", aliases: ["charisma", "CHA"] }
    ]
  }
};

export const useGlobalConfigStore = create<GlobalConfigState>()(
  persist(
    (set) => ({
      categories: defaultCategories,
      schemas: CONTEXT_REGISTRY_SEED,
      
      addCategory: (id, label) => set((state) => {
        if (state.categories[id]) return state;
        return {
          categories: { ...state.categories, [id]: { id, label, items: [] } }
        };
      }),
      
      removeCategory: (id) => set((state) => {
        const newCats = { ...state.categories };
        delete newCats[id];
        return { categories: newCats };
      }),
      
      updateCategoryLabel: (id, label) => set((state) => {
        if (!state.categories[id]) return state;
        return {
          categories: {
            ...state.categories,
            [id]: { ...state.categories[id], label }
          }
        };
      }),
      
      addItem: (categoryId, value) => set((state) => {
        const cat = state.categories[categoryId];
        if (!cat || cat.items.some(i => i.value === value)) return state;
        return {
          categories: {
            ...state.categories,
            [categoryId]: { ...cat, items: [...cat.items, { value, aliases: [] }] }
          }
        };
      }),
      
      removeItem: (categoryId, indexOrValue) => set((state) => {
        const cat = state.categories[categoryId];
        if (!cat) return state;
        
        const newItems = typeof indexOrValue === 'number' 
          ? cat.items.filter((_, i) => i !== indexOrValue)
          : cat.items.filter(i => i.value !== indexOrValue);
          
        return {
          categories: {
            ...state.categories,
            [categoryId]: { ...cat, items: newItems }
          }
        };
      }),
      
      updateItem: (categoryId, index, newValue) => set((state) => {
        const cat = state.categories[categoryId];
        if (!cat || cat.items.some((i, idx) => idx !== index && i.value === newValue)) return state;
        
        const newItems = [...cat.items];
        newItems[index] = { ...newItems[index], value: newValue };
        
        return {
          categories: {
            ...state.categories,
            [categoryId]: { ...cat, items: newItems }
          }
        };
      }),
      
      addAlias: (categoryId, itemIndex, alias) => set((state) => {
        const cat = state.categories[categoryId];
        if (!cat) return state;
        
        const newItems = [...cat.items];
        const item = newItems[itemIndex];
        if (!item || item.aliases.includes(alias) || item.value === alias) return state;
        
        newItems[itemIndex] = { ...item, aliases: [...item.aliases, alias] };
        
        return {
          categories: { ...state.categories, [categoryId]: { ...cat, items: newItems } }
        };
      }),
      
      removeAlias: (categoryId, itemIndex, aliasIndex) => set((state) => {
        const cat = state.categories[categoryId];
        if (!cat) return state;
        
        const newItems = [...cat.items];
        const item = newItems[itemIndex];
        if (!item) return state;
        
        newItems[itemIndex] = { ...item, aliases: item.aliases.filter((_, i) => i !== aliasIndex) };
        
        return {
          categories: { ...state.categories, [categoryId]: { ...cat, items: newItems } }
        };
      }),

      addSchema: (id, label, rootSchema, options) => set((state) => {
        return {
          schemas: { ...state.schemas, [id]: { id, label, rootSchema, ...options } }
        };
      }),

      removeSchema: (id) => set((state) => {
        const newSchemas = { ...state.schemas };
        delete newSchemas[id];
        return { schemas: newSchemas };
      })
    }),
    {
      name: 'vtt-rules-storage',
      merge: (persistedState: any, currentState: GlobalConfigState) => {
        // Enforce the system schemas from the code seed over the persisted schemas
        return applySystemSeeds(persistedState, currentState, {
          schemas: CONTEXT_REGISTRY_SEED
        });
      }
    }
  )
);

/**
 * Resolves an input string against a category's primary value and aliases.
 * Returns the primary `value` ID if a match is found, otherwise null.
 */
export function resolveVocabulary(category: string, input: string): string | null {
  if (!input) return null;
  const state = useGlobalConfigStore.getState();
  const cat = state.categories[category];
  if (!cat) return null;
  
  const searchMatch = input.trim().toLowerCase();
  
  for (const item of cat.items) {
    if (item.value.toLowerCase() === searchMatch) return item.value;
    if (item.aliases.some(a => a.toLowerCase() === searchMatch)) return item.value;
  }
  
  return null;
}
