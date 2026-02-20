import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rollDice, type DiceRollResult } from '@/lib/diceEngine';

const MAX_HISTORY = 50;

export interface PinnedFormula {
  label: string;
  formula: string;
}

interface DiceState {
  rollHistory: DiceRollResult[];
  currentFormula: string;
  pinnedFormulas: PinnedFormula[];
}

interface DiceActions {
  roll: (formula: string, label?: string) => DiceRollResult;
  clearHistory: () => void;
  setFormula: (formula: string) => void;
  addPinnedFormula: (label: string, formula: string) => void;
  removePinnedFormula: (index: number) => void;
}

type DiceStore = DiceState & DiceActions;

export const useDiceStore = create<DiceStore>()(
  persist(
    (set, get) => ({
      rollHistory: [],
      currentFormula: '',
      pinnedFormulas: [],

      roll: (formula: string, label?: string) => {
        const result = rollDice(formula, label);
        set((state) => ({
          rollHistory: [result, ...state.rollHistory].slice(0, MAX_HISTORY),
        }));
        return result;
      },

      clearHistory: () => set({ rollHistory: [] }),

      setFormula: (formula: string) => set({ currentFormula: formula }),

      addPinnedFormula: (label: string, formula: string) =>
        set((state) => ({
          pinnedFormulas: [...state.pinnedFormulas, { label, formula }],
        })),

      removePinnedFormula: (index: number) =>
        set((state) => ({
          pinnedFormulas: state.pinnedFormulas.filter((_, i) => i !== index),
        })),
    }),
    {
      name: 'vtt-dice-store',
      partialize: (state) => ({ pinnedFormulas: state.pinnedFormulas }),
    }
  )
);
