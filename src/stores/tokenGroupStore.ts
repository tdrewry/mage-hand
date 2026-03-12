/**
 * Token Group Store
 *
 * Manages logical token groups (e.g. "The Party", "Kobold Pack") with
 * formation presets for deployment and group movement.
 * 
 * Distinct from groupStore.ts which handles spatial entity grouping
 * (regions, map objects, tokens) for transform operations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============= Types =============

export type Formation = 'freeform' | 'line' | 'column' | 'wedge' | 'circle' | 'square';

export interface TokenGroup {
  id: string;
  name: string;
  tokenIds: string[];
  formation: Formation;
  color?: string;   // Badge / visual accent
  icon?: string;    // Lucide icon name
}

export const FORMATION_LABELS: Record<Formation, string> = {
  freeform: 'Freeform',
  line: 'Line',
  column: 'Column',
  wedge: 'Wedge (V)',
  circle: 'Circle',
  square: 'Square',
};

export const FORMATION_DESCRIPTIONS: Record<Formation, string> = {
  freeform: 'No automatic positioning',
  line: 'Single horizontal row',
  column: 'Single-file vertical column',
  wedge: 'V-shape with leader at front',
  circle: 'Ring around center point',
  square: 'Grid / box arrangement',
};

// ============= Formation Geometry =============

/**
 * Compute relative {dx, dy} offsets for `count` members in a given formation.
 * Offsets are in grid-unit multiples (caller multiplies by gridSize).
 */
export function getFormationOffsets(formation: Formation, count: number): { dx: number; dy: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ dx: 0, dy: 0 }];

  switch (formation) {
    case 'line':
      return Array.from({ length: count }, (_, i) => ({
        dx: i - Math.floor(count / 2),
        dy: 0,
      }));

    case 'column':
      return Array.from({ length: count }, (_, i) => ({
        dx: 0,
        dy: i - Math.floor(count / 2),
      }));

    case 'wedge': {
      // Leader at front (index 0), others fan out behind in V
      const offsets: { dx: number; dy: number }[] = [{ dx: 0, dy: 0 }];
      for (let i = 1; i < count; i++) {
        const row = Math.ceil(i / 2);
        const side = i % 2 === 1 ? -1 : 1;
        offsets.push({ dx: side * row, dy: row });
      }
      return offsets;
    }

    case 'circle': {
      const radius = Math.max(1, Math.ceil(count / 4));
      return Array.from({ length: count }, (_, i) => {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        return {
          dx: Math.round(Math.cos(angle) * radius * 10) / 10,
          dy: Math.round(Math.sin(angle) * radius * 10) / 10,
        };
      });
    }

    case 'square': {
      const cols = Math.ceil(Math.sqrt(count));
      return Array.from({ length: count }, (_, i) => ({
        dx: (i % cols) - Math.floor(cols / 2),
        dy: Math.floor(i / cols) - Math.floor(Math.ceil(count / cols) / 2),
      }));
    }

    case 'freeform':
    default:
      // Grid fallback — same as square
      const cols = Math.ceil(Math.sqrt(count));
      return Array.from({ length: count }, (_, i) => ({
        dx: (i % cols) - Math.floor(cols / 2),
        dy: Math.floor(i / cols) - Math.floor(Math.ceil(count / cols) / 2),
      }));
  }
}

// ============= Store =============

interface TokenGroupStore {
  groups: TokenGroup[];

  addGroup: (name: string, tokenIds?: string[], formation?: Formation) => TokenGroup;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<Omit<TokenGroup, 'id'>>) => void;
  clearAllGroups: () => void;

  addTokensToGroup: (groupId: string, tokenIds: string[]) => void;
  removeTokenFromGroup: (groupId: string, tokenId: string) => void;
  setFormation: (groupId: string, formation: Formation) => void;

  getGroupById: (groupId: string) => TokenGroup | undefined;
  getGroupsForToken: (tokenId: string) => TokenGroup[];
}

export const useTokenGroupStore = create<TokenGroupStore>()(
  persist(
    (set, get) => ({
      groups: [],

      addGroup: (name, tokenIds = [], formation = 'freeform') => {
        const newGroup: TokenGroup = {
          id: `tg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name,
          tokenIds,
          formation,
        };
        set((state) => ({ groups: [...state.groups, newGroup] }));
        return newGroup;
      },

      removeGroup: (groupId) => {
        set((state) => ({ groups: state.groups.filter((g) => g.id !== groupId) }));
      },

      updateGroup: (groupId, updates) => {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
        }));
      },

      clearAllGroups: () => set({ groups: [] }),

      addTokensToGroup: (groupId, tokenIds) => {
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) return g;
            const existing = new Set(g.tokenIds);
            const toAdd = tokenIds.filter((id) => !existing.has(id));
            return { ...g, tokenIds: [...g.tokenIds, ...toAdd] };
          }),
        }));
      },

      removeTokenFromGroup: (groupId, tokenId) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, tokenIds: g.tokenIds.filter((id) => id !== tokenId) } : g
          ),
        }));
      },

      setFormation: (groupId, formation) => {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? { ...g, formation } : g)),
        }));
      },

      getGroupById: (groupId) => get().groups.find((g) => g.id === groupId),

      getGroupsForToken: (tokenId) => get().groups.filter((g) => g.tokenIds.includes(tokenId)),
    }),
    {
      name: 'token-groups-logical-store',
      version: 1,
    }
  )
);
