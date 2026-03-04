/**
 * Action Parser — extracts ALL actionable items from creature data:
 * attacks, spells, skills, and features/traits.
 */
import type { AttackDefinition } from '@/types/actionTypes';
import type { Monster5eTools, MonsterEntry } from '@/types/creatureTypes';
import type { DndBeyondCharacter } from '@/types/creatureTypes';
import { DEFAULT_SLAM_ATTACK } from '@/types/actionTypes';

// ─── Unified Action Item ──────────────────────────────────────────────────────

export type TokenActionCategory = 'attack' | 'spell' | 'skill' | 'trait' | 'bonus' | 'reaction' | 'legendary';

export interface TokenActionItem {
  id: string;
  name: string;
  category: TokenActionCategory;
  /** For attacks: attack bonus */
  attackBonus?: number;
  /** Damage/healing formula */
  damageFormula?: string;
  damageType?: string;
  range?: string;
  description?: string;
  /** For spells: spell level (0 = cantrip) */
  spellLevel?: number;
  /** For skills: modifier */
  modifier?: number;
  /** Whether this is proficient (skills) or prepared (spells) */
  proficient?: boolean;
  /** Can be used as an AttackDefinition for the action system */
  asAttack?: AttackDefinition;
}

// ─── Collect all actions from any data source ─────────────────────────────────

export function collectAllActions(json: any): TokenActionItem[] {
  if (!json) return [slamAsActionItem()];

  // 5e.tools monster format
  if (Array.isArray(json.action) && json.action.length > 0 && json.action[0].entries) {
    return collectMonsterActions(json as Monster5eTools);
  }

  // DnD Beyond / editable character format
  if (Array.isArray(json.actions)) {
    return collectCharacterActions(json as DndBeyondCharacter);
  }

  return [slamAsActionItem()];
}

// ─── Monster actions ──────────────────────────────────────────────────────────

function collectMonsterActions(monster: Monster5eTools): TokenActionItem[] {
  const items: TokenActionItem[] = [];

  // Standard actions (attacks + non-attacks)
  if (monster.action) {
    for (const action of monster.action) {
      const entryText = entriesToText(action.entries);
      const isAttack = /\{@atk\s+\w+\}/.test(entryText);

      if (isAttack) {
        const atk = parseMonsterAttackEntry(action, entryText);
        items.push({
          id: `monster-atk-${slugify(action.name)}`,
          name: action.name,
          category: 'attack',
          attackBonus: atk.attackBonus,
          damageFormula: atk.damageFormula,
          damageType: atk.damageType,
          range: atk.range,
          description: cleanTags(entryText).substring(0, 120),
          asAttack: atk,
        });
      } else {
        // Non-attack action (e.g. Frightful Presence)
        items.push({
          id: `monster-act-${slugify(action.name)}`,
          name: action.name,
          category: 'trait',
          description: cleanTags(entryText).substring(0, 120),
        });
      }
    }
  }

  // Bonus actions
  if (monster.bonus) {
    for (const action of monster.bonus) {
      const entryText = entriesToText(action.entries);
      items.push({
        id: `monster-bonus-${slugify(action.name)}`,
        name: action.name,
        category: 'bonus',
        description: cleanTags(entryText).substring(0, 120),
      });
    }
  }

  // Reactions
  if (monster.reaction) {
    for (const action of monster.reaction) {
      const entryText = entriesToText(action.entries);
      items.push({
        id: `monster-react-${slugify(action.name)}`,
        name: action.name,
        category: 'reaction',
        description: cleanTags(entryText).substring(0, 120),
      });
    }
  }

  // Legendary actions
  if (monster.legendary) {
    for (const action of monster.legendary) {
      const entryText = entriesToText(action.entries);
      items.push({
        id: `monster-legend-${slugify(action.name)}`,
        name: action.name,
        category: 'legendary',
        description: cleanTags(entryText).substring(0, 120),
      });
    }
  }

  // Traits
  if (monster.trait) {
    for (const trait of monster.trait) {
      const entryText = entriesToText(trait.entries);
      items.push({
        id: `monster-trait-${slugify(trait.name)}`,
        name: trait.name,
        category: 'trait',
        description: cleanTags(entryText).substring(0, 120),
      });
    }
  }

  // Spellcasting
  if (monster.spellcasting) {
    for (const sc of monster.spellcasting) {
      // At-will spells
      if (sc.will) {
        for (const spell of sc.will) {
          items.push({
            id: `monster-spell-${slugify(spell)}`,
            name: cleanTags(spell),
            category: 'spell',
            spellLevel: 0,
            description: 'At will',
          });
        }
      }
      // Daily spells
      if (sc.daily) {
        for (const [freq, spells] of Object.entries(sc.daily)) {
          for (const spell of spells) {
            items.push({
              id: `monster-spell-${slugify(spell)}-${freq}`,
              name: cleanTags(spell),
              category: 'spell',
              description: `${freq.replace('e', '/day each').replace(/^\d/, m => `${m}/day`)}`,
            });
          }
        }
      }
      // Leveled spells
      if (sc.spells) {
        for (const [level, data] of Object.entries(sc.spells)) {
          const lvl = parseInt(level);
          for (const spell of data.spells) {
            items.push({
              id: `monster-spell-${slugify(spell)}-L${level}`,
              name: cleanTags(spell),
              category: 'spell',
              spellLevel: lvl,
              description: lvl === 0 ? 'Cantrip' : `Level ${level}${data.slots ? ` (${data.slots} slots)` : ''}`,
            });
          }
        }
      }
    }
  }

  return items.length > 0 ? items : [slamAsActionItem()];
}

