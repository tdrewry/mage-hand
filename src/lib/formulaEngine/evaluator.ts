/**
 * Formula Engine — Secure AST Evaluator
 * 
 * Pure AST walker with zero eval() / Function() calls.
 * Works fully offline. Handles dice rolls, card draws, property refs,
 * math operations, builtins, and conditionals.
 * 
 * @see Plans/STEP-009-generic-token-character-sheet-schema.md
 */

import type {
  ASTNode, PropertyContext, RNGSource, RollRecord, DiceRollResult,
} from './types';
import { deckManager } from './decks';

// ─── Evaluation context ───────────────────────────────────────────────────────

export interface EvalContext {
  properties: PropertyContext;
  /** Accumulator for all dice rolls and card draws made during this evaluation. */
  rngSource: RNGSource;
}

function createEvalContext(properties: PropertyContext): EvalContext {
  return {
    properties,
    rngSource: { diceValues: [], cardDraws: [] },
  };
}

// ─── Dice rolling ─────────────────────────────────────────────────────────────

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie(sides));
  }
  return results;
}

// ─── AST Evaluator ────────────────────────────────────────────────────────────

/**
 * Evaluate an AST node and return its numeric value.
 * Returns null if a property reference is inaccessible (partial context).
 */
export function evaluateNode(node: ASTNode, ctx: EvalContext): number | null {
  switch (node.type) {
    case 'Number':
      return node.value;

    case 'DiceRoll': {
      const results = rollDice(node.count, node.sides);
      const notation = `${node.count}d${node.sides}`;

      let kept = [...results];

      if (node.keep) {
        const sorted = [...results].sort((a, b) => b - a);
        if (node.keep.mode === 'high') {
          kept = sorted.slice(0, node.keep.count);
        } else {
          kept = sorted.slice(node.keep.count);
        }
      } else if (node.drop) {
        const sorted = [...results].sort((a, b) => b - a);
        if (node.drop.mode === 'high') {
          kept = sorted.slice(node.drop.count);
        } else {
          kept = sorted.slice(0, results.length - node.drop.count);
        }
      }

      const total = kept.reduce((s, v) => s + v, 0);
      const rollResult: DiceRollResult = {
        notation,
        results,
        kept: (node.keep || node.drop) ? kept : undefined,
        total,
      };
      ctx.rngSource.diceValues.push(rollResult);
      return total;
    }

    case 'PropertyRef': {
      const val = ctx.properties[node.path];
      if (val === undefined) return null; // inaccessible property
      return val;
    }

    case 'BinaryOp': {
      const left = evaluateNode(node.left, ctx);
      const right = evaluateNode(node.right, ctx);
      if (left === null || right === null) return null;
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '%': return right !== 0 ? left % right : 0;
        case '^': return Math.pow(left, right);
      }
      break;
    }

    case 'UnaryOp': {
      const val = evaluateNode(node.operand, ctx);
      if (val === null) return null;
      return -val;
    }

    case 'FunctionCall': {
      const args = node.args.map(a => evaluateNode(a, ctx));
      if (args.some(a => a === null)) return null;
      const nums = args as number[];
      switch (node.name) {
        case 'min':   return Math.min(...nums);
        case 'max':   return Math.max(...nums);
        case 'floor': return Math.floor(nums[0]);
        case 'ceil':  return Math.ceil(nums[0]);
        case 'abs':   return Math.abs(nums[0]);
        case 'round': return Math.round(nums[0]);
      }
      break;
    }

    case 'CardDraw': {
      const count = node.count ?? 1;
      const cards = deckManager.draw(node.deckId, count);
      cards.forEach(card => {
        ctx.rngSource.cardDraws.push({
          deckId: node.deckId,
          cardLabel: card.label,
          cardValue: card.value,
        });
      });
      // Return sum of card values (for a single draw this is just the card value)
      return cards.reduce((s, c) => s + c.value, 0);
    }

    case 'Conditional': {
      const cond = evaluateNode(node.condition, ctx);
      if (cond === null) return null;
      return cond !== 0
        ? evaluateNode(node.thenExpr, ctx)
        : evaluateNode(node.elseExpr, ctx);
    }

    case 'Comparison': {
      const left = evaluateNode(node.left, ctx);
      const right = evaluateNode(node.right, ctx);
      if (left === null || right === null) return null;
      switch (node.op) {
        case '=':  return left === right ? 1 : 0;
        case '!=': return left !== right ? 1 : 0;
        case '<':  return left < right ? 1 : 0;
        case '<=': return left <= right ? 1 : 0;
        case '>':  return left > right ? 1 : 0;
        case '>=': return left >= right ? 1 : 0;
      }
      break;
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface EvaluationResult {
  value: number | null;
  rngSource: RNGSource;
  /** True if any property was missing from context. */
  isPartial: boolean;
}

/**
 * Evaluate a parsed formula AST against a property context.
 * Returns null value if any property reference was inaccessible.
 */
export function evaluateFormula(
  ast: ASTNode,
  properties: PropertyContext,
): EvaluationResult {
  const ctx = createEvalContext(properties);
  const value = evaluateNode(ast, ctx);
  const isPartial = value === null;

  return {
    value,
    rngSource: ctx.rngSource,
    isPartial,
  };
}

/**
 * Build a RollRecord from an evaluation result.
 * Called by the evaluating client before broadcasting the result.
 */
export function buildRollRecord(params: {
  requestId: string;
  formulaText: string;
  ast: ASTNode;
  contextSnapshot: PropertyContext;
  evalResult: EvaluationResult;
  clientId: string;
}): RollRecord {
  return {
    requestId: params.requestId,
    formulaText: params.formulaText,
    ast: params.ast,
    contextSnapshot: params.contextSnapshot,
    rngSource: params.evalResult.rngSource,
    finalResult: params.evalResult.value ?? 0,
    evaluatedBy: params.clientId,
    timestamp: Date.now(),
    isPartialEvaluation: params.evalResult.isPartial,
  };
}
