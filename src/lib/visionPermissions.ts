/**
 * Vision and line-of-sight permission helpers
 * Phase 2: Vision Logic with Hostility
 */
import type { Role } from '@/stores/roleStore';
import type { Player, Token } from '@/stores/sessionStore';
import type { LineSegment } from './wallGeometry';
import { 
  getPlayerRoles, 
  areRolesHostile, 
  canSeeToken,
  canSeeAllFog,
  getTokenRelationship 
} from './rolePermissions';

export interface VisibleTokens {
  friendlyTokens: Token[];
  neutralTokens: Token[];
  visibleHostileTokens: Token[];
  hiddenHostileTokens: Token[];
}

// Cache for LoS calculations to improve performance
interface LoSCacheEntry {
  hasLoS: boolean;
  timestamp: number;
}

const losCache = new Map<string, LoSCacheEntry>();
const CACHE_DURATION_MS = 1000; // Cache LoS results for 1 second

/**
 * Clear old entries from the LoS cache
 */
function cleanLoSCache(): void {
  const now = Date.now();
  for (const [key, entry] of losCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION_MS) {
      losCache.delete(key);
    }
  }
}

/**
 * Check if there is line of sight between two tokens
 * Uses wall segments to detect obstacles
 */
export function hasLineOfSight(
  token1: Token,
  token2: Token,
  wallSegments: LineSegment[]
): boolean {
  // Generate cache key
  const cacheKey = `${token1.id}-${token2.id}`;
  
  // Check cache first
  const cached = losCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.hasLoS;
  }
  
  // Calculate center points of tokens
  const center1 = {
    x: token1.x + (token1.gridWidth * 50) / 2, // Assuming 50px grid cells
    y: token1.y + (token1.gridHeight * 50) / 2,
  };
  
  const center2 = {
    x: token2.x + (token2.gridWidth * 50) / 2,
    y: token2.y + (token2.gridHeight * 50) / 2,
  };
  
  // Check if line between token centers intersects any wall segment
  const losLine: LineSegment = {
    start: center1,
    end: center2,
  };
  
  let hasLoS = true;
  
  for (const wall of wallSegments) {
    if (lineSegmentsIntersect(losLine, wall)) {
      hasLoS = false;
      break;
    }
  }
  
  // Cache the result
  losCache.set(cacheKey, {
    hasLoS,
    timestamp: Date.now(),
  });
  
  // Periodically clean old cache entries
  if (Math.random() < 0.1) {
    cleanLoSCache();
  }
  
  return hasLoS;
}

/**
 * Check if two line segments intersect
 * Uses the cross-product method for line segment intersection
 */
export function lineSegmentsIntersect(
  line1: LineSegment,
  line2: LineSegment
): boolean {
  const { start: p1, end: p2 } = line1;
  const { start: p3, end: p4 } = line2;
  
  const denominator = 
    (p4.y - p3.y) * (p2.x - p1.x) - 
    (p4.x - p3.x) * (p2.y - p1.y);
  
  // Lines are parallel or coincident
  if (Math.abs(denominator) < 0.0001) {
    return false;
  }
  
  const ua = 
    ((p4.x - p3.x) * (p1.y - p3.y) - 
     (p4.y - p3.y) * (p1.x - p3.x)) / 
    denominator;
  
  const ub = 
    ((p2.x - p1.x) * (p1.y - p3.y) - 
     (p2.y - p1.y) * (p1.x - p3.x)) / 
    denominator;
  
  // Check if intersection point is within both line segments
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Get all tokens visible to a player, categorized by relationship
 * This is the core function for vision filtering with hostility
 */
export function getVisibleTokensForPlayer(
  allTokens: Token[],
  player: Player,
  allRoles: Role[],
  wallSegments: LineSegment[]
): VisibleTokens {
  const playerRoles = getPlayerRoles(player, allRoles);
  
  const result: VisibleTokens = {
    friendlyTokens: [],
    neutralTokens: [],
    visibleHostileTokens: [],
    hiddenHostileTokens: [],
  };
  
  // DM or anyone with canSeeAllFog sees everything
  if (canSeeAllFog(player, allRoles)) {
    for (const token of allTokens) {
      if (!canSeeToken(token, player, allRoles)) {
        continue;
      }
      
      const relationship = getTokenRelationship(token, player, allRoles);
      
      if (relationship === 'friendly') {
        result.friendlyTokens.push(token);
      } else if (relationship === 'neutral') {
        result.neutralTokens.push(token);
      } else {
        result.visibleHostileTokens.push(token);
      }
    }
    
    return result;
  }
  
  // Get all friendly tokens first (for LoS checking)
  const friendlyTokens = allTokens.filter(token => {
    if (!canSeeToken(token, player, allRoles)) {
      return false;
    }
    
    const relationship = getTokenRelationship(token, player, allRoles);
    return relationship === 'friendly';
  });
  
  result.friendlyTokens = friendlyTokens;
  
  // Process all other tokens
  for (const token of allTokens) {
    // Skip if we can't see this token at all
    if (!canSeeToken(token, player, allRoles)) {
      continue;
    }
    
    // Skip if already in friendly list
    if (friendlyTokens.includes(token)) {
      continue;
    }
    
    const relationship = getTokenRelationship(token, player, allRoles);
    
    if (relationship === 'neutral') {
      // Neutral tokens are always visible
      result.neutralTokens.push(token);
    } else if (relationship === 'hostile') {
      // Hostile tokens only visible if in LoS from any friendly token
      let inLoS = false;
      
      for (const friendlyToken of friendlyTokens) {
        if (hasLineOfSight(friendlyToken, token, wallSegments)) {
          inLoS = true;
          break;
        }
      }
      
      if (inLoS) {
        result.visibleHostileTokens.push(token);
      } else {
        result.hiddenHostileTokens.push(token);
      }
    }
  }
  
  return result;
}

/**
 * Get tokens that should be used for fog of war calculation
 * Includes friendly, neutral, and visible hostile tokens
 */
export function getTokensForVisionCalculation(
  allTokens: Token[],
  player: Player,
  allRoles: Role[],
  wallSegments: LineSegment[]
): Token[] {
  const visibleTokens = getVisibleTokensForPlayer(allTokens, player, allRoles, wallSegments);
  
  return [
    ...visibleTokens.friendlyTokens,
    ...visibleTokens.neutralTokens,
    ...visibleTokens.visibleHostileTokens,
  ];
}

/**
 * Check if a specific token should be rendered for a player
 * Takes into account hostility and line of sight
 */
export function shouldRenderToken(
  token: Token,
  player: Player,
  allRoles: Role[],
  wallSegments: LineSegment[],
  playerTokens: Token[]
): boolean {
  // Basic visibility check
  if (!canSeeToken(token, player, allRoles)) {
    return false;
  }
  
  // DM sees everything
  if (canSeeAllFog(player, allRoles)) {
    return true;
  }
  
  const relationship = getTokenRelationship(token, player, allRoles);
  
  // Friendly and neutral tokens always render
  if (relationship === 'friendly' || relationship === 'neutral') {
    return true;
  }
  
  // Hostile tokens only render if in LoS from player's tokens
  if (relationship === 'hostile') {
    for (const playerToken of playerTokens) {
      if (hasLineOfSight(playerToken, token, wallSegments)) {
        return true;
      }
    }
    return false;
  }
  
  return true;
}

/**
 * Clear the LoS cache
 * Should be called when walls or token positions change significantly
 */
export function clearLoSCache(): void {
  losCache.clear();
}
