/**
 * Role-based permission system helpers
 * Phase 2: Permission & Vision Logic
 */
import type { Role } from '@/stores/roleStore';
import type { Player, Token } from '@/stores/sessionStore';

/**
 * Get all roles assigned to a player
 */
export function getPlayerRoles(player: Player, allRoles: Role[]): Role[] {
  if (!player || !player.roleIds || player.roleIds.length === 0) {
    // Fallback for backward compatibility with old 'role' field
    if (player.role) {
      const legacyRoleId = player.role === 'dm' ? 'dm' : 'player';
      const legacyRole = allRoles.find(r => r.id === legacyRoleId);
      return legacyRole ? [legacyRole] : [];
    }
    return [];
  }
  
  return player.roleIds
    .map(roleId => allRoles.find(r => r.id === roleId))
    .filter((role): role is Role => role !== undefined);
}

/**
 * Check if a player has a specific permission
 * A player has a permission if ANY of their roles grant it
 */
export function hasPermission(
  player: Player,
  allRoles: Role[],
  permissionKey: keyof Role['permissions']
): boolean {
  const playerRoles = getPlayerRoles(player, allRoles);
  
  if (playerRoles.length === 0) {
    return false;
  }
  
  // Player has permission if ANY of their roles grant it
  return playerRoles.some(role => role.permissions[permissionKey]);
}

/**
 * Check if two roles are hostile to each other
 */
export function areRolesHostile(
  roleId1: string,
  roleId2: string,
  allRoles: Role[]
): boolean {
  if (!roleId1 || !roleId2 || roleId1 === roleId2) {
    return false;
  }
  
  const role1 = allRoles.find(r => r.id === roleId1);
  const role2 = allRoles.find(r => r.id === roleId2);
  
  if (!role1 || !role2) {
    return false;
  }
  
  return (
    role1.hostileToRoleIds.includes(roleId2) ||
    role2.hostileToRoleIds.includes(roleId1)
  );
}

/**
 * Check if a player can control a specific token
 */
export function canControlToken(
  token: Token,
  player: Player,
  allRoles: Role[]
): boolean {
  const playerRoles = getPlayerRoles(player, allRoles);
  
  if (playerRoles.length === 0) {
    return false;
  }
  
  // Check if player has permission to control all tokens
  if (hasPermission(player, allRoles, 'canControlOtherTokens')) {
    return true;
  }
  
  // Unowned tokens (no roleId and no ownerId) can be controlled by anyone with canControlOwnTokens
  const isUnownedToken = !token.roleId && !token.ownerId;
  if (isUnownedToken && hasPermission(player, allRoles, 'canControlOwnTokens')) {
    return true;
  }
  
  // Check if player can control own tokens and owns this token
  if (hasPermission(player, allRoles, 'canControlOwnTokens')) {
    // Token belongs to player if it has the same role as the player
    const tokenBelongsToPlayer = playerRoles.some(role => role.id === token.roleId);
    
    // Also check legacy ownerId field for backward compatibility
    const tokenOwnedByPlayer = token.ownerId === player.id;
    
    if (tokenBelongsToPlayer || tokenOwnedByPlayer) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a player can see a specific token
 * This checks basic visibility permissions, not line-of-sight
 */
export function canSeeToken(
  token: Token,
  player: Player,
  allRoles: Role[]
): boolean {
  const playerRoles = getPlayerRoles(player, allRoles);
  
  if (playerRoles.length === 0) {
    return false;
  }
  
  // Hidden tokens only visible to roles with canSeeHiddenTokens permission
  if (token.isHidden && !hasPermission(player, allRoles, 'canSeeHiddenTokens')) {
    return false;
  }
  
  // Check if player can see all tokens
  if (hasPermission(player, allRoles, 'canSeeOtherTokens')) {
    return true;
  }
  
  // Check if player can see own tokens
  if (hasPermission(player, allRoles, 'canSeeOwnTokens')) {
    const tokenBelongsToPlayer = playerRoles.some(role => role.id === token.roleId);
    const tokenOwnedByPlayer = token.ownerId === player.id;
    
    if (tokenBelongsToPlayer || tokenOwnedByPlayer) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a player can delete a specific token
 */
export function canDeleteToken(
  token: Token,
  player: Player,
  allRoles: Role[]
): boolean {
  const playerRoles = getPlayerRoles(player, allRoles);
  
  if (playerRoles.length === 0) {
    return false;
  }
  
  // Check if player has permission to delete all tokens
  if (hasPermission(player, allRoles, 'canDeleteOtherTokens')) {
    return true;
  }
  
  // Check if player can delete own tokens and owns this token
  if (hasPermission(player, allRoles, 'canDeleteOwnTokens')) {
    const tokenBelongsToPlayer = playerRoles.some(role => role.id === token.roleId);
    const tokenOwnedByPlayer = token.ownerId === player.id;
    
    if (tokenBelongsToPlayer || tokenOwnedByPlayer) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the relationship between a player and a token
 */
export function getTokenRelationship(
  token: Token,
  player: Player,
  allRoles: Role[]
): 'friendly' | 'neutral' | 'hostile' {
  const playerRoles = getPlayerRoles(player, allRoles);
  
  if (playerRoles.length === 0) {
    return 'neutral';
  }
  
  // Token belongs to player (same role)
  const tokenBelongsToPlayer = playerRoles.some(role => role.id === token.roleId);
  if (tokenBelongsToPlayer) {
    return 'friendly';
  }
  
  // Check if token's role is hostile to any of player's roles
  const isHostile = playerRoles.some(playerRole => 
    areRolesHostile(playerRole.id, token.roleId, allRoles)
  );
  
  return isHostile ? 'hostile' : 'neutral';
}

/**
 * Check if player can create new tokens
 */
export function canCreateTokens(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canCreateTokens');
}

/**
 * Check if player can manage roles
 */
export function canManageRoles(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canManageRoles');
}

/**
 * Check if player can assign roles to other players
 */
export function canAssignRoles(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canAssignRoles');
}

/**
 * Check if player can assign roles to tokens
 */
export function canAssignTokenRoles(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canAssignTokenRoles');
}

/**
 * Check if player can manage hostility between roles
 */
export function canManageHostility(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canManageHostility');
}

/**
 * Check if player can edit the map
 */
export function canEditMap(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canEditMap');
}

/**
 * Check if player can manage fog of war
 */
export function canManageFog(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canManageFog');
}

/**
 * Check if player can manage initiative tracker
 */
export function canManageInitiative(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canManageInitiative');
}

/**
 * Check if player can manage rules engine (pipelines, active effects, schemas)
 */
export function canManageRules(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canManageRules');
}

/**
 * Check if player can see all fog of war
 */
export function canSeeAllFog(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canSeeAllFog');
}

/**
 * Check if player can see friendly vision
 */
export function canSeeFriendlyVision(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canSeeFriendlyVision');
}

/**
 * Check if player can see hostile vision (requires LoS)
 */
export function canSeeHostileVision(player: Player, allRoles: Role[]): boolean {
  return hasPermission(player, allRoles, 'canSeeHostileVision');
}
