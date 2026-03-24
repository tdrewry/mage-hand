/**
 * Core interface definitions for the Orchestrated Active Effects system.
 * Active Effects act as high-level sequence controllers that bind together
 * rendering (Map Templates) and logic execution (Pipelines).
 */

export interface ActiveEffectDuration {
  value: number;
  unit: 'rounds' | 'minutes' | 'hours' | 'instant';
}

export interface ActiveEffectTriggers {
  onApply?: boolean;
  onTurnStart?: boolean;
  onTurnEnd?: boolean;
  onRemove?: boolean;
}

export interface ActiveEffectStep {
  /** The taxonomy of the execution step */
  type: 'pipeline' | 'challenge_pipeline' | 'damage_pipeline' | 'maptemplate';
  /** The UUID of the bound pipeline or template to execute */
  targetId: string;
}

export interface ActiveEffect {
  id: string;
  name: string;
  
  /** Renderable Markdown for the effect or spell text */
  description?: string;
  
  /** Array of strings for fast searching/sorting. e.g. ['evocation', 'fire', 'aoe'] */
  tags?: string[];
  
  /** How long the effect persists in the world or attached to an entity */
  duration?: ActiveEffectDuration;
  
  /** Hooks to trigger evaluation. If none are provided, the effect usually resolves instantly and destroys itself. */
  triggers?: ActiveEffectTriggers;
  
  /** The sequenced array of actions or references executed when triggered */
  steps?: ActiveEffectStep[];
  
  /** Optional dictionary to pass state between downstream steps (like target hit coordinates) */
  sharedContext?: Record<string, any>;
}
