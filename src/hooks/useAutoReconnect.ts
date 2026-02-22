import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';

/**
 * Hook to automatically reconnect to a multiplayer session on page load
 * if the user was previously connected to a session
 */
export function useAutoReconnect() {
  const { currentSession, currentUsername, serverUrl, isConnected } = useMultiplayerStore();
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    // Old Socket.IO auto-reconnect disabled — new WebSocket protocol
    // handles reconnection via NetManager. Clear any stale Socket.IO
    // session data so the old path doesn't interfere.
    if (!hasAttemptedReconnect.current && !isConnected && currentSession) {
      hasAttemptedReconnect.current = true;
      console.log('ℹ️ Skipping old Socket.IO auto-reconnect (migrated to WebSocket protocol)');
      // Clear stale Socket.IO session so it doesn't keep trying
      useMultiplayerStore.getState().reset();
    }
  }, []); // Empty deps - only run on mount
}
