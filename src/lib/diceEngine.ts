/**
 * Dice Engine — pure-logic RPG dice notation parser and roller.
 * Supports: NdX, +/- modifiers, multiple groups, keep highest/lowest, advantage/disadvantage.
 */

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface DiceGroup {
  count: number;
  sides: number;
  keepHighest?: number;
  keepLowest?: number;
  results: number[];
  keptResults: number[];
}

/** Structured metadata describing the context of a dice roll. */
export interface RollMetadata {
  /** The creature/token name that owns the roll, e.g. "A.Yeti" */
  source?: string;
  /** Why the roll was made, e.g. "Perception", "Attack Roll", "Damage" */
  reason?: string;
  /** Arbitrary extra data for future use (chat log, automation, etc.) */
  [key: string]: unknown;
}

export interface DiceRollResult {
  id: string;
  formula: string;
  groups: DiceGroup[];
  modifier: number;
  total: number;
  timestamp: number;
  label?: string;
  rolledBy?: string;
  /** Structured roll context for display & networking */
  meta?: RollMetadata;
}

interface ParsedGroup {
  count: number;
  sides: number;
  keepHighest?: number;
  keepLowest?: number;
}

export interface ParsedFormula {
  groups: ParsedGroup[];
  modifier: number;
}

/**
 * Parse an RPG dice formula string into structured data.
 *
 * Supported formats:
 *   2d6, 1d20+5, 2d6+1d4+3, 4d6kh3, 2d20kl1, 1d20adv, 1d20dis
 */
export function parseFormula(formula: string): ParsedFormula {
  const cleaned = formula.replace(/\s+/g, '').toLowerCase();
  if (!cleaned) throw new Error('Empty formula');

  // Handle advantage/disadvantage shorthand
  if (/^\d*d\d+adv$/i.test(cleaned)) {
    const sides = parseInt(cleaned.match(/d(\d+)/i)![1]);
    return { groups: [{ count: 2, sides, keepHighest: 1 }], modifier: 0 };
  }
  if (/^\d*d\d+dis$/i.test(cleaned)) {
    const sides = parseInt(cleaned.match(/d(\d+)/i)![1]);
    return { groups: [{ count: 2, sides, keepLowest: 1 }], modifier: 0 };
  }

  const groups: ParsedGroup[] = [];
  let modifier = 0;

  // Split on + or - while keeping the sign
  const tokens = cleaned.match(/[+-]?[^+-]+/g);
  if (!tokens) throw new Error('Invalid formula');

  for (const token of tokens) {
    const trimmed = token.replace(/^\+/, '');

    // Check if it's a dice group: [N]dX[kh|kl N]
    const diceMatch = trimmed.match(/^(-?\d*)d(\d+)(?:(kh|kl)(\d+))?$/);
    if (diceMatch) {
      const countStr = diceMatch[1];
      const count = countStr === '' || countStr === '-' ? (countStr === '-' ? -1 : 1) : parseInt(countStr);
      if (count <= 0 || count > 100) throw new Error(`Invalid die count: ${count}`);
      const sides = parseInt(diceMatch[2]);
      if (sides <= 0 || sides > 1000) throw new Error(`Invalid die sides: ${sides}`);

      const group: ParsedGroup = { count, sides };
      if (diceMatch[3] === 'kh') group.keepHighest = parseInt(diceMatch[4]);
      if (diceMatch[3] === 'kl') group.keepLowest = parseInt(diceMatch[4]);
      groups.push(group);
      continue;
    }

    // Otherwise it should be a flat modifier
    const modMatch = trimmed.match(/^-?\d+$/);
    if (modMatch) {
      modifier += parseInt(trimmed);
      continue;
    }

    throw new Error(`Unrecognized token: "${trimmed}"`);
  }

  if (groups.length === 0) throw new Error('No dice groups found');
  return { groups, modifier };
}

/** Roll a single die with the given number of sides (1-based). */
export function rollSingle(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Parse a formula and execute the roll, returning a full result object. */
export function rollDice(formula: string, label?: string, meta?: RollMetadata): DiceRollResult {
  const parsed = parseFormula(formula);

  const groups: DiceGroup[] = parsed.groups.map((pg) => {
    const results: number[] = [];
    for (let i = 0; i < pg.count; i++) {
      results.push(rollSingle(pg.sides));
    }

    let keptResults = [...results];
    if (pg.keepHighest != null) {
      keptResults = [...results].sort((a, b) => b - a).slice(0, pg.keepHighest);
    } else if (pg.keepLowest != null) {
      keptResults = [...results].sort((a, b) => a - b).slice(0, pg.keepLowest);
    }

    return {
      count: pg.count,
      sides: pg.sides,
      keepHighest: pg.keepHighest,
      keepLowest: pg.keepLowest,
      results,
      keptResults,
    };
  });

  const diceTotal = groups.reduce((sum, g) => sum + g.keptResults.reduce((s, v) => s + v, 0), 0);
  const total = diceTotal + parsed.modifier;

  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    formula,
    groups,
    modifier: parsed.modifier,
    total,
    timestamp: Date.now(),
    label,
    meta,
  };
}
