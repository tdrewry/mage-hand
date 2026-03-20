/**
 * Formula Engine — Parser
 * 
 * A simple recursive-descent parser for the Mage-Hand formula DSL.
 * 
 * Grammar:
 *   expr     → term (('+' | '-') term)*
 *   term     → factor (('*' | '/' | '%') factor)*
 *   factor   → base ('^' factor)?           (right-assoc)
 *   base     → '-' base | '(' expr ')' | NUM | DICE | propRef | funcCall | cardDraw | conditional
 *   DICE     → [N] 'd' X (('kh'|'kl'|'dh'|'dl') M)?
 *   propRef  → '{' IDENT ('.' IDENT)* '}'
 *   funcCall → IDENT '(' exprList? ')'
 *   cardDraw → 'draw' '(' IDENT (',' expr)? ')'
 *   conditional → 'if' '(' compExpr ',' expr ',' expr ')'
 *   compExpr → expr (('='|'!='|'<'|'<='|'>'|'>=') expr)?
 * 
 * @see Plans/STEP-009-generic-token-character-sheet-schema.md
 */

import type { ASTNode } from './types';

// ─── Lexer ────────────────────────────────────────────────────────────────────

type TokType =
  | 'NUM' | 'IDENT' | 'DICE'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'CARET'
  | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE'
  | 'COMMA' | 'DOT'
  | 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE'
  | 'EOF';

interface Token {
  type: TokType;
  value: string;
}

