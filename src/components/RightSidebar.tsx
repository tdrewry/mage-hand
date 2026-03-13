import React from 'react';
import { useUiStateStore } from '@/stores/uiStateStore';
import { cn } from '@/lib/utils';

export const RightSidebar: React.FC = () => {
  const { isRightSidebarOpen, isFocusMode } = useUiStateStore();

  const isOpen = isRightSidebarOpen && !isFocusMode;

  return (
    <div
      className={cn(
        "h-full bg-background/95 backdrop-blur-xl border-l border-white/10 flex flex-col transition-all duration-300 ease-in-out relative z-40 pointer-events-auto",
        isOpen ? "w-[320px]" : "w-0 overflow-hidden border-l-0"
      )}
    >
      <div id="right-sidebar-content" className="flex-1 p-4 min-w-[320px] overflow-y-auto custom-scrollbar">
      </div>
    </div>
  );
};
