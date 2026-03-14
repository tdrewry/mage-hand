import React from 'react';
import { Eye, Hand } from 'lucide-react';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useMapEphemeralStore } from '@/stores/mapEphemeralStore';
import { useUiStateStore } from '@/stores/uiStateStore';
import { ephemeralBus } from '@/lib/net';
import { CardType } from '@/types/cardTypes';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CircularButtonBarProps {}

export const CircularButtonBar: React.FC<CircularButtonBarProps> = () => {
  const { isTopNavbarOpen, isFocusMode } = useUiStateStore();
  const { isInCombat } = useInitiativeStore();

  const currentPlayer = useSessionStore((state) =>
    state.players.find(p => p.id === state.currentPlayerId)
  );
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;

  const followDM = useMapEphemeralStore((s) => s.followDM);
  const setFollowDM = useMapEphemeralStore((s) => s.setFollowDM);

  const handleHandRaise = () => {
    ephemeralBus.emit('role.handRaise', {});
    toast.info('Hand raised!');
  };

  return (
    <Toolbar position="top" className={cn("gap-0.5 px-1.5 py-1 transition-all duration-300", isInCombat ? "mt-[72px]" : "mt-4")}>

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