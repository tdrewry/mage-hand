/**
 * Aura Engine
 *
 * Manages token-locked aura effects with:
 * - Wall-blocked hit-testing via the visibility engine
 * - Dynamic modifier apply/remove as tokens enter/leave the aura
 * - Continuous re-evaluation when tokens or the aura source move
 */

import type { PlacedEffect, EffectImpact } from '@/types/effectTypes';
import type { Token } from '@/stores/sessionStore';
import type { LineSegment, Point } from '@/lib/visibilityEngine';
import { computeVisibilityFromSegments } from '@/lib/visibilityEngine';
import {
  applyEffectModifiers,
  removeEffectModifiers,
} from '@/lib/effectModifierEngine';
import type { DndBeyondCharacter } from '@/types/creatureTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuraUpdateResult {
  /** Token IDs that just entered the aura */
  entered: string[];
  /** Token IDs that just left the aura */
  exited: string[];
  /** All token IDs currently inside the aura */
  inside: string[];
  /** Updated impact list */
  impacts: EffectImpact[];
}

// ---------------------------------------------------------------------------
// Wall-blocked circle hit-test
// ---------------------------------------------------------------------------

/**
 * Determine which tokens are within `radiusPx` of `center`, considering
 * wall occlusion. A token is "in the aura" if:
 *   1. Its center is within `radiusPx` of `center` (Euclidean distance)
 *   2. Its center is inside the visibility polygon cast from `center`
 *      through the provided wall segments.
 */
export function computeAuraTargets(
  center: Point,
  radiusPx: number,
  tokens: Token[],
  wallSegments: LineSegment[],
  gridSize: number,
  excludeTokenId?: string,
): { impacts: EffectImpact[]; insideIds: string[] } {
  // Compute visibility polygon from the aura center, capped at the aura radius
  const visibility = computeVisibilityFromSegments(center, wallSegments, radiusPx);
  const visPoly = visibility.polygon;

  const impacts: EffectImpact[] = [];
  const insideIds: string[] = [];

  for (const token of tokens) {
    if (excludeTokenId && token.id === excludeTokenId) continue;

    const tokenCenter: Point = { x: token.x, y: token.y };

    // Distance check
    const dx = tokenCenter.x - center.x;
    const dy = tokenCenter.y - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radiusPx) continue;

    // Wall-blocking check: is the token center inside the visibility polygon?
    if (!pointInPolygon(tokenCenter, visPoly)) continue;

    insideIds.push(token.id);
    impacts.push({
      targetId: token.id,
      targetType: 'token',
      distanceFromOrigin: Math.round((dist / gridSize) * 100) / 100,
      overlapPercent: 1, // Auras are binary: in or out
    });
  }

  impacts.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
  return { impacts, insideIds };
}

// ---------------------------------------------------------------------------
// Diff-based enter/exit detection
// ---------------------------------------------------------------------------

/**
 * Compare previous and current token sets to detect enter/exit events.
 * Returns which tokens entered and which left the aura area.
 */
export function diffAuraTokens(
  previousIds: string[],
  currentIds: string[],
): { entered: string[]; exited: string[] } {
  const prevSet = new Set(previousIds);
  const currSet = new Set(currentIds);

  const entered = currentIds.filter(id => !prevSet.has(id));
  const exited = previousIds.filter(id => !currSet.has(id));

  return { entered, exited };
}

// ---------------------------------------------------------------------------
// Full aura update cycle
// ---------------------------------------------------------------------------

/**
 * Perform a full aura update: recompute targets, detect enter/exit,
 * and apply/remove modifiers accordingly.
 *
 * @param effect - The placed aura effect
 * @param anchorToken - The token this aura is attached to
 * @param allTokens - All tokens on the map (pre-filtered by mapId)
 * @param wallSegments - Wall/obstacle segments for visibility blocking
 * @param gridSize - Grid cell size in pixels
 * @param getCharacter - Function to get a token's character data for modifier application
 * @returns AuraUpdateResult with enter/exit info and updated impacts
 */
