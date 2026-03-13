import React from 'react';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useCardStore } from '@/stores/cardStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { CardType } from '@/types/cardTypes';
import { cn } from '@/lib/utils';
import { 
  Focus, Maximize, ChevronLeft, ChevronRight, Settings, FolderOpen, Monitor, 
  Network, HardDrive, Volume2, Home, Save, Download, Play, Castle, UserCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { SessionManager } from '@/components/SessionManager';
import { StorageManagerModal } from '@/components/StorageManagerModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from 'react';
import { toast } from 'sonner';

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

  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [storageManagerOpen, setStorageManagerOpen] = useState(false);

  const { currentMode, setMode, lockedByDm } = useUiModeStore();
  const { renderingMode, setRenderingMode } = useDungeonStore();
  const setLaunched = useLaunchStore((s) => s.setLaunched);
  const { isConnected, currentSession } = useMultiplayerStore();
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);

  const projectManagerCard = cards.find((c) => c.type === CardType.PROJECT_MANAGER);
  const soundSettingsCard = cards.find((c) => c.type === CardType.SOUND_SETTINGS);

  const handleOpenProjectManager = () => {
    if (projectManagerCard) {
      setVisibility(projectManagerCard.id, true);
    } else {
      registerCard({
        type: CardType.PROJECT_MANAGER,
        title: 'Project Manager',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
        defaultSize: { width: 600, height: 700 },
        minSize: { width: 500, height: 600 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  const handleOpenSoundSettings = () => {
    if (soundSettingsCard) {
      setVisibility(soundSettingsCard.id, true);
    } else {
      registerCard({
        type: CardType.SOUND_SETTINGS,
        title: 'Sound Settings',
        defaultPosition: { x: window.innerWidth / 2 - 190, y: 80 },
        defaultSize: { width: 380, height: 600 },
        minSize: { width: 320, height: 400 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

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
        <div className="flex items-center gap-2">
          
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                    <Monitor className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-background/90 backdrop-blur border-white/10">Mode settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>UI Mode</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setMode('dm')} disabled={lockedByDm}>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>DM View</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMode('play')} disabled={lockedByDm}>
                <Play className="mr-2 h-4 w-4" />
                <span>Player View</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Rendering Pipeline</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { setRenderingMode('edit'); toast.success('Switched to Edit mode'); }}>
                <Castle className="mr-2 h-4 w-4" />
                <span>Edit Mode</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRenderingMode('play'); toast.success('Switched to Play mode'); }}>
                <Play className="mr-2 h-4 w-4" />
                <span>Play Mode</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-background/90 backdrop-blur border-white/10">Project files</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleOpenProjectManager}>
                <Save className="mr-2 h-4 w-4" />
                <span>Save Session</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenProjectManager}>
                <Download className="mr-2 h-4 w-4" />
                <span>Load Session</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-background/90 backdrop-blur border-white/10">System settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>System Overview</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSessionManagerOpen(true)}>
                <Network className="mr-2 h-4 w-4" />
                <span>{isConnected ? 'Session Settings' : 'Connect to Session'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStorageManagerOpen(true)}>
                <HardDrive className="mr-2 h-4 w-4" />
                <span>Storage Manager</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenSoundSettings}>
                <Volume2 className="mr-2 h-4 w-4" />
                <span>Sound Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLaunched(false)} className="text-red-400 focus:text-red-400">
                <Home className="mr-2 h-4 w-4" />
                <span>Return to Home Menu</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-white/10 mx-1" />

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

      {sessionManagerOpen && (
        <SessionManager
          open={sessionManagerOpen}
          onOpenChange={setSessionManagerOpen}
        />
      )}
      
      {storageManagerOpen && (
        <StorageManagerModal
          open={storageManagerOpen}
          onOpenChange={setStorageManagerOpen}
        />
      )}
    </div>
  );
};
