import React from 'react';
import { useUiStateStore } from '@/stores/uiStateStore';
import { cn } from '@/lib/utils';

export const LeftSidebar: React.FC = () => {
  const { isLeftSidebarOpen, isFocusMode } = useUiStateStore();

  // If focus mode is active, override local state to closed
  const isOpen = isLeftSidebarOpen && !isFocusMode;

  return (
    <div
      className={cn(
        "h-full bg-background/95 backdrop-blur-xl border-r border-white/10 flex flex-col transition-all duration-300 ease-in-out relative z-40 pointer-events-auto",
        isOpen ? "w-[320px]" : "w-0 overflow-hidden border-r-0"
      )}
    >
      <div className="flex-1 p-4 min-w-[320px] overflow-y-auto custom-scrollbar">
        {/* Future tools go here */}
        <div className="text-center text-muted-foreground mt-10 text-xs italic">
          Left Sidebar Placeholder
        </div>
      </div>
    </div>
  );
};
