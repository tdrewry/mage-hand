/**
 * EntitySheet — Generic, system-agnostic token metadata schema.
 * Supports D&D 5e, Pathfinder, Lancer, Call of Cthulhu, and homebrew systems.
 * 
 * All sections are optional. A minimal token may have only description.name.
 * 
 * @see Plans/STEP-009-generic-token-character-sheet-schema.md
 */

// ─── Supporting Value Types ──────────────────────────────────────────────────

/** A numeric value with optional temporary modifiers (buffs, spells, items). */
export interface ModifiableValue {
  base: number;
  modifiers?: Array<{
    source: string;    // e.g. "Bless spell", "Ring of Protection"
    value: number;
    expires?: string;  // ISO 8601 duration or "permanent"
  }>;
  // Computed: base + sum(modifiers[].value)
  // Consumers should use helpers/computeModifiable() to resolve this.
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Conditions applied by an action (onset, duration, save). */
export interface EntityCondition {
  id: string;
  name: string;
  description?: string;
  /** Duration in rounds; undefined = until removed manually. */
  durationRounds?: number;
  source?: string;
  /** The formula save DC (e.g. "8 + {proficiency} + {wis.modifier}"). */
  saveDC?: string;
  /** Ability used for the save (e.g. "con", "wis"). */
  saveAbility?: string;
}

/** Formula strings for an action's attack roll + effect expression. */
export interface ActionFormula {
  /** Roll-to-hit sub-formula. */
  attack?: {
    roll: string;      // e.g. "1d20 + {str.modifier} + {proficiency}"
    versus: string;    // e.g. "target.defenses.armorClass.computed"
  };
  /** Effect applied on success. */
  effect?: {
    apply: string;     // property path to mutate, e.g. "target.defenses.hitPoints.current"
    value: string;     // expression, e.g. "-(1d10 + {str.modifier})"
    damageType?: string;
    halfOnSave?: string;
  };
  /** Conditions applied on hit/success. */
  conditions?: Array<{
    apply: EntityCondition;
    duration: string;
    saves?: string;
    saveDC?: string;
  }>;
}

export interface EntityAction {
  id: string;
  name: string;
  actionType: 'action' | 'bonus_action' | 'reaction' | 'free' | 'legendary' | 'lair';
  description?: string;
  formula?: ActionFormula;
  tags?: string[];         // e.g. ["melee", "weapon", "slashing"]
  requiresItem?: string;   // Inventory item id
}

// ─── Features ────────────────────────────────────────────────────────────────

export type FeatureType =
  | 'class'
  | 'subclass'
  | 'species'
  | 'background'
  | 'feat'
  | 'trait'
  | 'racial'
  | 'custom';

export interface EntityFeature {
  id: string;
  name: string;
  featureType: FeatureType;
  description?: string;
  /** Optional usage tracking (e.g. Channel Divinity, Bardic Inspiration). */
  uses?: {
    max: number;
    current: number;
    rechargeOn: 'long_rest' | 'short_rest' | 'dawn' | 'manual';
  };
}

// ─── Spellcasting ─────────────────────────────────────────────────────────────

export interface SpellEntry {
  id: string;
  name: string;
  level: number;            // 0 = cantrip
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  description?: string;
  concentration?: boolean;
  ritual?: boolean;
  /** Formula for the spell's primary effect (damage, healing, etc.). */
  formula?: string;
}

export interface SpellcastingBlock {
  /** e.g. "Wizard", "Paladin (Divine Smite)" */
  source: string;
  /** Spellcasting ability (e.g. "int", "cha"). */
  ability: string;
  /** Spell save DC formula or fixed value. */
  saveDC?: string;
  /** Spell attack bonus formula. */
  attackBonus?: string;
  spellSlots?: Record<number, { max: number; current: number }>; // level → slots
  spells: SpellEntry[];
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryEntry {
  id: string;
  name: string;
  quantity: number;
  weight?: number;            // in lbs
  value?: string;             // e.g. "50gp"
  description?: string;
  equipped?: boolean;
  /** Whether this item provides an action (links to EntityAction by id). */
  linkedActionId?: string;
  /** Whether this is a container (e.g. bag of holding). */
  containerId?: string;
}

// ─── Companions ───────────────────────────────────────────────────────────────

/** Cross-reference to another token on the canvas. */
export interface CompanionRef {
  tokenId: string;
  relationship: 'familiar' | 'mount' | 'minion' | 'summon' | 'ally' | 'custom';
  label?: string;
}

// ─── Main EntitySheet ─────────────────────────────────────────────────────────

/**
 * Full entity data sheet. Attached to a Token via token.entitySheet.
 * All top-level sections are optional; presence implies the system uses them.
 */
export interface EntitySheet {
  version: 1;

  // ── Description ────────────────────────────────────────────────────────────
  description: {
    name: string;
    species?: string;
    background?: string;
    alignment?: string;
    levels?: Array<{ class: string; level: number }>;
    appearance?: string;
    notes?: string;
    /** Game-system custom flavor fields. */
    custom?: Record<string, string | number>;
  };

  // ── Defenses ───────────────────────────────────────────────────────────────
  defenses?: {
    armorClass?: ModifiableValue;
    hitPoints?: {
      max: number;
      current: number;
      temporary: number;
    };
    savingThrows?: Record<string, ModifiableValue>;  // ability → ModifiableValue
    resistances?: string[];
    immunities?: string[];
    vulnerabilities?: string[];
  };

  // ── Ability Scores ─────────────────────────────────────────────────────────
  /** Keys are game-system defined: "str","dex","con","int","wis","cha" for 5e. */
  abilityScores?: Record<string, ModifiableValue>;

  // ── Skills ─────────────────────────────────────────────────────────────────
  /** Keys are game-system defined skill names. */
  skills?: Record<string, {
    proficient?: boolean;
    expertise?: boolean;
    modifier?: ModifiableValue;
  }>;

  // ── Speeds ─────────────────────────────────────────────────────────────────
  /** Keys: "walk", "fly", "swim", "burrow", "climb", etc. Values in ft. */
  speeds?: Record<string, number>;

  // ── Combat Stats ───────────────────────────────────────────────────────────
  initiative?: ModifiableValue;
  proficiencyBonus?: ModifiableValue;
  passivePerception?: number;

  // ── Actions & Features ─────────────────────────────────────────────────────
  actions?: EntityAction[];
  features?: EntityFeature[];

  // ── Spellcasting ───────────────────────────────────────────────────────────
  spellcasting?: SpellcastingBlock[];

  // ── Conditions ─────────────────────────────────────────────────────────────
  conditions?: EntityCondition[];

  // ── Inventory ──────────────────────────────────────────────────────────────
  inventory?: InventoryEntry[];

  // ── Companions ─────────────────────────────────────────────────────────────
  companions?: CompanionRef[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the resolved numeric value of a ModifiableValue.
 * Returns `base` if modifiers is empty/undefined.
 */
export function computeModifiable(mv: ModifiableValue): number {
  if (!mv.modifiers?.length) return mv.base;
  return mv.base + mv.modifiers.reduce((acc, m) => acc + m.value, 0);
}

/**
 * Compute the 5e-style ability modifier from an ability score.
 * e.g. 18 → +4, 8 → -1, 10 → 0
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Create a minimal EntitySheet for a new token.
 */
export function createEmptyEntitySheet(name: string): EntitySheet {
  return {
    version: 1,
    description: { name },
  };
}