// ─── Character actions ────────────────────────────────────────────────────────

function collectCharacterActions(character: DndBeyondCharacter): TokenActionItem[] {
  const items: TokenActionItem[] = [];

  // Attacks / Actions
  for (const action of character.actions) {
    const atk: AttackDefinition = {
      id: `char-atk-${slugify(action.name)}`,
      name: action.name,
      attackBonus: action.attackBonus ?? 0,
      damageFormula: action.damage ?? '1d4',
      damageType: action.damageType ?? 'bludgeoning',
      range: action.range,
      description: action.description,
    };
    items.push({
      id: atk.id,
      name: action.name,
      category: 'attack',
      attackBonus: atk.attackBonus,
      damageFormula: atk.damageFormula,
      damageType: atk.damageType,
      range: action.range,
      description: action.description,
      asAttack: atk,
    });
  }

  // Skills
  for (const skill of character.skills) {
    items.push({
      id: `char-skill-${slugify(skill.name)}`,
      name: skill.name,
      category: 'skill',
      modifier: skill.modifier,
      proficient: skill.proficient,
    });
  }

  // Features / Traits
  for (const feat of character.features) {
    items.push({
      id: `char-trait-${slugify(feat.name)}`,
      name: feat.name,
      category: 'trait',
      description: feat.description,
    });
  }

  // Spells
  if (character.spells) {
    for (const cantrip of character.spells.cantrips) {
      items.push({
        id: `char-spell-${slugify(cantrip.name)}`,
        name: cantrip.name,
        category: 'spell',
        spellLevel: 0,
        description: 'Cantrip',
      });
    }
    for (const lvl of character.spells.spellsByLevel) {
      for (const spell of lvl.spells) {
        items.push({
          id: `char-spell-${slugify(spell.name)}-L${lvl.level}`,
          name: spell.name,
          category: 'spell',
          spellLevel: lvl.level,
          proficient: spell.prepared,
          description: `Level ${lvl.level}${spell.prepared ? ' (prepared)' : ''}`,
        });
      }
    }
  }

  return items.length > 0 ? items : [slamAsActionItem()];
}

// ─── Legacy compat: extract just AttackDefinition[] ───────────────────────────

export function parseMonsterAttacks(monster: Monster5eTools): AttackDefinition[] {
  const items = collectMonsterActions(monster);
  const attacks = items.filter(i => i.asAttack).map(i => i.asAttack!);
  return attacks.length > 0 ? attacks : [DEFAULT_SLAM_ATTACK];
}

export function parseCharacterAttacks(character: DndBeyondCharacter): AttackDefinition[] {
  const items = collectCharacterActions(character);
  const attacks = items.filter(i => i.asAttack).map(i => i.asAttack!);
  return attacks.length > 0 ? attacks : [DEFAULT_SLAM_ATTACK];
}

export function parseAttacksFromJson(json: any): AttackDefinition[] {
  if (!json) return [DEFAULT_SLAM_ATTACK];
  if (Array.isArray(json.action) && json.action.length > 0 && json.action[0].entries) {
    return parseMonsterAttacks(json as Monster5eTools);
  }
  if (Array.isArray(json.actions) && json.actions.length > 0) {
    return parseCharacterAttacks(json as DndBeyondCharacter);
  }
  return [DEFAULT_SLAM_ATTACK];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slamAsActionItem(): TokenActionItem {
  return {
    id: 'default-slam',
    name: 'Slam',
    category: 'attack',
    attackBonus: 0,
    damageFormula: '1d4',
    damageType: 'bludgeoning',
    range: '5 ft.',
    description: 'A basic melee attack.',
    asAttack: DEFAULT_SLAM_ATTACK,
  };
}

function parseMonsterAttackEntry(action: MonsterEntry, entryText: string): AttackDefinition {
  const hitMatch = entryText.match(/\{@hit\s*\+?(\d+)\}/);
  const attackBonus = hitMatch ? parseInt(hitMatch[1]) : 0;
  const damageMatch = entryText.match(/\{@damage\s+([^}]+)\}/);
  const damageFormula = damageMatch ? damageMatch[1].trim() : '1d4';
  const afterDamage = damageMatch
    ? entryText.substring(entryText.indexOf(damageMatch[0]) + damageMatch[0].length)
    : '';
  const typeMatch = afterDamage.match(/\b(slashing|piercing|bludgeoning|fire|cold|lightning|thunder|acid|poison|necrotic|radiant|force|psychic)\b/i);
  const damageType = typeMatch ? typeMatch[1].toLowerCase() : 'bludgeoning';
  const rangeMatch = entryText.match(/reach\s+(\d+)\s*ft\./i) || entryText.match(/range\s+([\d/]+)\s*ft\./i);
  const range = rangeMatch ? `${rangeMatch[1]} ft.` : '5 ft.';

  return {
    id: `monster-atk-${slugify(action.name)}`,
    name: action.name,
    attackBonus,
    damageFormula,
    damageType,
    range,
    description: cleanTags(entryText).substring(0, 120),
  };
}

function entriesToText(entries: (string | any)[]): string {
  return entries.map(e => typeof e === 'string' ? e : '').join(' ');
}

function cleanTags(text: string): string {
  return text.replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
}
