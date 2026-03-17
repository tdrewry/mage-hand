import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  // Focus Mode collapses all sidebars to maximize the canvas
  isFocusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  toggleFocusMode: () => void;

  // Individual sidebar visibility states
  isLeftSidebarOpen: boolean;
  setLeftSidebarOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;

  isRightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  toggleRightSidebar: () => void;

  isTopNavbarOpen: boolean;
  setTopNavbarOpen: (open: boolean) => void;
  toggleTopNavbar: () => void;

  isProfilerVisible: boolean;
  setProfilerVisible: (visible: boolean) => void;
  toggleProfiler: () => void;
}

export const useUiStateStore = create<UiState>()(
  persist(
    (set) => ({
      isFocusMode: false,
      setFocusMode: (focus) => set({ isFocusMode: focus }),
      toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

      isLeftSidebarOpen: true,
      setLeftSidebarOpen: (open) => set({ isLeftSidebarOpen: open }),
      toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),

      isRightSidebarOpen: true,
      setRightSidebarOpen: (open) => set({ isRightSidebarOpen: open }),
      toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),

      isTopNavbarOpen: true,
      setTopNavbarOpen: (open) => set({ isTopNavbarOpen: open }),
      toggleTopNavbar: () => set((state) => ({ isTopNavbarOpen: !state.isTopNavbarOpen })),

      isProfilerVisible: false,
      setProfilerVisible: (visible) => set({ isProfilerVisible: visible }),
      toggleProfiler: () => set((state) => ({ isProfilerVisible: !state.isProfilerVisible })),
    }),
    {
      name: 'vtt-ui-state',
    }
  )
);
