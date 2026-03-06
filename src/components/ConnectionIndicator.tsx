import React from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle, Users, Database, Radio } from 'lucide-react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { netManager } from '@/lib/net';
import { Badge } from './ui/badge';
import { Z_INDEX } from '@/lib/zIndex';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type LayerStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';

function useTransportStates() {
  const { connectionStatus, activeTransport, currentSession, connectedUsers } = useMultiplayerStore();

  const isTandem = activeTransport === 'jazz';
  const wsConnected = netManager.isConnected;

  // Jazz (durable) layer status
  const jazzStatus: LayerStatus = !isTandem
    ? 'disconnected'
    : connectionStatus === 'connected' || connectionStatus === 'reconnecting'
      ? 'connected'
      : connectionStatus;

  // WebSocket (ephemeral) layer status
  const wsStatus: LayerStatus = !isTandem
    ? connectionStatus // standalone WS mode — use global status
    : wsConnected
      ? 'connected'
      : 'disconnected';

  return { isTandem, jazzStatus, wsStatus, connectionStatus, currentSession, connectedUsers, activeTransport };
}

function statusDot(status: LayerStatus): string {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'connecting':
    case 'reconnecting': return 'bg-yellow-500 animate-pulse';
    case 'error': return 'bg-destructive';
    default: return 'bg-muted-foreground/50';
  }
}

function statusLabel(status: LayerStatus): string {
  switch (status) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting';
    case 'reconnecting': return 'Reconnecting';
    case 'error': return 'Error';
    default: return 'Off';
  }
}

export const ConnectionIndicator: React.FC = () => {
  const { isTandem, jazzStatus, wsStatus, connectionStatus, currentSession, connectedUsers, activeTransport } = useTransportStates();

  // Don't show anything if disconnected and no session
  if (connectionStatus === 'disconnected' && !currentSession) {
    return null;
  }

  // Overall icon / color
  const anyConnected = jazzStatus === 'connected' || wsStatus === 'connected';
  const anyError = jazzStatus === 'error' || wsStatus === 'error';
  const anyLoading = ['connecting', 'reconnecting'].includes(jazzStatus) || ['connecting', 'reconnecting'].includes(wsStatus);

  const Icon = anyError ? AlertCircle : anyLoading ? Loader2 : anyConnected ? Wifi : WifiOff;
  const badgeVariant = anyError ? 'destructive' as const : anyConnected ? 'default' as const : 'secondary' as const;
  const iconColor = anyError ? 'text-destructive' : anyConnected ? 'text-green-500' : anyLoading ? 'text-yellow-500' : 'text-muted-foreground';

  const summaryLabel = isTandem
    ? (jazzStatus === 'connected' ? 'Tandem' : 'Partial')
    : statusLabel(wsStatus);

  return (
    <div
      className="fixed top-4 right-4 pointer-events-auto"
      style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={badgeVariant}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 cursor-pointer"
          >
            <Icon
              className={`h-3.5 w-3.5 ${iconColor} ${anyLoading ? 'animate-spin' : ''}`}
            />
            <span>{summaryLabel}</span>
            {anyConnected && connectedUsers.length > 0 && (
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
          <div className="space-y-2">
            <div className="font-semibold text-sm">Multiplayer Status</div>

            {isTandem ? (
              <div className="space-y-1.5">
                {/* Jazz layer */}
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-block h-2 w-2 rounded-full ${statusDot(jazzStatus)}`} />
                  <Database className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Durable (Jazz)</span>
                  <span className="ml-auto font-medium">{statusLabel(jazzStatus)}</span>
                </div>
                {/* WS layer */}
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-block h-2 w-2 rounded-full ${statusDot(wsStatus)}`} />
                  <Radio className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Ephemeral (WS)</span>
                  <span className="ml-auto font-medium">{statusLabel(wsStatus)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-block h-2 w-2 rounded-full ${statusDot(wsStatus)}`} />
                <Radio className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">OpBridge (WS)</span>
                <span className="ml-auto font-medium">{statusLabel(wsStatus)}</span>
              </div>
            )}

            {currentSession && (
              <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                Session: <span className="font-mono text-foreground">{currentSession.sessionCode}</span>
              </div>
            )}
            {anyConnected && connectedUsers.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Players online: {connectedUsers.length}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
