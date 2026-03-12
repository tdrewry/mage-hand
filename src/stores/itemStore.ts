/**
 * Item Library Store — manages a local item catalog.
 * Persisted via zustand/persist. Included in .mhsession exports.
 * No DO or ephemeral sync — items only travel with tokens.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LibraryItem, ItemCategory, ItemRarity } from '@/types/itemTypes';

export interface ItemSearchOptions {
  category?: ItemCategory;
  rarity?: ItemRarity;
  limit?: number;
}

interface ItemStore {
  items: LibraryItem[];

  // CRUD
  addItem: (item: LibraryItem) => void;
  addItems: (items: LibraryItem[]) => void;
  updateItem: (id: string, updates: Partial<LibraryItem>) => void;
  removeItem: (id: string) => void;
  clearAllItems: () => void;

  // Lookup
  getItemById: (id: string) => LibraryItem | undefined;
  searchItems: (query: string, options?: ItemSearchOptions) => LibraryItem[];
}

export const useItemStore = create<ItemStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((s) => {
          const exists = s.items.some((i) => i.id === item.id);
          if (exists) {
            return {
              items: s.items.map((i) =>
                i.id === item.id ? { ...i, ...item, updatedAt: new Date().toISOString() } : i
              ),
            };
          }
          return { items: [...s.items, item] };
        }),

      addItems: (items) =>
        set((s) => {
          const existingIds = new Set(s.items.map((i) => i.id));
          const newItems = items.filter((i) => !existingIds.has(i.id));
          const updatedExisting = s.items.map((existing) => {
            const incoming = items.find((i) => i.id === existing.id);
            return incoming ? { ...existing, ...incoming, updatedAt: new Date().toISOString() } : existing;
          });
          return { items: [...updatedExisting, ...newItems] };
        }),

      updateItem: (id, updates) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
          ),
        })),

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      clearAllItems: () => set({ items: [] }),

      getItemById: (id) => get().items.find((i) => i.id === id),

      searchItems: (query, options) => {
        const q = query.toLowerCase().trim();
        let results = get().items;

        if (q) {
          results = results.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              i.description?.toLowerCase().includes(q) ||
              i.category.toLowerCase().includes(q) ||
              i.source?.toLowerCase().includes(q)
          );
        }

        if (options?.category) {
          results = results.filter((i) => i.category === options.category);
        }
        if (options?.rarity) {
          results = results.filter((i) => i.rarity === options.rarity);
        }
        if (options?.limit) {
          results = results.slice(0, options.limit);
        }

        return results;
      },
    }),
    {
      name: 'item-store',
      version: 1,
    }
  )
);
