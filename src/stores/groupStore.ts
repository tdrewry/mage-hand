/**
 * Universal Group Store
 * 
 * Manages entity groups (tokens, regions, map objects, lights)
 * for unified selection, transformation, and prefab operations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  EntityGroup,
  GroupMember,
  EntityType,
  EntityGeometry,
  createEntityGroup,
  recalculateGroupBounds,
} from '../lib/groupTransforms';
import { useRegionStore } from './regionStore';
import { useMapObjectStore } from './mapObjectStore';

// ============= Entity Index =============
// Derived lookup: entityId -> groupId, rebuilt on group changes

let entityIndex: Map<string, string> = new Map();

const rebuildEntityIndex = (groups: EntityGroup[]) => {
  entityIndex = new Map();
  for (const group of groups) {
    for (const member of group.members) {
      entityIndex.set(member.id, group.id);
    }
  }
};

// ============= Store Interface =============

interface GroupStore {
  groups: EntityGroup[];

  // Group CRUD
  addGroup: (name: string, members: GroupMember[], geometries: EntityGeometry[]) => EntityGroup;
  /** Restore a group with its exact original ID (used when loading from save/autosave). */
  restoreGroup: (group: EntityGroup) => void;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<EntityGroup>) => void;
  /** Lock or unlock a group and propagate the state to all member entities. */
  setGroupLocked: (groupId: string, locked: boolean) => void;
  clearAllGroups: () => void;

  // Member operations
  addMembersToGroup: (groupId: string, members: GroupMember[]) => void;
  removeMemberFromGroup: (groupId: string, entityId: string) => void;

  // Lookups
  getGroupForEntity: (entityId: string, entityType?: EntityType) => EntityGroup | null;
  getMembersByType: (groupId: string, type: EntityType) => GroupMember[];
  isEntityInAnyGroup: (entityId: string) => boolean;

  // Bounds
  recalculateBounds: (groupId: string, geometries: EntityGeometry[]) => void;

  // Selection
  selectedGroupIds: string[];
  selectGroup: (groupId: string) => void;
  deselectGroup: (groupId: string) => void;
  clearGroupSelection: () => void;
  toggleGroupSelection: (groupId: string) => void;

  // Migration: old API compatibility
  /** @deprecated Use addGroup with members array */
  addGroupFromTokenIds?: (name: string, tokenIds: string[]) => EntityGroup;
}

