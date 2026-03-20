/**
 * Canvas Item Store — State management for CanvasItem entities on the map.
 * 
 * CanvasItems are physical world objects: torches, chests, weapons, etc.
 * They differ from LibraryItems (useItemStore) which are the compendium
 * data backing these entities.
 * 
 * Sync is handled automatically via JSON Patch middleware.
 * Jazz sync for Items is via JazzItem CoValues (STEP-007 Phase 2).
 * 
 * @see Plans/STEP-007-item-canvas-entity-system.md
 * @see src/stores/itemStore.ts — library/compendium items (different concern)
 */

import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import type { CanvasItem, IlluminationPreset } from '@/types/canvasItem';
import { createCanvasItem } from '@/types/canvasItem';

interface CanvasItemState {
  items: CanvasItem[];

  // ── CRUD ───────────────────────────────────────────────────────────────────
  addItem: (item: CanvasItem) => void;
  addItemAtPosition: (
    name: string,
    position: { x: number; y: number },
    mapId: string,
    overrides?: Partial<CanvasItem>
  ) => string;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  removeItem: (id: string) => void;
  setItems: (items: CanvasItem[]) => void;
  clearAllItems: () => void;

  // ── Selection (local-only, not synced) ─────────────────────────────────────
  selectedItemIds: string[];
  selectItem: (id: string, additive: boolean) => void;
  deselectItem: (id: string) => void;
  clearItemSelection: () => void;
  setSelectedItems: (ids: string[]) => void;

  // ── Pick Up / Drop ─────────────────────────────────────────────────────────
  pickUpItem: (itemId: string, tokenId: string) => void;
  dropItem: (itemId: string, position: { x: number; y: number }) => void;

  // ── Illumination ───────────────────────────────────────────────────────────
  setItemIlluminationPreset: (id: string, preset: IlluminationPreset | undefined) => void;

  // ── Visibility ─────────────────────────────────────────────────────────────
  toggleItemHidden: (id: string) => void;
}

const canvasItemStoreCreator: StateCreator<CanvasItemState> = (set) => ({
  items: [],
  selectedItemIds: [],

  addItem: (item) => {
    set((state) => {
      if (state.items.some(i => i.id === item.id)) {
        console.warn(`[canvasItemStore] addItem skipped — item ${item.id} already exists`);
        return state;
      }
      return { items: [...state.items, item] };
    });
  },

  addItemAtPosition: (name, position, mapId, overrides = {}) => {
    const item = createCanvasItem({ name, position, mapId, ...overrides });
    set((state) => ({ items: [...state.items, item] }));
    return item.id;
  },

  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(i => i.id !== id),
      selectedItemIds: state.selectedItemIds.filter(sid => sid !== id),
    }));
  },

  setItems: (items) => set({ items }),

  clearAllItems: () => set({ items: [], selectedItemIds: [] }),

  selectItem: (id, additive) => {
    set((state) => ({
      selectedItemIds: additive
        ? (state.selectedItemIds.includes(id)
          ? state.selectedItemIds.filter(sid => sid !== id)
          : [...state.selectedItemIds, id])
        : [id],
    }));
  },

  deselectItem: (id) => {
    set((state) => ({
      selectedItemIds: state.selectedItemIds.filter(sid => sid !== id),
    }));
  },

  clearItemSelection: () => set({ selectedItemIds: [] }),

  setSelectedItems: (ids) => set({ selectedItemIds: ids }),

  pickUpItem: (itemId, tokenId) => {
    set((state) => ({
      items: state.items.map(item =>
        item.id === itemId
          ? { ...item, isPickedUp: true, carriedByTokenId: tokenId }
          : item
      ),
    }));
  },

  dropItem: (itemId, position) => {
    set((state) => ({
      items: state.items.map(item =>
        item.id === itemId
          ? { ...item, isPickedUp: false, carriedByTokenId: undefined, position }
          : item
      ),
    }));
  },

  setItemIlluminationPreset: (id, preset) => {
    set((state) => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, illuminationPreset: preset } : item
      ),
    }));
  },

  toggleItemHidden: (id) => {
    set((state) => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, isHidden: !item.isHidden } : item
      ),
    }));
  },
});

// Wrap with syncPatch middleware for real-time multiplayer sync
const withSyncPatch = syncPatch<CanvasItemState>({
  channel: 'canvas-items',
  throttleMs: 100,
  excludePaths: ['selectedItemIds', 'items.*.imageUrl', 'items.*.selected'],
})(canvasItemStoreCreator);

const persistOptions: PersistOptions<CanvasItemState, Partial<CanvasItemState>> = {
  name: 'magehand-canvas-item-store',
  partialize: (state) => ({
    items: state.items.map(item => ({
      ...item,
      imageUrl: undefined, // Loaded from IndexedDB via imageHash
      selected: undefined,
    })),
    selectedItemIds: [],
  }),
};

export const useCanvasItemStore = create<CanvasItemState>()(
  persist(withSyncPatch as StateCreator<CanvasItemState, [], []>, persistOptions)
);
