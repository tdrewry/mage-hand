import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import { triggerSound } from '@/lib/soundEngine';

export interface InitiativeEntry {
  tokenId: string;
  initiative: number;
  hasGone?: boolean;
}

interface InitiativeState {
  isInCombat: boolean;
  currentTurnIndex: number;
  roundNumber: number;
  initiativeOrder: InitiativeEntry[];
  isTrackerVisible: boolean;
  restrictMovement: boolean;
  
  startCombat: () => void;
  endCombat: () => void;
  setInitiativeOrder: (order: InitiativeEntry[]) => void;
  addToInitiative: (tokenId: string, initiative: number) => void;
  removeFromInitiative: (tokenId: string) => void;
  reorderInitiative: (fromIndex: number, toIndex: number) => void;
  nextTurn: () => void;
  previousTurn: () => void;
  setCurrentTurn: (index: number) => void;
  updateInitiative: (tokenId: string, newInitiative: number) => void;
  setTrackerVisible: (visible: boolean) => void;
  setRestrictMovement: (restrict: boolean) => void;
  resetRound: () => void;
}

const initiativeStoreCreator: StateCreator<InitiativeState> = (set, get) => ({
  isInCombat: false,
  currentTurnIndex: 0,
  roundNumber: 1,
  initiativeOrder: [],
  isTrackerVisible: true,
  restrictMovement: false,
  
  startCombat: () => {
    const order = get().initiativeOrder;
    if (order.length === 0) return;
    
    const sortedOrder = [...order].sort((a, b) => b.initiative - a.initiative);
    set({ 
      isInCombat: true,
      initiativeOrder: sortedOrder,
      currentTurnIndex: 0,
      roundNumber: 1,
      isTrackerVisible: true
    });
    triggerSound('initiative.combatStart');
  },
  
  endCombat: () => {
    set({ 
      isInCombat: false,
      currentTurnIndex: 0,
      roundNumber: 1,
      initiativeOrder: [],
      restrictMovement: false
    });
    triggerSound('initiative.combatEnd');
  },
  
  setInitiativeOrder: (order) => set({ initiativeOrder: order }),
  
  addToInitiative: (tokenId, initiative) => {
    set((state) => {
      const existing = state.initiativeOrder.find(e => e.tokenId === tokenId);
      if (existing) {
        return {
          initiativeOrder: state.initiativeOrder.map(e => 
            e.tokenId === tokenId ? { ...e, initiative } : e
          )
        };
      }
      return {
        initiativeOrder: [...state.initiativeOrder, { tokenId, initiative, hasGone: false }]
      };
    });
  },
  
  removeFromInitiative: (tokenId) => {
    set((state) => ({
      initiativeOrder: state.initiativeOrder.filter(e => e.tokenId !== tokenId)
    }));
  },
  
  reorderInitiative: (fromIndex, toIndex) => {
    set((state) => {
      const newOrder = [...state.initiativeOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return { initiativeOrder: newOrder };
    });
  },
  
  nextTurn: () => {
    set((state) => {
      const nextIndex = state.currentTurnIndex + 1;
      const updatedOrder = state.initiativeOrder.map((entry, idx) => 
        idx === state.currentTurnIndex ? { ...entry, hasGone: true } : entry
      );
      
      if (nextIndex >= state.initiativeOrder.length) {
        return {
          currentTurnIndex: 0,
          roundNumber: state.roundNumber + 1,
          initiativeOrder: updatedOrder.map(e => ({ ...e, hasGone: false }))
        };
      }
      
      return { currentTurnIndex: nextIndex, initiativeOrder: updatedOrder };
    });
    triggerSound('initiative.turnChange');
  },
  
  previousTurn: () => {
    set((state) => {
      const prevIndex = state.currentTurnIndex - 1;
      if (prevIndex < 0) {
        if (state.roundNumber > 1) {
          return {
            currentTurnIndex: state.initiativeOrder.length - 1,
            roundNumber: state.roundNumber - 1
          };
        }
        return state;
      }
      return { currentTurnIndex: prevIndex };
    });
  },
  
  setCurrentTurn: (index) => set({ currentTurnIndex: index }),
  
  updateInitiative: (tokenId, newInitiative) => {
    set((state) => ({
      initiativeOrder: state.initiativeOrder.map(e => 
        e.tokenId === tokenId ? { ...e, initiative: newInitiative } : e
      )
    }));
  },
  
  setTrackerVisible: (visible) => set({ isTrackerVisible: visible }),
  setRestrictMovement: (restrict) => set({ restrictMovement: restrict }),
  
  resetRound: () => {
    set((state) => ({
      currentTurnIndex: 0,
      initiativeOrder: state.initiativeOrder.map(e => ({ ...e, hasGone: false }))
    }));
  }
});

const withSyncPatch = syncPatch<InitiativeState>({ 
  channel: 'initiative',
  excludePaths: ['isTrackerVisible', 'restrictMovement'],
  debug: true,
})(initiativeStoreCreator);

const persistOptions: PersistOptions<InitiativeState, Partial<InitiativeState>> = {
  name: 'vtt-initiative-storage',
  partialize: (state) => ({
    isInCombat: state.isInCombat,
    currentTurnIndex: state.currentTurnIndex,
    roundNumber: state.roundNumber,
    initiativeOrder: state.initiativeOrder,
    isTrackerVisible: state.isTrackerVisible,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      state.restrictMovement = false;
    }
  }
};

export const useInitiativeStore = create<InitiativeState>()(
  persist(withSyncPatch as StateCreator<InitiativeState, [], []>, persistOptions)
);
