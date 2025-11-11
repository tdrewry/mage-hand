/**
 * Visibility Synchronization System
 * Computes which tokens are visible to which players and syncs this across multiplayer
 */

import type { Token, Player } from '@/stores/sessionStore';
import type { Role } from '@/stores/roleStore';
import type { CanvasRegion } from '@/stores/regionStore';
import { computeVisibility, regionsToSegments, type Point } from './visibilityEngine';
import { getVisibleTokensForPlayer } from './visionPermissions';
import { canSeeAllFog, getPlayerRoles } from './rolePermissions';

export interface TokenVisibilityData {
  tokenId: string;
  visibleToPlayers: string[]; // Array of player IDs who can see this token
  hiddenFromPlayers: string[]; // Array of player IDs who cannot see this token
  lastUpdated: number;
}

export interface VisibilitySnapshot {
  tokens: TokenVisibilityData[];
  timestamp: number;
}

/**
 * Compute visibility for all tokens based on fog of war and vision rules
 */
export function computeTokenVisibility(
  tokens: Token[],
  players: Player[],
  roles: Role[],
  walls: CanvasRegion[],
  fogEnabled: boolean,
  exploredAreasSerialized: string
): VisibilitySnapshot {
  const wallSegments = regionsToSegments(walls);
  const visibilityData: TokenVisibilityData[] = [];

  // For each token, determine which players can see it
  for (const token of tokens) {
    const visibleToPlayers: string[] = [];
    const hiddenFromPlayers: string[] = [];

    for (const player of players) {
      const playerRoles = getPlayerRoles(player, roles);
      
      // DM and roles with canSeeAllFog always see everything
      if (canSeeAllFog(player, roles)) {
        visibleToPlayers.push(player.id);
        continue;
      }

      // Check if token is hidden (isHidden flag)
      if (token.isHidden) {
        hiddenFromPlayers.push(player.id);
        continue;
      }

      // Get visible tokens for this player using the vision permissions system
      const visibleTokens = getVisibleTokensForPlayer(tokens, player, roles, wallSegments);
      
      // Check if token is in any of the visible categories
      const isVisible = 
        visibleTokens.friendlyTokens.some(t => t.id === token.id) ||
        visibleTokens.neutralTokens.some(t => t.id === token.id) ||
        visibleTokens.visibleHostileTokens.some(t => t.id === token.id);

      if (isVisible) {
        // If fog is enabled, also check if token is in explored/visible area
        if (fogEnabled && exploredAreasSerialized) {
          // For now, we'll assume if the token is visible per vision rules, it's visible
          // In a more advanced system, we'd parse the explored areas and check if token is within them
          visibleToPlayers.push(player.id);
        } else {
          // No fog or fog disabled - use vision rules only
          visibleToPlayers.push(player.id);
        }
      } else {
        hiddenFromPlayers.push(player.id);
      }
    }

    visibilityData.push({
      tokenId: token.id,
      visibleToPlayers,
      hiddenFromPlayers,
      lastUpdated: Date.now()
    });
  }

  return {
    tokens: visibilityData,
    timestamp: Date.now()
  };
}

/**
 * Check if a specific token should be visible to a specific player
 */
export function isTokenVisibleToPlayer(
  tokenId: string,
  playerId: string,
  visibilitySnapshot: VisibilitySnapshot | null
): boolean {
  if (!visibilitySnapshot) {
    // No visibility data - assume visible (fallback for when not in multiplayer)
    return true;
  }

  const tokenVisibility = visibilitySnapshot.tokens.find(t => t.tokenId === tokenId);
  if (!tokenVisibility) {
    // Token not in visibility data - assume visible
    return true;
  }

  return tokenVisibility.visibleToPlayers.includes(playerId);
}

/**
 * Get all tokens visible to a specific player
 */
export function getVisibleTokenIds(
  playerId: string,
  visibilitySnapshot: VisibilitySnapshot | null
): string[] {
  if (!visibilitySnapshot) {
    // No visibility data - return empty array (all tokens visible by default)
    return [];
  }

  return visibilitySnapshot.tokens
    .filter(t => t.visibleToPlayers.includes(playerId))
    .map(t => t.tokenId);
}

/**
 * Filter tokens based on visibility for a specific player
 */
export function filterVisibleTokens(
  tokens: Token[],
  playerId: string,
  visibilitySnapshot: VisibilitySnapshot | null
): Token[] {
  if (!visibilitySnapshot) {
    // No visibility data - return all tokens
    return tokens;
  }

  const visibleIds = getVisibleTokenIds(playerId, visibilitySnapshot);
  if (visibleIds.length === 0) {
    // Empty means no filtering (all visible)
    return tokens;
  }

  return tokens.filter(token => visibleIds.includes(token.id));
}
