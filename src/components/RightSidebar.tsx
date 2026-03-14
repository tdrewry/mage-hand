import React from 'react';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { THEME } from '@/lib/theme';

export const RightSidebar: React.FC = () => {
  const { isRightSidebarOpen, isFocusMode } = useUiStateStore();

  const isOpen = isRightSidebarOpen && !isFocusMode;

  return (
    <div
      className={cn(
        "h-full bg-background/95 backdrop-blur-xl border-l border-white/10 flex flex-col transition-all duration-300 ease-in-out relative z-40 pointer-events-auto",
        !isOpen && "overflow-hidden border-l-0"
      )}
      style={{ width: isOpen ? THEME.sidebarWidth : 0 }}
    >
      <div id="right-sidebar-content" className="flex-1 p-4 flex flex-col min-h-0 gap-4" style={{ minWidth: THEME.sidebarWidth }}>
      </div>
    </div>
  );
};
