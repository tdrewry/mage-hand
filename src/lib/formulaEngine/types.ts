/**
 * Formula Engine Types
 * 
 * AST node definitions, property context, RNG source, and roll record types
 * for the Mage-Hand formula evaluation system.
 * 
 * @see Plans/STEP-009-generic-token-character-sheet-schema.md
 */

// ─── AST Nodes ────────────────────────────────────────────────────────────────

export type ASTNodeType =
  | 'Number'
  | 'DiceRoll'       // NdX with optional keep/drop modifiers
  | 'PropertyRef'    // {dot.path}
  | 'BinaryOp'       // +, -, *, /, %, ^
  | 'UnaryOp'        // -expr
  | 'FunctionCall'   // min(), max(), floor(), ceil(), abs(), round()
  | 'CardDraw'       // draw(deck_id [, N])
  | 'Conditional'    // if(cond, then, else)
  | 'Comparison'     // =, !=, <, <=, >, >=
  ;

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface DiceRollNode {
  type: 'DiceRoll';
  count: number;        // N in NdX (min 1)
  sides: number;        // X
  keep?: { mode: 'high' | 'low'; count: number };  // kh/kl
  drop?: { mode: 'high' | 'low'; count: number };  // dh/dl
}

export interface PropertyRefNode {
  type: 'PropertyRef';
  path: string;  // dot-separated path, e.g. "str.modifier"
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  op: '+' | '-' | '*' | '/' | '%' | '^';
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  op: '-';
  operand: ASTNode;
}

export type BuiltinFunction = 'min' | 'max' | 'floor' | 'ceil' | 'abs' | 'round';

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: BuiltinFunction;
  args: ASTNode[];
}

export interface CardDrawNode {
  type: 'CardDraw';
  deckId: string;
  count?: number;       // Default 1
}

export interface ConditionalNode {
  type: 'Conditional';
  condition: ASTNode;
  thenExpr: ASTNode;
  elseExpr: ASTNode;
}

export interface ComparisonNode {
  type: 'Comparison';
  op: '=' | '!=' | '<' | '<=' | '>' | '>=';
  left: ASTNode;
  right: ASTNode;
}

export type ASTNode =
  | NumberNode
  | DiceRollNode
  | PropertyRefNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | CardDrawNode
  | ConditionalNode
  | ComparisonNode;

// ─── Property Context ─────────────────────────────────────────────────────────

/**
 * Flat map of property paths → numeric values.
 * Built by context.ts from an EntitySheet + token metadata.
 * 
 * DM context: full access. Player context: own tokens only.
 * Missing keys → formula flagged, requires DM evaluation.
 */
export type PropertyContext = Record<string, number>;

/** Describes who built this context and their role. */
export interface PropertyContextMeta {
  builtBy: string;       // clientId
  role: 'dm' | 'player' | 'host';
  sourceTokenId: string;
  targetTokenId?: string;
  /** True if any properties were inaccessible (formula needs DM routing). */
  isPartial: boolean;
}

// ─── RNG Source ───────────────────────────────────────────────────────────────

export interface DiceRollResult {
  notation: string;   // e.g. "2d6"
  results: number[];  // Individual die values
  kept?: number[];    // After keep/drop applied
  total: number;
}

/** How rolls were made in a formula evaluation. */
export interface RNGSource {
  diceValues: DiceRollResult[];
  cardDraws: Array<{
    deckId: string;
    cardLabel: string;
    cardValue: number;
  }>;
}

// ─── Roll Record ─────────────────────────────────────────────────────────────

/**
 * Audit-trail record broadcast after every formula evaluation.
 * Peers can verify finalResult from contextSnapshot + diceValues.
 */
export interface RollRecord {
  requestId: string;
  formulaText: string;                     // Human-readable formula string
  ast: ASTNode;                            // Full parsed AST for re-evaluation
  contextSnapshot: PropertyContext;        // Property values used during evaluation
  rngSource: RNGSource;                    // All dice + card draws
  finalResult: number;
  evaluatedBy: string;                     // clientId
  timestamp: number;
  /** If true, formula returned null for some property refs (partial context). */
  isPartialEvaluation?: boolean;
}

// ─── Evaluation Request/Response (Ephemeral Network Messages) ─────────────────

export interface FormulaEvalRequest {
  kind: 'formula_eval_request';
  requestId: string;
  formula: string;
  contextSnapshot: PropertyContext;
  contextMeta: PropertyContextMeta;
}

export interface FormulaClaimMessage {
  kind: 'formula_claim';
  requestId: string;
  claimedByClientId: string;
}

export interface FormulaResultMessage {
  kind: 'formula_result';
  requestId: string;
  record: RollRecord;
}

export type FormulaEphemeralMessage =
  | FormulaEvalRequest
  | FormulaClaimMessage
  | FormulaResultMessage;