export const useGroupStore = create<GroupStore>()(
  persist(
    (set, get) => ({
      groups: [],
      selectedGroupIds: [],

      addGroup: (name, members, geometries) => {
        if (members.length === 0) {
          throw new Error('Cannot create group without members');
        }
        const newGroup = createEntityGroup(name, members, geometries);

        set((state) => {
          const next = [...state.groups, newGroup];
          rebuildEntityIndex(next);
          return { groups: next };
        });

        // Propagate the group's initial locked state (false) to all members
        // so children that were individually locked get unlocked to match the group
        members.forEach(({ id, type }) => {
          if (type === 'region') {
            useRegionStore.getState().updateRegion(id, { locked: newGroup.locked });
          } else if (type === 'mapObject') {
            useMapObjectStore.getState().updateMapObject(id, { locked: newGroup.locked });
          }
        });

        return newGroup;
      },

      restoreGroup: (group) => {
        set((state) => {
          // Replace any existing group with the same ID, or append
          const existing = state.groups.find(g => g.id === group.id);
          const next = existing
            ? state.groups.map(g => g.id === group.id ? group : g)
            : [...state.groups, group];
          rebuildEntityIndex(next);
          return { groups: next };
        });
      },

      removeGroup: (groupId) => {
        set((state) => {
          const next = state.groups.filter(g => g.id !== groupId);
          rebuildEntityIndex(next);
          return {
            groups: next,
            selectedGroupIds: state.selectedGroupIds.filter(id => id !== groupId),
          };
        });
      },

      updateGroup: (groupId, updates) => {
        set((state) => {
          const next = state.groups.map(g =>
            g.id === groupId ? { ...g, ...updates } : g
          );
          // Always rebuild index — id or members may have changed
          rebuildEntityIndex(next);
          return { groups: next };
        });
      },

      setGroupLocked: (groupId, locked) => {
        const group = get().groups.find(g => g.id === groupId);
        if (!group) return;

        // Update the group's own locked flag
        get().updateGroup(groupId, { locked });

        // Propagate lock state to member entities that support it
        group.members.forEach(({ id, type }) => {
          if (type === 'region') {
            useRegionStore.getState().updateRegion(id, { locked });
          } else if (type === 'mapObject') {
            useMapObjectStore.getState().updateMapObject(id, { locked });
          }
          // tokens and lights do not have a locked field
        });
      },

      clearAllGroups: () => {
        entityIndex = new Map();
        set({ groups: [], selectedGroupIds: [] });
      },

      addMembersToGroup: (groupId, newMembers) => {
        set((state) => {
          const next = state.groups.map(g => {
            if (g.id !== groupId) return g;
            const existingIds = new Set(g.members.map(m => m.id));
            const toAdd = newMembers.filter(m => !existingIds.has(m.id));
            return { ...g, members: [...g.members, ...toAdd] };
          });
          rebuildEntityIndex(next);
          return { groups: next };
        });
      },

      removeMemberFromGroup: (groupId, entityId) => {
        set((state) => {
          const next = state.groups
            .map(g => {
              if (g.id !== groupId) return g;
              return { ...g, members: g.members.filter(m => m.id !== entityId) };
            })
            .filter(g => g.members.length > 0); // Remove empty groups
          rebuildEntityIndex(next);
          return { groups: next };
        });
      },

      getGroupForEntity: (entityId) => {
        const groupId = entityIndex.get(entityId);
        if (!groupId) return null;
        return get().groups.find(g => g.id === groupId) || null;
      },

      getMembersByType: (groupId, type) => {
        const group = get().groups.find(g => g.id === groupId);
        if (!group) return [];
        return group.members.filter(m => m.type === type);
      },

      isEntityInAnyGroup: (entityId) => entityIndex.has(entityId),

      recalculateBounds: (groupId, geometries) => {
        const group = get().groups.find(g => g.id === groupId);
        if (!group) return;
        const updated = recalculateGroupBounds(group, geometries);
        get().updateGroup(groupId, { bounds: updated.bounds, pivot: updated.pivot });
      },

      selectGroup: (groupId) => {
        set((state) => ({
          selectedGroupIds: state.selectedGroupIds.includes(groupId)
            ? state.selectedGroupIds
            : [...state.selectedGroupIds, groupId],
        }));
      },

      deselectGroup: (groupId) => {
        set((state) => ({
          selectedGroupIds: state.selectedGroupIds.filter(id => id !== groupId),
        }));
      },

      clearGroupSelection: () => set({ selectedGroupIds: [] }),

      toggleGroupSelection: (groupId) => {
        const { selectedGroupIds } = get();
        if (selectedGroupIds.includes(groupId)) {
          get().deselectGroup(groupId);
        } else {
          get().selectGroup(groupId);
        }
      },
    }),
    {
      name: 'token-groups-store',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Migrate old TokenGroup[] (with tokenIds) to EntityGroup[] (with members)
          const oldGroups = persistedState?.groups || [];
          const migratedGroups = oldGroups.map((g: any) => {
            if (g.members) return g; // Already migrated
            // Convert tokenIds -> members
            const tokenIds: string[] = g.tokenIds || [];
            return {
              ...g,
              members: tokenIds.map((id: string) => ({ id, type: 'token' })),
              // Remove old fields
              tokenIds: undefined,
              transform: undefined,
            };
          });
          return { ...persistedState, groups: migratedGroups, selectedGroupIds: [] };
        }
        return persistedState as any;
      },
      

    }
  )
);

// Rebuild entity index on store hydration and changes
useGroupStore.subscribe((state) => {
  rebuildEntityIndex(state.groups);
});
