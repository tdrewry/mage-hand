import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HandoutEntry } from '@/lib/handouts';

interface HandoutStoreState {
  customHandouts: HandoutEntry[];
  addHandout: (title: string, markdown: string) => string;
  updateHandout: (id: string, updates: Partial<Pick<HandoutEntry, 'title' | 'markdown'>>) => void;
  deleteHandout: (id: string) => void;
}

export const useHandoutStore = create<HandoutStoreState>()(
  persist(
    (set) => ({
      customHandouts: [],

      addHandout: (title, markdown) => {
        const id = `custom-handout-${Date.now()}`;
        const entry: HandoutEntry = {
          id,
          title,
          category: 'custom',
          icon: 'FileText',
          markdown,
        };
        set((s) => ({ customHandouts: [...s.customHandouts, entry] }));
        return id;
      },

      updateHandout: (id, updates) => {
        set((s) => ({
          customHandouts: s.customHandouts.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        }));
      },

      deleteHandout: (id) => {
        set((s) => ({
          customHandouts: s.customHandouts.filter((h) => h.id !== id),
        }));
      },
    }),
    { name: 'magehand-handouts' }
  )
);
