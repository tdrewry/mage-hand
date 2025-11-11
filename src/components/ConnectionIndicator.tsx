import React from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle, Users } from 'lucide-react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { Badge } from './ui/badge';
import { Z_INDEX } from '@/lib/zIndex';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export const ConnectionIndicator: React.FC = () => {
  const { connectionStatus, currentSession, connectedUsers } = useMultiplayerStore();

  // Don't show anything if disconnected and no session
  if (connectionStatus === 'disconnected' && !currentSession) {
    return null;
  }

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: Wifi,
          variant: 'default' as const,
          label: 'Connected',
          color: 'text-green-500'
        };
      case 'connecting':
        return {
          icon: Loader2,
          variant: 'secondary' as const,
          label: 'Connecting',
          color: 'text-yellow-500',
          animate: true
        };
      case 'reconnecting':
        return {
          icon: Loader2,
          variant: 'secondary' as const,
          label: 'Reconnecting',
          color: 'text-yellow-500',
          animate: true
        };
      case 'error':
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          label: 'Connection Error',
          color: 'text-red-500'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          variant: 'secondary' as const,
          label: 'Disconnected',
          color: 'text-muted-foreground'
        };
      default:
        return {
          icon: WifiOff,
          variant: 'secondary' as const,
          label: 'Unknown',
          color: 'text-muted-foreground'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div 
      className="fixed top-4 right-4 pointer-events-auto"
      style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={config.variant}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 cursor-pointer"
          >
            <Icon 
              className={`h-3.5 w-3.5 ${config.color} ${config.animate ? 'animate-spin' : ''}`}
            />
            <span>{config.label}</span>
            {connectionStatus === 'connected' && connectedUsers.length > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{connectedUsers.length}</span>
                </div>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          <div className="space-y-1.5">
            <div className="font-semibold">Multiplayer Status</div>
            <div className="text-xs space-y-1">
              <div>Status: <span className={config.color}>{config.label}</span></div>
              {currentSession && (
                <div>Session: <span className="font-mono">{currentSession.sessionCode}</span></div>
              )}
              {connectionStatus === 'connected' && connectedUsers.length > 0 && (
                <div>Players: {connectedUsers.length}</div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
