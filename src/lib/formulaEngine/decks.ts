/**
 * Formula Engine — Deck/Card State
 * 
 * Manages card decks usable as RNG sources in action formulas via draw(deck_id).
 * Deck state is an in-memory singleton; persistence and sync planned via Jazz CoValue.
 * 
 * @see Plans/STEP-009-generic-token-character-sheet-schema.md
 */

export interface Card {
  /** Numeric value for algebra (K=13, Q=12, J=11, A=1 by default). */
  value: number;
  label: string;   // e.g. "King of Hearts"
  suit?: string;   // e.g. "Hearts"
  face?: string;   // e.g. "King"
}

export interface Deck {
  id: string;                // e.g. "standard", "tarot_major", custom uuid
  name: string;
  cards: Card[];             // Shuffled order
  drawnCount: number;        // Pointer: cards[drawnCount] is the next card to draw
}

// ─── Standard deck builder ────────────────────────────────────────────────────

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const FACES: Array<{ face: string; value: number }> = [
  { face: 'Ace',   value: 1  }, { face: '2',    value: 2  },
  { face: '3',     value: 3  }, { face: '4',    value: 4  },
  { face: '5',     value: 5  }, { face: '6',    value: 6  },
  { face: '7',     value: 7  }, { face: '8',    value: 8  },
  { face: '9',     value: 9  }, { face: '10',   value: 10 },
  { face: 'Jack',  value: 11 }, { face: 'Queen', value: 12 },
  { face: 'King',  value: 13 },
];

function buildStandardDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const { face, value } of FACES) {
      cards.push({ value, label: `${face} of ${suit}`, suit, face });
    }
  }
  // Jokers
  cards.push({ value: 0, label: 'Red Joker',   face: 'Joker' });
  cards.push({ value: 0, label: 'Black Joker', face: 'Joker' });
  return cards;
}

/** Fisher-Yates shuffle (in-place, returns same array for convenience). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── DeckManager ─────────────────────────────────────────────────────────────

class DeckManager {
  private decks = new Map<string, Deck>();

  /** Get or create a deck by id. */
  getOrCreate(deckId: string): Deck {
    if (!this.decks.has(deckId)) {
      this.decks.set(deckId, this.createDeck(deckId));
    }
    return this.decks.get(deckId)!;
  }

  private createDeck(id: string): Deck {
    switch (id) {
      case 'standard':
        return {
          id,
          name: 'Standard Deck',
          cards: shuffle(buildStandardDeck()),
          drawnCount: 0,
        };
      default:
        // Unknown deck: return a single-card placeholder (auto-reshuffled immediately)
        console.warn(`[formulaEngine/decks] Unknown deck id "${id}" — using empty placeholder`);
        return { id, name: id, cards: [], drawnCount: 0 };
    }
  }

  /**
   * Draw N cards from a deck. Reshuffles automatically if exhausted.
   * Returns the drawn cards.
   */
  draw(deckId: string, count: number = 1): Card[] {
    const deck = this.getOrCreate(deckId);
    const drawn: Card[] = [];

    for (let i = 0; i < count; i++) {
      if (deck.drawnCount >= deck.cards.length) {
        // Reshuffle
        shuffle(deck.cards);
        deck.drawnCount = 0;
      }
      drawn.push(deck.cards[deck.drawnCount++]);
    }

    return drawn;
  }

  /** Reshuffle a deck back to full. */
  reshuffle(deckId: string): void {
    const deck = this.getOrCreate(deckId);
    shuffle(deck.cards);
    deck.drawnCount = 0;
  }

  /** Replace a deck entirely (used for Jazz sync when DM pushes deck state). */
  setDeck(deck: Deck): void {
    this.decks.set(deck.id, { ...deck });
  }

  getDeck(deckId: string): Deck | undefined {
    return this.decks.get(deckId);
  }
}

/** Singleton deck manager instance. */
export const deckManager = new DeckManager();
