import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UiMode = 'dm' | 'play';

// DM visibility mode for fog-hidden elements
export type DmFogVisibility = 'semi-transparent' | 'hidden' | 'full';

interface UiModeState {
  currentMode: UiMode;
  lockedByDm: boolean; // If DM has locked the mode remotely
  animationsPaused: boolean; // Whether illumination animations are paused
  dmFogVisibility: DmFogVisibility; // How DM sees fog-hidden elements
  
  /**
   * Sets the UI mode locally.
   * @param mode The new UI mode.
   */
  setMode: (mode: UiMode) => void;

  /**
   * Sets the UI mode from a remote source, optionally locking it.
   * @param mode The new UI mode.
   * @param locked Whether the mode should be locked by the DM.
   */
  setModeFromRemote: (mode: UiMode, locked: boolean) => void;

  /**
   * Toggles whether animations are paused.
   */
  toggleAnimationsPaused: () => void;

  /**
   * Sets whether animations are paused.
   * @param paused True to pause animations, false to resume.
   */
  setAnimationsPaused: (paused: boolean) => void;

  /**
   * Sets how the DM sees fog-hidden elements.
   * @param visibility The DM fog visibility setting.
   */
  setDmFogVisibility: (visibility: DmFogVisibility) => void;

  /**
   * Resets the UI mode state to default values.
   */
  reset: () => void;
}

export const useUiModeStore = create<UiModeState>()(
  persist(
    (set) => ({
      currentMode: 'dm',
      lockedByDm: false,
      animationsPaused: false,
      dmFogVisibility: 'semi-transparent',
      
      setMode: (mode) => {
        console.log('🎮 Setting UI mode locally:', mode);
        set({ currentMode: mode, lockedByDm: false });
      },
      
      setModeFromRemote: (mode, locked) => {
        console.log('🎮 UI Mode changed remotely:', mode, 'locked:', locked);
        set({ currentMode: mode, lockedByDm: locked });
      },
      
      toggleAnimationsPaused: () => {
        set((state) => ({ animationsPaused: !state.animationsPaused }));
      },
      
      setAnimationsPaused: (paused) => {
        set({ animationsPaused: paused });
      },
      
      setDmFogVisibility: (visibility) => {
        set({ dmFogVisibility: visibility });
      },
      
      reset: () => {
        set({ currentMode: 'dm', lockedByDm: false, animationsPaused: false, dmFogVisibility: 'semi-transparent' });
      },
    }),
    {
      name: 'vtt-ui-mode-storage',
    }
  )
);
