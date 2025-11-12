import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UiMode = 'dm' | 'play';

interface UiModeState {
  currentMode: UiMode;
  lockedByDm: boolean; // If DM has locked the mode remotely
  
  setMode: (mode: UiMode) => void;
  setModeFromRemote: (mode: UiMode, locked: boolean) => void;
  reset: () => void;
}

export const useUiModeStore = create<UiModeState>()(
  persist(
    (set) => ({
      currentMode: 'dm',
      lockedByDm: false,
      
      setMode: (mode) => {
        console.log('🎮 Setting UI mode locally:', mode);
        set({ currentMode: mode, lockedByDm: false });
      },
      
      setModeFromRemote: (mode, locked) => {
        console.log('🎮 UI Mode changed remotely:', mode, 'locked:', locked);
        set({ currentMode: mode, lockedByDm: locked });
      },
      
      reset: () => {
        set({ currentMode: 'dm', lockedByDm: false });
      },
    }),
    {
      name: 'vtt-ui-mode-storage',
    }
  )
);
