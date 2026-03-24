import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActiveEffect } from '@/lib/rules-engine/effectTypes';

interface ActiveEffectState {
  effects: ActiveEffect[];
  
  addEffect: (effect: Omit<ActiveEffect, 'id'>) => ActiveEffect;
  updateEffect: (id: string, updates: Partial<ActiveEffect>) => void;
  deleteEffect: (id: string) => void;
  
  getEffect: (id: string) => ActiveEffect | undefined;
}

export const useActiveEffectStore = create<ActiveEffectState>()(
  persist(
    (set, get) => ({
      effects: [],
      
      addEffect: (draft) => {
        const effect: ActiveEffect = {
          ...draft,
          id: `ae-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        };
        set((s) => ({ effects: [...s.effects, effect] }));
        
        // Sync to network
        import("@/lib/net").then(({ emitLocalOp, opBridge }) => {
          if (opBridge.isApplyingRemote) return;
          emitLocalOp({ kind: 'activeEffect.add', data: { effect } });
        }).catch(() => {});
        
        return effect;
      },
      
      updateEffect: (id, updates) => {
        set((s) => {
          const newEffects = s.effects.map(e => e.id === id ? { ...e, ...updates } : e);
          return { effects: newEffects };
        });
        
        // Sync to network
        import("@/lib/net").then(({ emitLocalOp, opBridge }) => {
          if (opBridge.isApplyingRemote) return;
          const updated = get().effects.find(e => e.id === id);
          if (updated) {
            emitLocalOp({ kind: 'activeEffect.update', data: { effect: updated } });
          }
        }).catch(() => {});
      },
      
      deleteEffect: (id) => {
        set((s) => ({ effects: s.effects.filter(e => e.id !== id) }));
        
        // Sync to network
        import("@/lib/net").then(({ emitLocalOp, opBridge }) => {
          if (opBridge.isApplyingRemote) return;
          emitLocalOp({ kind: 'activeEffect.delete', data: { id } });
        }).catch(() => {});
      },
      
      getEffect: (id) => {
        return get().effects.find(e => e.id === id);
      }
    }),
    {
      name: 'vtt-active-effect-store'
    }
  )
);
