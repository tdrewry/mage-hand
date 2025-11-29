import React from 'react';
import {
  Play,
  Edit,
  Menu as MenuIcon,
  Users,
  Lock,
  LockOpen,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCardStore } from '@/stores/cardStore';
import { useSessionStore } from '@/stores/sessionStore';
import { CardType } from '@/types/cardTypes';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/zIndex';

interface CircularButtonBarProps {
  mode: 'edit' | 'play';
  onToggleMode: () => void;
}

export const CircularButtonBar: React.FC<CircularButtonBarProps> = ({
  mode,
  onToggleMode,
}) => {
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  const registerCard = useCardStore((state) => state.registerCard);
  
  const movementLocked = useSessionStore((state) => state.movementLocked);
  const setMovementLocked = useSessionStore((state) => state.setMovementLocked);

  const menuCard = cards.find((c) => c.type === CardType.MENU);
  const rosterCard = cards.find((c) => c.type === CardType.ROSTER);

  const handleToggleMenu = () => {
    if (menuCard) {
      setVisibility(menuCard.id, !menuCard.isVisible);
    }
  };

  const handleToggleRoster = () => {
    if (rosterCard) {
      setVisibility(rosterCard.id, !rosterCard.isVisible);
    } else {
      registerCard({
        type: CardType.ROSTER,
        title: 'Roster',
        defaultPosition: { x: window.innerWidth - 320, y: 80 },
        defaultSize: { width: 300, height: 500 },
        minSize: { width: 250, height: 300 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };


  return (
    <TooltipProvider>
      <div 
        className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/95 backdrop-blur border border-border rounded-full px-3 py-2 shadow-lg"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        {/* Menu Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleToggleMenu}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2",
                menuCard?.isVisible
                  ? "bg-accent text-accent-foreground border-accent hover:bg-accent/90"
                  : "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80"
              )}
            >
              <MenuIcon className="w-6 h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Menu</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-border" />

        {/* Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleMode}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2",
                mode === 'play' 
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" 
                  : "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80"
              )}
            >
              <Play className="w-6 h-6" fill={mode === 'play' ? 'currentColor' : 'none'} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{mode === 'play' ? 'Play Mode' : 'Switch to Play Mode'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleMode}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2",
                mode === 'edit' 
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" 
                  : "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80"
              )}
            >
              <Edit className="w-6 h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{mode === 'edit' ? 'Edit Mode' : 'Switch to Edit Mode'}</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-border" />

        {/* Roster Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleToggleRoster}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2",
                rosterCard?.isVisible
                  ? "bg-accent text-accent-foreground border-accent hover:bg-accent/90"
                  : "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80"
              )}
            >
              <Users className="w-6 h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Roster</p>
          </TooltipContent>
        </Tooltip>

        {/* Movement Lock Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setMovementLocked(!movementLocked)}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2",
                movementLocked
                  ? "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90"
                  : "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80"
              )}
            >
              {movementLocked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{movementLocked ? 'Unlock Movement' : 'Lock Movement'}</p>
          </TooltipContent>
        </Tooltip>

      </div>
    </TooltipProvider>
  );
};
