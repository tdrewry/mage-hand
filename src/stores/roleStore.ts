/**
 * Role-based permission system store
 * Phase 1: Core Role System Foundation
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';

export interface Role {
  id: string;
  name: string;
  color: string; // Hex color for visual identification
  isSystem: boolean; // true for "DM" and "Player"
  hostileToRoleIds: string[]; // Roles this role is hostile to
  permissions: {
    // Token control
    canControlOwnTokens: boolean;
    canControlOtherTokens: boolean;
    
    // Vision & fog
    canSeeAllFog: boolean;
    canSeeFriendlyVision: boolean;
    canSeeHostileVision: boolean; // Requires LoS
    
    // Token visibility
    canSeeOwnTokens: boolean;
    canSeeOtherTokens: boolean;
    canSeeHiddenTokens: boolean;
    
    // Token management
    canCreateTokens: boolean;
    canDeleteOwnTokens: boolean;
    canDeleteOtherTokens: boolean;
    
    // Role & hostility management
    canManageRoles: boolean;
    canAssignRoles: boolean;
    canAssignTokenRoles: boolean;
    canManageHostility: boolean;
    
    // Map & environment
    canEditMap: boolean;
    canManageFog: boolean;
    canManageInitiative: boolean;
  };
}

export interface RoleState {
  roles: Role[];
  addRole: (role: Role) => void;
  updateRole: (roleId: string, updates: Partial<Role>) => void;
  removeRole: (roleId: string) => void;
  clearRoles: () => void;
  setHostility: (roleId: string, targetRoleId: string, isHostile: boolean, bidirectional?: boolean) => void;
  areRolesHostile: (roleId1: string, roleId2: string) => boolean;
  getRoleById: (roleId: string) => Role | undefined;
  initializeDefaultRoles: () => void;
}

// Default DM role with all permissions
const DEFAULT_DM_ROLE: Role = {
  id: 'dm',
  name: 'Dungeon Master',
  color: '#ef4444', // red-500
  isSystem: true,
  hostileToRoleIds: [],
  permissions: {
    canControlOwnTokens: true,
    canControlOtherTokens: true,
    canSeeAllFog: true,
    canSeeFriendlyVision: true,
    canSeeHostileVision: true,
    canSeeOwnTokens: true,
    canSeeOtherTokens: true,
    canSeeHiddenTokens: true,
    canCreateTokens: true,
    canDeleteOwnTokens: true,
    canDeleteOtherTokens: true,
    canManageRoles: true,
    canAssignRoles: true,
    canAssignTokenRoles: true,
    canManageHostility: true,
    canEditMap: true,
    canManageFog: true,
    canManageInitiative: true,
  },
};

// Default Player role with limited permissions
const DEFAULT_PLAYER_ROLE: Role = {
  id: 'player',
  name: 'Player',
  color: '#22c55e', // green-500
  isSystem: true,
  hostileToRoleIds: [],
  permissions: {
    canControlOwnTokens: true,
    canControlOtherTokens: false,
    canSeeAllFog: false,
    canSeeFriendlyVision: true,
    canSeeHostileVision: false,
    canSeeOwnTokens: true,
    canSeeOtherTokens: true,
    canSeeHiddenTokens: false,
    canCreateTokens: false,
    canDeleteOwnTokens: true,
    canDeleteOtherTokens: false,
    canManageRoles: false,
    canAssignRoles: false,
    canAssignTokenRoles: false,
    canManageHostility: false,
    canEditMap: false,
    canManageFog: false,
    canManageInitiative: false,
  },
};

export const DEFAULT_ROLES: Role[] = [DEFAULT_DM_ROLE, DEFAULT_PLAYER_ROLE];

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: [],
      
      addRole: (role) => {
        set((state) => ({
          roles: [...state.roles, role],
        }));
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          // TODO: Implement role sync
          console.log('[Role] Role added, sync not yet implemented', role);
        }
      },
      
      updateRole: (roleId, updates) => {
        set((state) => ({
          roles: state.roles.map((role) =>
            role.id === roleId ? { ...role, ...updates } : role
          ),
        }));
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          // TODO: Implement role sync
          console.log('[Role] Role updated, sync not yet implemented', roleId, updates);
        }
      },
      
      removeRole: (roleId) => {
        const role = get().getRoleById(roleId);
        if (role?.isSystem) {
          console.warn(`Cannot remove system role: ${role.name}`);
          return;
        }
        
        set((state) => ({
          roles: state.roles.filter((r) => r.id !== roleId),
        }));
      },
      
      clearRoles: () => {
        set({ roles: [] });
      },
      
      setHostility: (roleId, targetRoleId, isHostile, bidirectional = false) => {
        set((state) => {
          const updatedRoles = state.roles.map((role) => {
            if (role.id === roleId) {
              const hostileToRoleIds = isHostile
                ? [...role.hostileToRoleIds, targetRoleId].filter((id, index, self) => self.indexOf(id) === index)
                : role.hostileToRoleIds.filter((id) => id !== targetRoleId);
              return { ...role, hostileToRoleIds };
            }
            
            // Handle bidirectional hostility
            if (bidirectional && role.id === targetRoleId) {
              const hostileToRoleIds = isHostile
                ? [...role.hostileToRoleIds, roleId].filter((id, index, self) => self.indexOf(id) === index)
                : role.hostileToRoleIds.filter((id) => id !== roleId);
              return { ...role, hostileToRoleIds };
            }
            
            return role;
          });
          
          return { roles: updatedRoles };
        });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          // TODO: Implement hostility sync
          console.log('[Role] Hostility changed, sync not yet implemented', roleId, targetRoleId, isHostile);
        }
      },
      
      areRolesHostile: (roleId1, roleId2) => {
        const role1 = get().getRoleById(roleId1);
        const role2 = get().getRoleById(roleId2);
        
        if (!role1 || !role2) return false;
        
        return (
          role1.hostileToRoleIds.includes(roleId2) ||
          role2.hostileToRoleIds.includes(roleId1)
        );
      },
      
      getRoleById: (roleId) => {
        return get().roles.find((role) => role.id === roleId);
      },
      
      initializeDefaultRoles: () => {
        const state = get();
        if (state.roles.length === 0) {
          set({ roles: DEFAULT_ROLES });
        }
      },
    }),
    {
      name: 'vtt-role-storage',
      partialize: (state) => ({
        roles: state.roles,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.roles.length === 0) {
          state.initializeDefaultRoles();
        } else if (state) {
          // Deduplicate roles by id
          const seen = new Set<string>();
          const uniqueRoles = state.roles.filter((role) => {
            if (seen.has(role.id)) return false;
            seen.add(role.id);
            return true;
          });
          if (uniqueRoles.length !== state.roles.length) {
            useRoleStore.setState({ roles: uniqueRoles });
          }
        }
      },
    }
  )
);