const DICE_RE = /^(\d*)d(\d+)(?:(kh|kl|dh|dl)(\d+))?/;
const NUM_RE  = /^\d+(\.\d+)?/;
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    // Skip whitespace
    if (/\s/.test(src[i])) { i++; continue; }

    // Dice literal (must come before plain number check)
    const diceMatch = src.slice(i).match(DICE_RE);
    if (diceMatch) {
      tokens.push({ type: 'DICE', value: diceMatch[0] });
      i += diceMatch[0].length;
      continue;
    }

    // Numbers
    const numMatch = src.slice(i).match(NUM_RE);
    if (numMatch) {
      tokens.push({ type: 'NUM', value: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    // Identifiers / keywords
    const identMatch = src.slice(i).match(IDENT_RE);
    if (identMatch) {
      tokens.push({ type: 'IDENT', value: identMatch[0] });
      i += identMatch[0].length;
      continue;
    }

    // Two-char operators
    const two = src.slice(i, i + 2);
    if (two === '!=') { tokens.push({ type: 'NEQ', value: two }); i += 2; continue; }
    if (two === '<=') { tokens.push({ type: 'LTE', value: two }); i += 2; continue; }
    if (two === '>=') { tokens.push({ type: 'GTE', value: two }); i += 2; continue; }

    // Single-char operators
    const ch = src[i];
    const single: Partial<Record<string, TokType>> = {
      '+': 'PLUS', '-': 'MINUS', '*': 'STAR', '/': 'SLASH',
      '%': 'PERCENT', '^': 'CARET', '(': 'LPAREN', ')': 'RPAREN',
      '{': 'LBRACE', '}': 'RBRACE', ',': 'COMMA', '.': 'DOT',
      '=': 'EQ', '<': 'LT', '>': 'GT',
    };
    if (single[ch]) {
      tokens.push({ type: single[ch]!, value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i} in formula`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokType): Token {
    const tok = this.advance();
    if (tok.type !== type) throw new Error(`Expected ${type} but got ${tok.type} ("${tok.value}")`);
    return tok;
  }

  parse(): ASTNode {
    const node = this.parseComparison();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token "${this.peek().value}" after expression`);
    }
    return node;
  }

  private parseComparison(): ASTNode {
    const left = this.parseExpr();
    const compOps: Partial<Record<TokType, string>> = {
      EQ: '=', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=',
    };
    const op = compOps[this.peek().type];
    if (op) {
      this.advance();
      const right = this.parseExpr();
      return { type: 'Comparison', op: op as any, left, right };
    }
    return left;
  }

  private parseExpr(): ASTNode {
    let left = this.parseTerm();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.advance().type === 'PLUS' ? '+' : '-';
      const right = this.parseTerm();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseTerm(): ASTNode {
    let left = this.parseFactor();
    while (['STAR', 'SLASH', 'PERCENT'].includes(this.peek().type)) {
      const opMap: Record<string, string> = { STAR: '*', SLASH: '/', PERCENT: '%' };
      const op = opMap[this.advance().type];
      const right = this.parseFactor();
      left = { type: 'BinaryOp', op: op as any, left, right };
    }
    return left;
  }

  private parseFactor(): ASTNode {
    const base = this.parseUnary();
    if (this.peek().type === 'CARET') {
      this.advance();
      const exp = this.parseFactor(); // right-associative
      return { type: 'BinaryOp', op: '^', left: base, right: exp };
    }
    return base;
  }

  private parseUnary(): ASTNode {
    if (this.peek().type === 'MINUS') {
      this.advance();
      return { type: 'UnaryOp', op: '-', operand: this.parseUnary() };
    }
    return this.parseBase();
  }

  private parseBase(): ASTNode {
    const tok = this.peek();

    // Grouped expression
    if (tok.type === 'LPAREN') {
      this.advance();
      const inner = this.parseComparison();
      this.expect('RPAREN');
      return inner;
    }

    // Number literal
    if (tok.type === 'NUM') {
      this.advance();
      return { type: 'Number', value: parseFloat(tok.value) };
    }

    // Dice literal (e.g. "2d6kh1")
    if (tok.type === 'DICE') {
      this.advance();
      const m = tok.value.match(DICE_RE)!;
      const count = m[1] ? parseInt(m[1]) : 1;
      const sides = parseInt(m[2]);
      const modMode = m[3] as string | undefined;
      const modCount = m[4] ? parseInt(m[4]) : undefined;

      const node: ASTNode = {
        type: 'DiceRoll',
        count,
        sides,
        keep: modMode === 'kh' ? { mode: 'high', count: modCount! }
            : modMode === 'kl' ? { mode: 'low',  count: modCount! }
            : undefined,
        drop: modMode === 'dh' ? { mode: 'high', count: modCount! }
            : modMode === 'dl' ? { mode: 'low',  count: modCount! }
            : undefined,
      };
      return node;
    }

    // Property ref {path.to.value}
    if (tok.type === 'LBRACE') {
      this.advance();
      let path = this.expect('IDENT').value;
      while (this.peek().type === 'DOT') {
        this.advance();
        path += '.' + this.expect('IDENT').value;
      }
      this.expect('RBRACE');
      return { type: 'PropertyRef', path };
    }

    // Named functions: if, draw, min, max, floor, ceil, abs, round
    if (tok.type === 'IDENT') {
      const name = tok.value;
      this.advance();

      if (this.peek().type !== 'LPAREN') {
        throw new Error(`Expected '(' after identifier "${name}"`);
      }
      this.expect('LPAREN');

      if (name === 'if') {
        const cond = this.parseComparison();
        this.expect('COMMA');
        const thenExpr = this.parseComparison();
        this.expect('COMMA');
        const elseExpr = this.parseComparison();
        this.expect('RPAREN');
        return { type: 'Conditional', condition: cond, thenExpr, elseExpr };
      }

      if (name === 'draw') {
        const deckId = this.expect('IDENT').value;
        let count: ASTNode | undefined;
        if (this.peek().type === 'COMMA') {
          this.advance();
          count = this.parseExpr();
        }
        this.expect('RPAREN');
        // For now, count must be a literal number (dynamic count is complex to support)
        const staticCount = count?.type === 'Number' ? count.value : 1;
        return { type: 'CardDraw', deckId, count: staticCount };
      }

      const builtins = new Set(['min', 'max', 'floor', 'ceil', 'abs', 'round']);
      if (builtins.has(name)) {
        const args: ASTNode[] = [this.parseComparison()];
        while (this.peek().type === 'COMMA') {
          this.advance();
          args.push(this.parseComparison());
        }
        this.expect('RPAREN');
        return { type: 'FunctionCall', name: name as any, args };
      }

      throw new Error(`Unknown function "${name}"`);
    }

    throw new Error(`Unexpected token "${tok.value}" (type: ${tok.type})`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse a formula string into an AST. Throws on syntax errors. */
export function parseFormula(formula: string): ASTNode {
  const tokens = tokenize(formula.trim());
  return new Parser(tokens).parse();
}
