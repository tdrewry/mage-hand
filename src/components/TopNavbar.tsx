import React from 'react';
import { useUiStateStore } from '@/stores/uiStateStore';
import { cn } from '@/lib/utils';
import { Focus, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export const TopNavbar: React.FC = () => {
  const { 
    isTopNavbarOpen, 
    isFocusMode, 
    toggleFocusMode,
    isLeftSidebarOpen,
    toggleLeftSidebar,
    isRightSidebarOpen,
    toggleRightSidebar
  } = useUiStateStore();

  const isOpen = isTopNavbarOpen && !isFocusMode;

  // We leave a tiny floating dock handle if focus mode is active so the user can restore UI
  if (isFocusMode) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full shadow-2xl bg-black/50 backdrop-blur-xl border border-white/20 hover:bg-black/70 hover:scale-105 transition-all w-12 h-12"
                onClick={toggleFocusMode}
            >
                <Maximize className="h-5 w-5 text-white" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="mt-2 bg-black/80 backdrop-blur border-white/10">
            <p>Exit Focus Mode</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full bg-background/95 backdrop-blur-xl border-b border-white/10 flex items-center relative z-50 pointer-events-auto transition-all duration-300 shadow-sm",
      isOpen ? "h-14" : "h-0 overflow-hidden border-b-0"
    )}>
      
      {/* Left Segment: World Builder Header / Toggle */}
      <div className={cn(
        "flex flex-shrink-0 items-center overflow-hidden transition-all duration-300 ease-in-out border-r border-white/10 h-full",
        isLeftSidebarOpen ? "w-[320px] justify-between px-4" : "w-14 justify-center"
      )}>
        {isLeftSidebarOpen ? (
          <>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground whitespace-nowrap">World Builder</h2>
            <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="h-8 w-8 hover:bg-white/5 shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="h-10 w-10 hover:bg-white/10">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Center Segment: Global Nav */}
      <div className="flex-1 flex items-center justify-between px-6 overflow-hidden h-full">
        {/* Left side: Brand or Global Tool */}
        <div className="flex items-center gap-4">
          <span className="font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 truncate">
              Mage Hand
          </span>
        </div>

        {/* Center: Future map selector or core global toggles */}
        <div className="flex flex-1 items-center justify-center pointer-events-none">
            {/* Top Center Placeholder */}
        </div>

        {/* Right side: Global settings and views */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFocusMode}
                className="hover:bg-white/10 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              >
                <Focus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="bg-background/90 backdrop-blur border-white/10">
              <p>Focus Mode (Hide UI)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Right Segment: Campaign Log Header / Toggle */}
      <div className={cn(
        "flex flex-shrink-0 items-center overflow-hidden transition-all duration-300 ease-in-out border-l border-white/10 h-full",
        isRightSidebarOpen ? "w-[320px] justify-between px-4" : "w-14 justify-center"
      )}>
        {isRightSidebarOpen ? (
          <>
            <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="h-8 w-8 hover:bg-white/5 shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground whitespace-nowrap">Campaign Log</h2>
          </>
        ) : (
          <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="h-10 w-10 hover:bg-white/10">
             <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>

    </div>
  );
};
