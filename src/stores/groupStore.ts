/**
 * Token Group Store
 * 
 * Manages token groups for enhanced canvas operations
 * Integrates with the new group transformation system
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TokenGroup, createTokenGroup, updateGroupBounds } from '../lib/groupTransforms';
import { Token } from './sessionStore';

interface GroupStore {
  groups: TokenGroup[];
  
  // Group operations
  addGroup: (name: string, tokenIds: string[]) => TokenGroup;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<TokenGroup>) => void;
  
  // Group membership
  addTokenToGroup: (groupId: string, tokenId: string) => void;
  removeTokenFromGroup: (groupId: string, tokenId: string) => void;
  getTokenGroup: (tokenId: string) => TokenGroup | null;
  
  // Group selection
  selectedGroupIds: string[];
  selectGroup: (groupId: string) => void;
  deselectGroup: (groupId: string) => void;
  clearGroupSelection: () => void;
  toggleGroupSelection: (groupId: string) => void;
  
  // Bulk operations
  clearAllGroups: () => void;
  updateGroupBounds: (groupId: string, tokens: Token[]) => void;
  
  // Utilities
  getGroupsContainingToken: (tokenId: string) => TokenGroup[];
  isTokenInAnyGroup: (tokenId: string) => boolean;
}

export const useGroupStore = create<GroupStore>()(
  persist(
    (set, get) => ({
      groups: [],
      selectedGroupIds: [],

      addGroup: (name, tokenIds) => {
        // Don't create empty groups
        if (tokenIds.length === 0) {
          throw new Error('Cannot create group without tokens');
        }

        // Create a dummy token array for bounds calculation
        // In real usage, this would come from the session store
        const dummyTokens: Token[] = tokenIds.map(id => ({
          id,
          name: 'Token',
          imageUrl: '',
          x: 0,
          y: 0,
          gridWidth: 1,
          gridHeight: 1,
          label: 'Token',
          color: '#ffffff',
          roleId: 'player',
          isHidden: false
        }));

        const newGroup = createTokenGroup(name, dummyTokens);
        
        set((state) => ({
          groups: [...state.groups, newGroup]
        }));

        return newGroup;
      },

      removeGroup: (groupId) => {
        set((state) => ({
          groups: state.groups.filter(group => group.id !== groupId),
          selectedGroupIds: state.selectedGroupIds.filter(id => id !== groupId)
        }));
      },

      updateGroup: (groupId, updates) => {
        set((state) => ({
          groups: state.groups.map(group =>
            group.id === groupId ? { ...group, ...updates } : group
          )
        }));
      },

      addTokenToGroup: (groupId, tokenId) => {
        set((state) => ({
          groups: state.groups.map(group =>
            group.id === groupId 
              ? { ...group, tokenIds: [...group.tokenIds, tokenId] }
              : group
          )
        }));
      },

      removeTokenFromGroup: (groupId, tokenId) => {
        set((state) => ({
          groups: state.groups.map(group => {
            if (group.id === groupId) {
              const newTokenIds = group.tokenIds.filter(id => id !== tokenId);
              return { ...group, tokenIds: newTokenIds };
            }
            return group;
          }).filter(group => group.tokenIds.length > 0) // Remove empty groups
        }));
      },

      getTokenGroup: (tokenId) => {
        const { groups } = get();
        return groups.find(group => group.tokenIds.includes(tokenId)) || null;
      },

      selectGroup: (groupId) => {
        set((state) => ({
          selectedGroupIds: state.selectedGroupIds.includes(groupId) 
            ? state.selectedGroupIds 
            : [...state.selectedGroupIds, groupId]
        }));
      },

      deselectGroup: (groupId) => {
        set((state) => ({
          selectedGroupIds: state.selectedGroupIds.filter(id => id !== groupId)
        }));
      },

      clearGroupSelection: () => {
        set({ selectedGroupIds: [] });
      },

      toggleGroupSelection: (groupId) => {
        const { selectedGroupIds } = get();
        if (selectedGroupIds.includes(groupId)) {
          get().deselectGroup(groupId);
        } else {
          get().selectGroup(groupId);
        }
      },

      clearAllGroups: () => {
        set({ 
          groups: [],
          selectedGroupIds: []
        });
      },

      updateGroupBounds: (groupId, tokens) => {
        const { groups } = get();
        const group = groups.find(g => g.id === groupId);
        
        if (!group) return;

        const groupTokens = tokens.filter(t => group.tokenIds.includes(t.id));
        const updatedGroup = updateGroupBounds(group, groupTokens);
        
        get().updateGroup(groupId, updatedGroup);
      },

      getGroupsContainingToken: (tokenId) => {
        const { groups } = get();
        return groups.filter(group => group.tokenIds.includes(tokenId));
      },

      isTokenInAnyGroup: (tokenId) => {
        const { groups } = get();
        return groups.some(group => group.tokenIds.includes(tokenId));
      }
    }),
    {
      name: 'token-groups-store',
      version: 1,
    }
  )
);