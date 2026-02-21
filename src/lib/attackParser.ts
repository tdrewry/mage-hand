/**
 * Attack Parser — extracts attack definitions from various creature data formats.
 */
import type { AttackDefinition } from '@/types/actionTypes';
import type { Monster5eTools, MonsterEntry } from '@/types/creatureTypes';
import type { DndBeyondCharacter } from '@/types/creatureTypes';
import { DEFAULT_SLAM_ATTACK } from '@/types/actionTypes';

/**
 * Parse attacks from a 5e.tools monster's action entries.
 * Looks for {@atk mw}/{@atk rw}, {@hit N}, {@damage XdY+Z} patterns.
 */
export function parseMonsterAttacks(monster: Monster5eTools): AttackDefinition[] {
  const attacks: AttackDefinition[] = [];
  
  if (!monster.action) return [DEFAULT_SLAM_ATTACK];

  for (const action of monster.action) {
    const entryText = action.entries
      .map(e => typeof e === 'string' ? e : '')
      .join(' ');

    // Look for attack patterns: {@atk mw} or {@atk rw} etc.
    const isAttack = /\{@atk\s+\w+\}/.test(entryText);
    if (!isAttack) continue;

    // Extract hit bonus: {@hit 5} or {@hit +5}
    const hitMatch = entryText.match(/\{@hit\s*\+?(\d+)\}/);
    const attackBonus = hitMatch ? parseInt(hitMatch[1]) : 0;

    // Extract damage: {@damage 2d6+3} or {@damage 1d8}
    const damageMatch = entryText.match(/\{@damage\s+([^}]+)\}/);
    const damageFormula = damageMatch ? damageMatch[1].trim() : '1d4';

    // Try to extract damage type from text following the damage tag
    const afterDamage = damageMatch
      ? entryText.substring(entryText.indexOf(damageMatch[0]) + damageMatch[0].length)
      : '';
    const typeMatch = afterDamage.match(/\b(slashing|piercing|bludgeoning|fire|cold|lightning|thunder|acid|poison|necrotic|radiant|force|psychic)\b/i);
    const damageType = typeMatch ? typeMatch[1].toLowerCase() : 'bludgeoning';

    // Extract range from text
    const rangeMatch = entryText.match(/reach\s+(\d+)\s*ft\./i) || entryText.match(/range\s+([\d/]+)\s*ft\./i);
    const range = rangeMatch ? `${rangeMatch[1]} ft.` : '5 ft.';

    attacks.push({
      id: `monster-atk-${action.name.replace(/\s+/g, '-').toLowerCase()}`,
      name: action.name,
      attackBonus,
      damageFormula,
      damageType,
      range,
      description: entryText.replace(/\{@\w+\s+([^}]+)\}/g, '$1').substring(0, 120),
    });
  }

  return attacks.length > 0 ? attacks : [DEFAULT_SLAM_ATTACK];
}

/**
 * Parse attacks from a DndBeyondCharacter.
 */
export function parseCharacterAttacks(character: DndBeyondCharacter): AttackDefinition[] {
  const attacks: AttackDefinition[] = [];

  for (const action of character.actions) {
    if (action.attackBonus !== undefined || action.damage) {
      attacks.push({
        id: `char-atk-${action.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: action.name,
        attackBonus: action.attackBonus ?? 0,
        damageFormula: action.damage ?? '1d4',
        damageType: action.damageType ?? 'bludgeoning',
        range: action.range,
        description: action.description,
      });
    }
  }

  return attacks.length > 0 ? attacks : [DEFAULT_SLAM_ATTACK];
}

/**
 * Parse attacks from raw stat block JSON (best-effort).
 * Tries 5e.tools format first, then DnD Beyond format.
 */
export function parseAttacksFromJson(json: any): AttackDefinition[] {
  if (!json) return [DEFAULT_SLAM_ATTACK];

  // If it has 'action' array with entries (5e.tools format)
  if (Array.isArray(json.action) && json.action.length > 0 && json.action[0].entries) {
    return parseMonsterAttacks(json as Monster5eTools);
  }

  // If it has 'actions' array (DnD Beyond format)
  if (Array.isArray(json.actions) && json.actions.length > 0) {
    return parseCharacterAttacks(json as DndBeyondCharacter);
  }

  return [DEFAULT_SLAM_ATTACK];
}
