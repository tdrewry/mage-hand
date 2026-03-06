import { create } from 'zustand';

interface LaunchState {
  launched: boolean;
  setLaunched: (v: boolean) => void;
}

export const useLaunchStore = create<LaunchState>((set) => ({
  launched: false,
  setLaunched: (v) => set({ launched: v }),
}));
