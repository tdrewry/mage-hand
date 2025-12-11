import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';

export interface InitiativeEntry {
  tokenId: string;
  initiative: number;
  hasGone?: boolean;
}

interface InitiativeState {
  // Core combat state
  isInCombat: boolean;
  currentTurnIndex: number;
  roundNumber: number;
  initiativeOrder: InitiativeEntry[];
  isTrackerVisible: boolean;
  restrictMovement: boolean;
  
  // Actions
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

// Define the store creator separately for better type inference
const initiativeStoreCreator: StateCreator<InitiativeState> = (set, get) => ({
  isInCombat: false,
  currentTurnIndex: 0,
  roundNumber: 1,
  initiativeOrder: [],
  isTrackerVisible: true,
  restrictMovement: true,
  
  startCombat: () => {
    const order = get().initiativeOrder;
    if (order.length === 0) {
      return;
    }
    
    // Sort by initiative (highest first)
    const sortedOrder = [...order].sort((a, b) => b.initiative - a.initiative);
    
    set({ 
      isInCombat: true,
      initiativeOrder: sortedOrder,
      currentTurnIndex: 0,
      roundNumber: 1,
      isTrackerVisible: true
    });
    // Sync happens automatically via syncPatch middleware
  },
  
  endCombat: () => {
    set({ 
      isInCombat: false,
      currentTurnIndex: 0,
      roundNumber: 1,
      initiativeOrder: [],
      restrictMovement: false
    });
    // Sync happens automatically via syncPatch middleware
  },
  
  setInitiativeOrder: (order) => {
    set({ initiativeOrder: order });
    // Sync happens automatically via syncPatch middleware
  },
  
  addToInitiative: (tokenId, initiative) => {
    set((state) => {
      // Check if token already in initiative
      const existing = state.initiativeOrder.find(e => e.tokenId === tokenId);
      if (existing) {
        // Update existing
        return {
          initiativeOrder: state.initiativeOrder.map(e => 
            e.tokenId === tokenId ? { ...e, initiative } : e
          )
        };
      }
      
      // Add new entry
      return {
        initiativeOrder: [...state.initiativeOrder, { tokenId, initiative, hasGone: false }]
      };
    });
    // Sync happens automatically via syncPatch middleware
  },
  
  removeFromInitiative: (tokenId) => {
    set((state) => ({
      initiativeOrder: state.initiativeOrder.filter(e => e.tokenId !== tokenId)
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  reorderInitiative: (fromIndex, toIndex) => {
    set((state) => {
      const newOrder = [...state.initiativeOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return { initiativeOrder: newOrder };
    });
    // Sync happens automatically via syncPatch middleware
  },
  
  nextTurn: () => {
    set((state) => {
      const nextIndex = state.currentTurnIndex + 1;
      
      // Mark current token as having gone
      const updatedOrder = state.initiativeOrder.map((entry, idx) => 
        idx === state.currentTurnIndex ? { ...entry, hasGone: true } : entry
      );
      
      // Check if we've completed a round
      if (nextIndex >= state.initiativeOrder.length) {
        // Start new round
        return {
          currentTurnIndex: 0,
          roundNumber: state.roundNumber + 1,
          initiativeOrder: updatedOrder.map(e => ({ ...e, hasGone: false }))
        };
      }
      
      return {
        currentTurnIndex: nextIndex,
        initiativeOrder: updatedOrder
      };
    });
    // Sync happens automatically via syncPatch middleware
  },
  
  previousTurn: () => {
    set((state) => {
      const prevIndex = state.currentTurnIndex - 1;
      
      // Going back a turn
      if (prevIndex < 0) {
        // Go to previous round
        if (state.roundNumber > 1) {
          return {
            currentTurnIndex: state.initiativeOrder.length - 1,
            roundNumber: state.roundNumber - 1
          };
        }
        return state; // Can't go before round 1
      }
      
      return {
        currentTurnIndex: prevIndex
      };
    });
    // Sync happens automatically via syncPatch middleware
  },
  
  setCurrentTurn: (index) => {
    set({ currentTurnIndex: index });
    // Sync happens automatically via syncPatch middleware
  },
  
  updateInitiative: (tokenId, newInitiative) => {
    set((state) => ({
      initiativeOrder: state.initiativeOrder.map(e => 
        e.tokenId === tokenId ? { ...e, initiative: newInitiative } : e
      )
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  setTrackerVisible: (visible) => {
    set({ isTrackerVisible: visible });
  },
  
  setRestrictMovement: (restrict) => {
    set({ restrictMovement: restrict });
  },
  
  resetRound: () => {
    set((state) => ({
      currentTurnIndex: 0,
      initiativeOrder: state.initiativeOrder.map(e => ({ ...e, hasGone: false }))
    }));
  }
});

// Wrap with syncPatch middleware - exclude local UI state
const withSyncPatch = syncPatch<InitiativeState>({ 
  channel: 'initiative',
  excludePaths: ['isTrackerVisible', 'restrictMovement'], // Local UI state
  debug: true, // Enable debug logging to diagnose sync issues
})(initiativeStoreCreator);

// Persist options
const persistOptions: PersistOptions<InitiativeState, Partial<InitiativeState>> = {
  name: 'vtt-initiative-storage',
  partialize: (state) => ({
    isInCombat: state.isInCombat,
    currentTurnIndex: state.currentTurnIndex,
    roundNumber: state.roundNumber,
    initiativeOrder: state.initiativeOrder,
    isTrackerVisible: state.isTrackerVisible,
    restrictMovement: state.restrictMovement
  })
};

export const useInitiativeStore = create<InitiativeState>()(
  persist(withSyncPatch as StateCreator<InitiativeState, [], []>, persistOptions)
);
