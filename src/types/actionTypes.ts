/**
 * Action System Types
 * 
 * Defines the data structures for token-to-token and token-to-environment
 * interactions (attacks, abilities, spells, etc.)
 */

export type ActionCategory = 'attack' | 'ability' | 'skill' | 'spell' | 'trap' | 'environment';

export type AttackResolution = 'critical_miss' | 'miss' | 'hit' | 'critical_threat' | 'critical_hit';

export type DefenseType = 'flat' | 'calculated' | 'opposed_roll';

export interface AttackDefinition {
  id: string;
  name: string;
  attackBonus: number;
  damageFormula: string;
  damageType: string;
  range?: string;
  description?: string;
  /** Number of times this attack can be used in a multiattack */
  multiattackCount?: number;
}

export interface ActionTarget {
  tokenId: string;
  tokenName: string;
  /** Distance from attacker in grid units */
  distance: number;
  /** Target's defense value (e.g., AC) */
  defenseValue: number;
  /** How the defense is determined */
  defenseType: DefenseType;
  /** Label for the defense stat (e.g., "AC", "Defense", "Dodge") */
  defenseLabel: string;
}

export interface ActionRollResult {
  /** The natural die result (before modifiers) */
  naturalRoll: number;
  /** Total roll with modifiers */
  totalRoll: number;
  /** The attack bonus applied */
  attackBonus: number;
  /** Formula used (e.g., "1d20+5") */
  formula: string;
}

export interface DamageResult {
  /** Base damage formula (e.g., "2d6+3") */
  formula: string;
  /** Rolled damage total */
  total: number;
  /** Individual die results */
  diceResults: number[];
  /** Damage type (e.g., "slashing", "cold") */
  damageType: string;
  /** DM-adjusted final damage */
  adjustedTotal: number;
}

export interface ActionQueueEntry {
  id: string;
  /** Which phase the action is in */
  phase: 'select_attack' | 'targeting' | 'resolve' | 'complete';
  category: ActionCategory;
  
  /** The source token performing the action */
  sourceTokenId: string;
  sourceTokenName: string;
  
  /** The attack being used */
  attack?: AttackDefinition;
  
  /** Selected target(s) */
  targets: ActionTarget[];
  
  /** Roll results per target */
  rollResults: Record<string, ActionRollResult>;
  
  /** Damage results per target */
  damageResults: Record<string, DamageResult>;
  
  /** DM-chosen resolution per target */
  resolutions: Record<string, AttackResolution>;
  
  /** Timestamp for history */
  timestamp: number;
}

/** Default "Slam" attack available to all tokens */
export const DEFAULT_SLAM_ATTACK: AttackDefinition = {
  id: 'default-slam',
  name: 'Slam',
  attackBonus: 0,
  damageFormula: '1d4',
  damageType: 'bludgeoning',
  range: '5 ft.',
  description: 'A basic melee attack.',
};

/** History entry for resolved actions */
export interface ActionHistoryEntry {
  id: string;
  type: 'action_resolved';
  timestamp: number;
  sourceTokenId: string;
  sourceTokenName: string;
  attack: AttackDefinition;
  targets: Array<{
    tokenId: string;
    tokenName: string;
    distance: number;
    defenseValue: number;
    defenseLabel: string;
    attackRoll: ActionRollResult;
    damage: DamageResult;
    resolution: AttackResolution;
  }>;
}
