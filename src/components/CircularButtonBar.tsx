import React from 'react';
import {
  Play,
  Edit,
  Menu as MenuIcon,
  Users,
  Footprints,
  Eye,
  Hand,
  ScanEye,
} from 'lucide-react';
import { useCardStore } from '@/stores/cardStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useMapEphemeralStore } from '@/stores/mapEphemeralStore';
import { useUiStateStore } from '@/stores/uiStateStore';
import { ephemeralBus } from '@/lib/net';
import { CardType } from '@/types/cardTypes';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';
import { toast } from 'sonner';

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
  const { isTopNavbarOpen, isFocusMode } = useUiStateStore();
  
  const movementLocked = useInitiativeStore((state) => state.restrictMovement);
  const setMovementLocked = useInitiativeStore((state) => state.setRestrictMovement);

  const currentPlayer = useSessionStore((state) =>
    state.players.find(p => p.id === state.currentPlayerId)
  );
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;

  const followDM = useMapEphemeralStore((s) => s.followDM);
  const setFollowDM = useMapEphemeralStore((s) => s.setFollowDM);
  const enforceFollowDM = useMapEphemeralStore((s) => s.enforceFollowDM);
  const setEnforceFollowDM = useMapEphemeralStore((s) => s.setEnforceFollowDM);

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

  const handleHandRaise = () => {
    ephemeralBus.emit('role.handRaise', {});
    toast.info('Hand raised!');
  };

  return (
    <Toolbar position="top" className="gap-0.5 px-1.5 py-1 mt-4">
      <ToolbarButton
        icon={MenuIcon}
        label="Menu"
        onClick={handleToggleMenu}
        isActive={menuCard?.isVisible}
        variant="ghost"
        size="xs"
      />

      <ToolbarSeparator />

      {isDM ? (
        <>
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
        </>
      ) : (
        <ToolbarButton
          icon={Play}
          label="Play Mode"
          onClick={() => {}}
          isActive
          variant="active"
          size="xs"
          className="bg-primary text-primary-foreground border-primary hover:bg-primary/90"
        />
      )}

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

      {isDM && (
        <ToolbarButton
          icon={ScanEye}
          label={enforceFollowDM ? 'Release Player Viewports' : 'Lock Players to DM Viewport'}
          onClick={() => {
            const newVal = !enforceFollowDM;
            setEnforceFollowDM(newVal);
            ephemeralBus.emit('map.dm.enforceFollow', { enforce: newVal });
            toast.info(newVal ? 'Players locked to your viewport' : 'Players released from viewport lock');
          }}
          isActive={enforceFollowDM}
          variant={enforceFollowDM ? 'active' : 'ghost'}
          size="xs"
          className={enforceFollowDM ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}
        />
      )}

      {!isDM && (
        <>
          <ToolbarSeparator />
          <ToolbarButton
            icon={Eye}
            label={followDM ? 'Stop Following DM' : 'Follow DM Viewport'}
            onClick={() => {
              setFollowDM(!followDM);
              toast.info(followDM ? 'Stopped following DM' : 'Following DM viewport');
            }}
            isActive={followDM}
            variant={followDM ? 'active' : 'ghost'}
            size="xs"
            className={followDM ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}
          />
        </>
      )}

      {!isDM && (
        <ToolbarButton
          icon={Hand}
          label="Raise Hand"
          onClick={handleHandRaise}
          variant="ghost"
          size="xs"
        />
      )}
    </Toolbar>
  );
};