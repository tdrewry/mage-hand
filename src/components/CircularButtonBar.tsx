import React from 'react';
import {
  Footprints,
  Eye,
  Hand,
  ScanEye,
} from 'lucide-react';
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
  const { restrictMovement: movementLocked, setRestrictMovement: setMovementLocked, isInCombat } = useInitiativeStore();

  const currentPlayer = useSessionStore((state) =>
    state.players.find(p => p.id === state.currentPlayerId)
  );
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;

  const followDM = useMapEphemeralStore((s) => s.followDM);
  const setFollowDM = useMapEphemeralStore((s) => s.setFollowDM);
  const enforceFollowDM = useMapEphemeralStore((s) => s.enforceFollowDM);
  const setEnforceFollowDM = useMapEphemeralStore((s) => s.setEnforceFollowDM);

  const handleHandRaise = () => {
    ephemeralBus.emit('role.handRaise', {});
    toast.info('Hand raised!');
  };

  return (
    <Toolbar position="top" className={cn("gap-0.5 px-1.5 py-1 transition-all duration-300", isInCombat ? "mt-[72px]" : "mt-4")}>

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