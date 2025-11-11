import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';

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

export const useInitiativeStore = create<InitiativeState>()(
  persist(
    (set, get) => ({
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
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('start_combat', { 
            initiativeOrder: sortedOrder,
            currentTurnIndex: 0,
            roundNumber: 1 
          });
        }
      },
      
      endCombat: () => {
        set({ 
          isInCombat: false,
          currentTurnIndex: 0,
          roundNumber: 1,
          initiativeOrder: [],
          restrictMovement: false
        });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('end_combat');
        }
      },
      
      setInitiativeOrder: (order) => {
        set({ initiativeOrder: order });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('set_order', { initiativeOrder: order });
        }
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
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('add_entry', { tokenId, initiative });
        }
      },
      
      removeFromInitiative: (tokenId) => {
        set((state) => ({
          initiativeOrder: state.initiativeOrder.filter(e => e.tokenId !== tokenId)
        }));
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('remove_entry', { tokenId });
        }
      },
      
      reorderInitiative: (fromIndex, toIndex) => {
        let newOrder: InitiativeEntry[] = [];
        set((state) => {
          newOrder = [...state.initiativeOrder];
          const [removed] = newOrder.splice(fromIndex, 1);
          newOrder.splice(toIndex, 0, removed);
          return { initiativeOrder: newOrder };
        });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('reorder', { initiativeOrder: newOrder });
        }
      },
      
      nextTurn: () => {
        let syncData: any = {};
        set((state) => {
          const nextIndex = state.currentTurnIndex + 1;
          
          // Mark current token as having gone
          const updatedOrder = state.initiativeOrder.map((entry, idx) => 
            idx === state.currentTurnIndex ? { ...entry, hasGone: true } : entry
          );
          
          // Check if we've completed a round
          if (nextIndex >= state.initiativeOrder.length) {
            // Start new round
            syncData = {
              currentTurnIndex: 0,
              roundNumber: state.roundNumber + 1,
              initiativeOrder: updatedOrder.map(e => ({ ...e, hasGone: false }))
            };
            return syncData;
          }
          
          syncData = {
            currentTurnIndex: nextIndex,
            initiativeOrder: updatedOrder
          };
          return syncData;
        });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('next_turn', syncData);
        }
      },
      
      previousTurn: () => {
        let syncData: any = {};
        set((state) => {
          const prevIndex = state.currentTurnIndex - 1;
          
          // Going back a turn
          if (prevIndex < 0) {
            // Go to previous round
            if (state.roundNumber > 1) {
              syncData = {
                currentTurnIndex: state.initiativeOrder.length - 1,
                roundNumber: state.roundNumber - 1
              };
              return syncData;
            }
            return state; // Can't go before round 1
          }
          
          syncData = {
            currentTurnIndex: prevIndex
          };
          return syncData;
        });
        
        // Sync to multiplayer
        if (syncManager.isConnected() && Object.keys(syncData).length > 0) {
          syncManager.syncInitiative('previous_turn', syncData);
        }
      },
      
      setCurrentTurn: (index) => {
        set({ currentTurnIndex: index });
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('set_turn', { currentTurnIndex: index });
        }
      },
      
      updateInitiative: (tokenId, newInitiative) => {
        set((state) => ({
          initiativeOrder: state.initiativeOrder.map(e => 
            e.tokenId === tokenId ? { ...e, initiative: newInitiative } : e
          )
        }));
        
        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncInitiative('update_initiative', { tokenId, initiative: newInitiative });
        }
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
    }),
    {
      name: 'vtt-initiative-storage',
      partialize: (state) => ({
        isInCombat: state.isInCombat,
        currentTurnIndex: state.currentTurnIndex,
        roundNumber: state.roundNumber,
        initiativeOrder: state.initiativeOrder,
        isTrackerVisible: state.isTrackerVisible,
        restrictMovement: state.restrictMovement
      })
    }
  )
);
