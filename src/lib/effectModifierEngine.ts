/**
 * Effect Modifier Engine
 *
 * Applies and reverts stat modifiers from effect templates to token character data.
 * Modifiers are tracked per-effect for clean revert on dismissal/expiry.
 */

import type { EffectModifier, EffectCondition } from '@/types/effectTypes';
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
}

const activeRecords: Map<string, ActiveModifierRecord> = new Map();

/** Key for the active records map */
function recordKey(effectId: string, tokenId: string): string {
  return `${effectId}::${tokenId}`;
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
// Apply modifiers
// ---------------------------------------------------------------------------

/**
 * Apply effect modifiers to a character data object (mutates in place).
 * Returns true if any modifications were made.
 */
export function applyEffectModifiers(
  effectId: string,
  tokenId: string,
  character: DndBeyondCharacter,
  modifiers: EffectModifier[],
  conditions: EffectCondition[],
): boolean {
  const key = recordKey(effectId, tokenId);
  if (activeRecords.has(key)) return false; // already applied

  const originalValues: Record<string, number | string[]> = {};

  // Apply stat modifiers
  for (const mod of modifiers) {
    const currentValue = getNestedValue(character, mod.target);
    if (typeof currentValue === 'number') {
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
  if (conditions.length > 0) {
    originalValues['__conditions'] = [...character.conditions];
    for (const cond of conditions) {
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
  activeRecords.set(key, { effectId, tokenId, modifiers, conditions, originalValues });
  return true;
}

// ---------------------------------------------------------------------------
// Remove modifiers (revert)
// ---------------------------------------------------------------------------

/**
 * Revert all modifiers from a specific effect on a character.
 * Returns true if any modifications were reverted.
 */
export function removeEffectModifiers(
  effectId: string,
  tokenId: string,
  character: DndBeyondCharacter,
): boolean {
  const key = recordKey(effectId, tokenId);
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

/** Clear all tracked records (e.g., on session reset) */
export function clearAllModifierRecords(): void {
  activeRecords.clear();
}
