/**
 * Effect Modifier Engine
 *
 * Applies and reverts stat modifiers from effect templates to token character data.
 * Modifiers are tracked per-effect for clean revert on dismissal/expiry.
 * Supports trigger timing: on-enter, on-exit, on-stay.
 */

import type { EffectModifier, EffectCondition, EffectTriggerTiming } from '@/types/effectTypes';
import type { DndBeyondCharacter } from '@/types/creatureTypes';

// ---------------------------------------------------------------------------
// Active modifier tracking
// ---------------------------------------------------------------------------

interface ActiveModifierRecord {
  effectId: string;
  tokenId: string;
  modifiers: EffectModifier[];
  conditions: EffectCondition[];
  /** Original values before modification, for revert */
  originalValues: Record<string, number | string[]>;
  /** Which timing phase these were applied under */
  timing: EffectTriggerTiming;
}

const activeRecords: Map<string, ActiveModifierRecord> = new Map();

/** Key for the active records map — includes timing to allow separate on-enter and on-stay records */
function recordKey(effectId: string, tokenId: string, timing: EffectTriggerTiming): string {
  return `${effectId}::${tokenId}::${timing}`;
}

// ---------------------------------------------------------------------------
// Property access helpers (dot-path on character data)
// ---------------------------------------------------------------------------

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce((o, k) => {
    if (o[k] === undefined) o[k] = {};
    return o[k];
  }, obj);
  parent[last] = value;
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

/** Filter modifiers by timing (default: on-enter) */
function filterByTiming<T extends { timing?: EffectTriggerTiming }>(
  items: T[],
  timing: EffectTriggerTiming,
): T[] {
  return items.filter(item => (item.timing ?? 'on-enter') === timing);
}

// ---------------------------------------------------------------------------
// Apply modifiers (timing-aware)
// ---------------------------------------------------------------------------

/**
 * Apply effect modifiers to a character data object (mutates in place).
 * Only applies modifiers/conditions matching the given timing phase.
 * Returns true if any modifications were made.
 */
export function applyEffectModifiers(
  effectId: string,
  tokenId: string,
  character: DndBeyondCharacter,
  modifiers: EffectModifier[],
  conditions: EffectCondition[],
  timing: EffectTriggerTiming = 'on-enter',
): boolean {
  const key = recordKey(effectId, tokenId, timing);
  if (activeRecords.has(key)) return false; // already applied for this timing

  const timedModifiers = filterByTiming(modifiers, timing);
  const timedConditions = filterByTiming(conditions, timing);

  if (timedModifiers.length === 0 && timedConditions.length === 0) return false;

  const originalValues: Record<string, number | string[]> = {};

  // Apply stat modifiers
  for (const mod of timedModifiers) {
    const currentValue = getNestedValue(character, mod.target);
    if (typeof currentValue === 'number' && typeof mod.value === 'number') {
      originalValues[mod.target] = currentValue;
      let newValue: number;
      switch (mod.operation) {
        case 'add':
          newValue = currentValue + mod.value;
          break;
        case 'set':
          newValue = mod.value;
          break;
        case 'multiply':
          newValue = Math.floor(currentValue * mod.value);
          break;
        default:
          newValue = currentValue;
      }
      setNestedValue(character, mod.target, newValue);
    }
  }

  // Apply conditions
  if (timedConditions.length > 0) {
    originalValues['__conditions'] = [...character.conditions];
    for (const cond of timedConditions) {
      if (cond.apply) {
        if (!character.conditions.includes(cond.condition)) {
          character.conditions.push(cond.condition);
        }
      } else {
        character.conditions = character.conditions.filter(c => c !== cond.condition);
      }
    }
  }

  // Track for revert
  activeRecords.set(key, {
    effectId,
    tokenId,
    modifiers: timedModifiers,
    conditions: timedConditions,
    originalValues,
    timing,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Remove modifiers (revert) — timing-aware
// ---------------------------------------------------------------------------

/**
 * Revert modifiers from a specific effect on a character for a given timing phase.
 * Returns true if any modifications were reverted.
 */
export function removeEffectModifiers(
  effectId: string,
  tokenId: string,
  character: DndBeyondCharacter,
  timing: EffectTriggerTiming = 'on-enter',
): boolean {
  const key = recordKey(effectId, tokenId, timing);
  const record = activeRecords.get(key);
  if (!record) return false;

  // Revert stat modifiers
  for (const mod of record.modifiers) {
    const original = record.originalValues[mod.target];
    if (original !== undefined && typeof original === 'number') {
      setNestedValue(character, mod.target, original);
    }
  }

  // Revert conditions
  const originalConditions = record.originalValues['__conditions'];
  if (originalConditions && Array.isArray(originalConditions)) {
    character.conditions = originalConditions as string[];
  }

  activeRecords.delete(key);
  return true;
}

// ---------------------------------------------------------------------------
// Cancel — bulk revert all timings for an effect on all tokens
// ---------------------------------------------------------------------------

/**
 * Cancel an effect: reverts ALL non-damage impacts (all timing phases)
 * for all tokens affected by this effect.
 * Returns the list of token IDs that were reverted.
 */
export function cancelEffectModifiers(
  effectId: string,
  getCharacter: (tokenId: string) => DndBeyondCharacter | undefined,
): string[] {
  const affectedTokenIds: string[] = [];
  const toDelete: string[] = [];

  for (const [key, record] of activeRecords.entries()) {
    if (record.effectId !== effectId) continue;

    const character = getCharacter(record.tokenId);
    if (character) {
      // Revert stat modifiers
      for (const mod of record.modifiers) {
        const original = record.originalValues[mod.target];
        if (original !== undefined && typeof original === 'number') {
          setNestedValue(character, mod.target, original);
        }
      }
      // Revert conditions
      const originalConditions = record.originalValues['__conditions'];
      if (originalConditions && Array.isArray(originalConditions)) {
        character.conditions = originalConditions as string[];
      }
      if (!affectedTokenIds.includes(record.tokenId)) {
        affectedTokenIds.push(record.tokenId);
      }
    }
    toDelete.push(key);
  }

  for (const key of toDelete) {
    activeRecords.delete(key);
  }

  return affectedTokenIds;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get all active modifier records for a given token */
export function getActiveModifiersForToken(tokenId: string): ActiveModifierRecord[] {
  return Array.from(activeRecords.values()).filter(r => r.tokenId === tokenId);
}

/** Get all active modifier records for a given effect */
export function getActiveModifiersForEffect(effectId: string): ActiveModifierRecord[] {
  return Array.from(activeRecords.values()).filter(r => r.effectId === effectId);
}

/** Check if a specific timing phase is already applied for an effect+token */
export function isTimingApplied(effectId: string, tokenId: string, timing: EffectTriggerTiming): boolean {
  return activeRecords.has(recordKey(effectId, tokenId, timing));
}

/** Clear all tracked records (e.g., on session reset) */
export function clearAllModifierRecords(): void {
  activeRecords.clear();
}
