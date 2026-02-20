

# Dice Rolling System

## Overview
A complete dice notation parser, roller engine, and interactive UI card for rolling dice in the VTT. The system will parse standard RPG dice notation (e.g. `2d6+4`, `1d20+5`, `4d6kh3`), generate randomized results, and display them in a draggable card with roll history and visual flair.

## Architecture

### 1. Dice Engine Library (`src/lib/diceEngine.ts`)
A pure-logic module with no UI dependencies that handles:

- **Notation Parsing**: Parse standard RPG dice notation into a structured AST
  - Basic: `NdX` (e.g. `2d6`, `1d20`, `1d100`)
  - Modifiers: `+N`, `-N` (e.g. `1d20+5`)
  - Multiple groups: `2d6+1d4+3`
  - Keep highest/lowest: `4d6kh3` (keep highest 3), `2d20kl1` (keep lowest 1 -- disadvantage)
  - Advantage/Disadvantage shorthand: `1d20adv`, `1d20dis`
  - Standard polyhedral set: d4, d6, d8, d10, d12, d20, d100

- **Types exported**:
  ```
  DieType: 4 | 6 | 8 | 10 | 12 | 20 | 100
  
  DiceGroup: {
    count: number
    sides: DieType | number
    keepHighest?: number
    keepLowest?: number
    results: number[]       // individual die results
    keptResults: number[]   // after keep filter
  }

  DiceRollResult: {
    id: string
    formula: string         // original input string
    groups: DiceGroup[]
    modifier: number        // flat +/- modifier
    total: number
    timestamp: number
    label?: string          // optional label like "Attack Roll"
    rolledBy?: string       // player name for multiplayer
  }
  ```

- **Functions**:
  - `parseFormula(formula: string): ParsedFormula` -- validates and parses notation
  - `rollDice(formula: string, label?: string): DiceRollResult` -- parse + roll in one call
  - `rollSingle(sides: number): number` -- single die roll (Math.random based)

### 2. Dice Store (`src/stores/diceStore.ts`)
A Zustand store for dice state:

- **State**:
  - `rollHistory: DiceRollResult[]` -- recent rolls (capped at 50)
  - `currentFormula: string` -- what's typed in the input
  - `pinnedFormulas: { label: string, formula: string }[]` -- saved quick-roll formulas

- **Actions**:
  - `roll(formula: string, label?: string): DiceRollResult` -- execute a roll and add to history
  - `clearHistory()` -- clear roll log
  - `setFormula(formula: string)` -- update current input
  - `addPinnedFormula(label, formula)` / `removePinnedFormula(index)`

- Wrapped with `syncPatch` middleware (channel: `'dice'`) so rolls are shared across multiplayer sessions
- Persisted with zustand/persist for pinned formulas only

### 3. Dice Card UI (`src/components/cards/DiceCard.tsx`)
A new card type (`CardType.DICE_BOX`) rendered via the BaseCard system:

- **Input bar**: Text input for dice formula with a "Roll" button and validation feedback
- **Quick-roll buttons**: Row of common dice (d4, d6, d8, d10, d12, d20, d100) as small polyhedral-icon buttons -- single click rolls 1dX
- **Pinned formulas**: Saved formulas displayed as clickable chips (e.g. "Longsword: 1d8+4")
- **Result display**: The most recent roll shown prominently with:
  - Formula echo (e.g. "2d6 + 4")
  - Individual die results (with kept/dropped styling)
  - Total with modifier breakdown
  - Subtle animation on new roll (scale-in or fade)
- **Roll history**: Scrollable list of past rolls with timestamp, formula, and total
- **Card config**: Default size ~350x500, resizable, closable, not visible by default

### 4. Card Registration
- Add `DICE_BOX = 'dice_box'` to the `CardType` enum in `src/types/cardTypes.ts`
- Add default config in `src/stores/cardStore.ts`
- Wire up the card in `src/components/CardManager.tsx`
- Add a menu entry to open the Dice Box from the Menu card

### 5. Version Bump
- Increment `APP_VERSION` to `0.4.34` in `src/lib/version.ts`

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/diceEngine.ts` | Create -- parser + roller logic |
| `src/stores/diceStore.ts` | Create -- state management |
| `src/components/cards/DiceCard.tsx` | Create -- UI card |
| `src/types/cardTypes.ts` | Edit -- add DICE_BOX enum |
| `src/stores/cardStore.ts` | Edit -- add default card config |
| `src/components/CardManager.tsx` | Edit -- render DiceCard |
| `src/components/cards/MenuCard.tsx` | Edit -- add Dice Box menu item |
| `src/lib/version.ts` | Edit -- bump to 0.4.34 |

## Future Expansion (not in this phase)
- Animated 3D dice rolling visuals (BG3-style spinning polyhedrals)
- Dice roll sharing with toast notifications for other players
- Inline dice rolling from stat blocks (clickable damage/attack formulas)
- Roll modifiers from character abilities auto-applied
- Secret/GM-only rolls