export function updateAura(
  effect: PlacedEffect,
  anchorToken: Token,
  allTokens: Token[],
  wallSegments: LineSegment[],
  gridSize: number,
  getCharacter: (tokenId: string) => DndBeyondCharacter | undefined,
): AuraUpdateResult {
  const auraConfig = effect.template.aura;
  if (!auraConfig) {
    return { entered: [], exited: [], inside: [], impacts: [] };
  }

  const radiusPx = auraConfig.radius * gridSize;
  const center: Point = { x: anchorToken.x, y: anchorToken.y };

  // Determine whether to exclude the aura source from hit-testing
  const excludeId = auraConfig.affectSelf ? undefined : effect.anchorTokenId;

  // Compute current targets
  const { impacts, insideIds } = computeAuraTargets(
    center,
    radiusPx,
    allTokens,
    wallSegments,
    gridSize,
    excludeId,
  );

  // Diff against previous state
  const previousIds = effect.tokensInsideArea ?? [];
  const { entered, exited } = diffAuraTokens(previousIds, insideIds);

  // Apply on-enter modifiers for newly entered tokens
  const modifiers = effect.template.modifiers ?? [];
  const conditions = effect.template.conditions ?? [];

  for (const tokenId of entered) {
    const character = getCharacter(tokenId);
    if (character) {
      applyEffectModifiers(effect.id, tokenId, character, modifiers, conditions, 'on-enter');
    }
  }

  // Remove on-enter modifiers and apply on-exit modifiers for exited tokens
  for (const tokenId of exited) {
    const character = getCharacter(tokenId);
    if (character) {
      removeEffectModifiers(effect.id, tokenId, character, 'on-enter');
      applyEffectModifiers(effect.id, tokenId, character, modifiers, conditions, 'on-exit');
    }
  }

  return {
    entered,
    exited,
    inside: insideIds,
    impacts,
  };
}

/**
 * Apply on-stay modifiers for tokens currently inside the aura.
 * Called once per round during tickRound.
 */
export function applyAuraStayEffects(
  effect: PlacedEffect,
  getCharacter: (tokenId: string) => DndBeyondCharacter | undefined,
): void {
  const insideIds = effect.tokensInsideArea ?? [];
  const modifiers = effect.template.modifiers ?? [];
  const conditions = effect.template.conditions ?? [];

  for (const tokenId of insideIds) {
    const character = getCharacter(tokenId);
    if (character) {
      // Remove previous on-stay application, then re-apply
      removeEffectModifiers(effect.id, tokenId, character, 'on-stay');
      applyEffectModifiers(effect.id, tokenId, character, modifiers, conditions, 'on-stay');
    }
  }
}

// ---------------------------------------------------------------------------
// Lightweight tick — position tracking + impact updates (no character data)
// ---------------------------------------------------------------------------

/**
 * Tick all aura effects: update their origin to follow the anchor token,
 * recompute wall-blocked targets, and detect enter/exit events.
 * Returns enter/exit events for optional downstream processing.
 *
 * This is the primary integration point for the render loop.
 * It does NOT apply/remove modifiers (those require character data).
 */
export function tickAuras(
  auraEffects: PlacedEffect[],
  tokens: Token[],
  wallSegments: LineSegment[],
  gridSize: number,
  updateAuraState: (effectId: string, origin: { x: number; y: number }, impacts: EffectImpact[], insideIds: string[]) => void,
): { effectId: string; entered: string[]; exited: string[] }[] {
  const events: { effectId: string; entered: string[]; exited: string[] }[] = [];

  for (const effect of auraEffects) {
    if (!effect.anchorTokenId || !effect.template.aura) continue;
    if (effect.dismissedAt || effect.cancelledAt) continue;

    const anchorToken = tokens.find(t => t.id === effect.anchorTokenId);
    if (!anchorToken) continue;

    const aura = effect.template.aura;
    const radiusPx = aura.radius * gridSize;
    const center: Point = { x: anchorToken.x, y: anchorToken.y };
    const excludeId = aura.affectSelf ? undefined : effect.anchorTokenId;

    // Only recompute if anchor moved or we need fresh data
    const { impacts, insideIds } = computeAuraTargets(
      center,
      radiusPx,
      tokens,
      aura.wallBlocked !== false ? wallSegments : [],
      gridSize,
      excludeId,
    );

    // Diff for enter/exit
    const previousIds = effect.tokensInsideArea ?? [];
    const { entered, exited } = diffAuraTokens(previousIds, insideIds);

    // Update store atomically
    updateAuraState(effect.id, center, impacts, insideIds);

    if (entered.length > 0 || exited.length > 0) {
      events.push({ effectId: effect.id, entered, exited });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Point-in-polygon (ray-casting for general polygons)
// ---------------------------------------------------------------------------

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (
      ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
    ) {
      inside = !inside;
    }
  }
  return inside;
}
