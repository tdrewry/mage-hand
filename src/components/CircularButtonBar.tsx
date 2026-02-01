import React from 'react';
import {
  Play,
  Edit,
  Menu as MenuIcon,
  Users,
  Footprints,
} from 'lucide-react';
import { useCardStore } from '@/stores/cardStore';
import { useSessionStore } from '@/stores/sessionStore';
import { CardType } from '@/types/cardTypes';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';

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
    <Toolbar position="top" className="gap-0.5 px-1.5 py-1">
      <ToolbarButton
        icon={MenuIcon}
        label="Menu"
        onClick={handleToggleMenu}
        isActive={menuCard?.isVisible}
        variant="ghost"
        size="xs"
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={Play}
        label={mode === 'play' ? 'Play Mode' : 'Switch to Play Mode'}
        onClick={onToggleMode}
        isActive={mode === 'play'}
        variant={mode === 'play' ? 'active' : 'ghost'}
        size="xs"
        className={mode === 'play' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}
      />

      <ToolbarButton
        icon={Edit}
        label={mode === 'edit' ? 'Edit Mode' : 'Switch to Edit Mode'}
        onClick={onToggleMode}
        isActive={mode === 'edit'}
        variant={mode === 'edit' ? 'active' : 'ghost'}
        size="xs"
        className={mode === 'edit' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={Users}
        label="Roster"
        onClick={handleToggleRoster}
        isActive={rosterCard?.isVisible}
        variant="ghost"
        size="xs"
      />

      <ToolbarButton
        icon={Footprints}
        label={movementLocked ? 'Unlock Token Movement' : 'Lock All Token Movement'}
        onClick={() => setMovementLocked(!movementLocked)}
        variant={movementLocked ? 'destructive' : 'ghost'}
        size="xs"
      />
    </Toolbar>
  );
};
