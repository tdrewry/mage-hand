/**
 * Formula Engine — Public API
 * 
 * Re-exports the public-facing modules for the formula evaluation system.
 */

export { parseFormula } from './parser';
export { evaluateFormula, buildRollRecord } from './evaluator';
export type { EvaluationResult } from './evaluator';
export { buildPropertyContext } from './context';
export { deckManager } from './decks';
export type {
  ASTNode, PropertyContext, PropertyContextMeta,
  RNGSource, RollRecord,
  FormulaEvalRequest, FormulaClaimMessage, FormulaResultMessage,
  FormulaEphemeralMessage,
} from './types';
export type { Card, Deck } from './decks';
