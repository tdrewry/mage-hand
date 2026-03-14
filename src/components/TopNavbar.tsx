import React from 'react';
import { useUiStateStore } from '@/stores/uiStateStore';
import { useCardStore } from '@/stores/cardStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useMapEphemeralStore } from '@/stores/mapEphemeralStore';
import { ephemeralBus } from '@/lib/net';
import { CardType } from '@/types/cardTypes';
import { cn } from '@/lib/utils';
import { 
  Focus, Maximize, ChevronLeft, ChevronRight, Settings, FolderOpen, Monitor, 
  Network, HardDrive, Volume2, Home, Save, Download, Play, Castle, UserCircle, Plus, Shield,
  Gamepad2, Footprints, ScanEye, Lock
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
  const { tokens, players, currentPlayerId } = useSessionStore();
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;
  const { regions } = useRegionStore();
  
  const { restrictMovement: movementLocked, setRestrictMovement: setMovementLocked } = useInitiativeStore();
  const enforceFollowDM = useMapEphemeralStore((s) => s.enforceFollowDM);
  const setEnforceFollowDM = useMapEphemeralStore((s) => s.setEnforceFollowDM);
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  const dockCard = useCardStore((state) => state.dockCard);

  const projectManagerCard = cards.find((c) => c.type === CardType.PROJECT_MANAGER);
  const soundSettingsCard = cards.find((c) => c.type === CardType.SOUND_SETTINGS);
  const roleManagerCard = cards.find((c) => c.type === CardType.ROLE_MANAGER);

  const handleDockTool = (type: CardType, title: string, side: 'left' | 'right') => {
    const existingCard = cards.find((c) => c.type === type);
    if (existingCard) {
      setVisibility(existingCard.id, true);
      dockCard(existingCard.id, side);
    } else {
      registerCard({
        type,
        title,
        defaultPosition: { x: 0, y: 0 },
        defaultSize: { width: 320, height: 500 },
        dockPosition: side,
        defaultVisible: true,
        isClosable: true,
        isResizable: true,
      });
    }
  };

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

  const handleOpenRoleManager = () => {
    if (roleManagerCard) {
      setVisibility(roleManagerCard.id, true);
    } else {
      registerCard({
        type: CardType.ROLE_MANAGER,
        title: 'Role Manager',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
        defaultSize: { width: 600, height: 700 },
        minSize: { width: 500, height: 600 },
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
      <div className="absolute top-4 right-6 z-50 pointer-events-auto">
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
        isLeftSidebarOpen ? "w-[345px] justify-between px-4" : "w-14 justify-center"
      )}>
        {isLeftSidebarOpen ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3 mr-1" />
                  Dock Tool
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleDockTool(CardType.COMPENDIUM, 'Compendium', 'left')}>
                  Compendium
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDockTool(CardType.ENVIRONMENT, 'Environment', 'left')}>
                  Environment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDockTool(CardType.CAMPAIGN, 'Campaign', 'left')}>
                  Campaign
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDockTool(CardType.PLAY, 'Play', 'left')}>
                  Play
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="flex items-center gap-2 flex-wrap mt-[2px]">
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 border-white/10 bg-black/20 text-muted-foreground/80 font-normal">
              Session: {currentSession?.sessionCode?.slice(0, 8) || 'paper-demo'}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 py-0 bg-white/5 hover:bg-white/10 text-muted-foreground/80 font-normal">
              Tokens: {tokens.length}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 py-0 bg-white/5 hover:bg-white/10 text-muted-foreground/80 font-normal">
              Regions: {regions.length}
            </Badge>
          </div>
        </div>

        {/* Center: Future map selector or core global toggles */}
        <div className="flex flex-1 items-center justify-center pointer-events-none">
          {movementLocked && (
            <Badge 
              variant="destructive" 
              className="flex items-center gap-2 px-4 py-1 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto"
              onClick={() => setMovementLocked(false)}
              title="Click to unlock movement"
            >
              <Lock className="h-3 w-3" />
              <span>Movement Locked — click to unlock</span>
            </Badge>
          )}
        </div>

        {/* Right side: Global settings and views */}
        <div className="flex items-center gap-2">
          
          {/* DM Mode Status Indicators */}
          {isDM && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-6 w-6 rounded-full shrink-0 transition-colors", 
                      enforceFollowDM 
                        ? "bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30" 
                        : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                    )}
                    onClick={() => {
                      const newVal = !enforceFollowDM;
                      setEnforceFollowDM(newVal);
                      ephemeralBus.emit('map.dm.enforceFollow', { enforce: newVal });
                      toast.info(newVal ? 'Players locked to your viewport' : 'Players released from viewport lock');
                    }}
                  >
                    <ScanEye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">
                  {enforceFollowDM ? 'Players locked to your viewport (Click to release)' : 'Lock Players to DM Viewport'}
                </TooltipContent>
              </Tooltip>

              <Badge variant="outline" className="hidden md:flex ml-1 h-6 px-2 text-[10px] uppercase font-bold tracking-wider border-white/10 bg-black/20 text-muted-foreground/80">
                {renderingMode === 'edit' ? 'Edit Mode' : 'Play Mode'}
              </Badge>
            </>
          )}

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                    <Monitor className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={24} className="bg-background/90 backdrop-blur border-white/10">Mode settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>View Role</DropdownMenuLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => setMode('dm')} disabled={lockedByDm}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>DM View</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Provides Game Master tools and permissions</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => setMode('play')} disabled={lockedByDm}>
                    <Play className="mr-2 h-4 w-4" />
                    <span>Player View</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Simulates what players can see and do</TooltipContent>
              </Tooltip>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>World State</DropdownMenuLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => { setRenderingMode('edit'); toast.success('Switched to Edit mode'); }}>
                    <Castle className="mr-2 h-4 w-4" />
                    <span>Edit Mode</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Build maps, place tokens, ignore fog</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => { setRenderingMode('play'); toast.success('Switched to Play mode'); }}>
                    <Play className="mr-2 h-4 w-4" />
                    <span>Play Mode</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Enforce fog of war and movement limitations</TooltipContent>
              </Tooltip>
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
              <TooltipContent side="bottom" align="end" sideOffset={24} className="bg-background/90 backdrop-blur border-white/10">Project files</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={handleOpenProjectManager}>
                    <Save className="mr-2 h-4 w-4" />
                    <span>Save Session</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Export active maps and settings to device</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={handleOpenProjectManager}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Load Session</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Import mapping data and entities from file</TooltipContent>
              </Tooltip>
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
              <TooltipContent side="bottom" align="end" sideOffset={24} className="bg-background/90 backdrop-blur border-white/10">System settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>System Overview</DropdownMenuLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => setSessionManagerOpen(true)}>
                    <Network className="mr-2 h-4 w-4" />
                    <span>{isConnected ? 'Session Settings' : 'Connect to Session'}</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Manage multiplayer connection info</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => setStorageManagerOpen(true)}>
                    <HardDrive className="mr-2 h-4 w-4" />
                    <span>Storage Manager</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Manage local IndexedDB database</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={handleOpenRoleManager}>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Role Manager</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Configure player security permissions</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={handleOpenSoundSettings}>
                    <Volume2 className="mr-2 h-4 w-4" />
                    <span>Sound Settings</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Adjust volumes and audio output options</TooltipContent>
              </Tooltip>
              <DropdownMenuSeparator />
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => setLaunched(false)} className="text-red-400 focus:text-red-400">
                    <Home className="mr-2 h-4 w-4" />
                    <span>Return to Home Menu</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Exit tabletop to main screen</TooltipContent>
              </Tooltip>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                    <Gamepad2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={24} className="bg-background/90 backdrop-blur border-white/10">Tabletop Controls</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur border-white/10">
              <DropdownMenuLabel>Tabletop Controls</DropdownMenuLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={() => setMovementLocked(!movementLocked)}>
                    <Footprints className="mr-2 h-4 w-4" />
                    <span>{movementLocked ? 'Unlock Token Movement' : 'Lock Token Movement'}</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Prevent players from moving tokens</TooltipContent>
              </Tooltip>
              {isDM && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem onClick={() => {
                      const newVal = !enforceFollowDM;
                      setEnforceFollowDM(newVal);
                      ephemeralBus.emit('map.dm.enforceFollow', { enforce: newVal });
                      toast.info(newVal ? 'Players locked to your viewport' : 'Players released from viewport lock');
                    }}>
                      <ScanEye className="mr-2 h-4 w-4" />
                      <span>{enforceFollowDM ? 'Release Player Viewports' : 'Lock Players to DM Viewport'}</span>
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={14} className="bg-background/90 backdrop-blur border-white/10 z-[100]">Force players' camera to follow your view</TooltipContent>
                </Tooltip>
              )}
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
            <TooltipContent side="bottom" sideOffset={24} align="end" className="bg-background/90 backdrop-blur border-white/10">
              <p>Focus Mode (Hide UI)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Right Segment: Campaign Log Header / Toggle */}
      <div className={cn(
        "flex flex-shrink-0 items-center overflow-hidden transition-all duration-300 ease-in-out border-l border-white/10 h-full",
        isRightSidebarOpen ? "w-[345px] justify-between px-4" : "w-14 justify-center"
      )}>
        {isRightSidebarOpen ? (
          <>
            <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="h-8 w-8 hover:bg-white/5 shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3 mr-1" />
                  Dock Tool
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDockTool(CardType.COMPENDIUM, 'Compendium', 'right')}>
                  Compendium
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDockTool(CardType.ENVIRONMENT, 'Environment', 'right')}>
                  Environment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDockTool(CardType.CAMPAIGN, 'Campaign', 'right')}>
                  Campaign
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDockTool(CardType.PLAY, 'Play', 'right')}>
                  Play
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
