import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { netManager } from '@/lib/net';

/**
 * Hook to automatically reconnect to a multiplayer session on page load
 * if the user was previously connected to a session.
 */
export function useAutoReconnect() {
  const { currentSession, currentUsername, serverUrl, isConnected, connectionStatus } = useMultiplayerStore();
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    if (hasAttemptedReconnect.current) return;
    if (isConnected || connectionStatus === 'connecting' || connectionStatus === 'reconnecting') return;
    if (!currentSession?.sessionCode || !currentUsername || !serverUrl) return;

    hasAttemptedReconnect.current = true;

    // Get local player's role IDs for the reconnect
    const sessionState = useSessionStore.getState();
    const currentPlayer = sessionState.players.find(p => p.id === sessionState.currentPlayerId);
    const localRoles = currentPlayer?.roleIds;

    console.log('🔄 [AutoReconnect] Reconnecting to session', currentSession.sessionCode);

    netManager.connect({
      serverUrl,
      sessionCode: currentSession.sessionCode,
      username: currentUsername,
      roles: localRoles,
    }).then(() => {
      console.log('✅ [AutoReconnect] Reconnected successfully');
    }).catch((err) => {
      console.warn('⚠️ [AutoReconnect] Failed to reconnect:', err);
      // Clear stale session so user can start fresh
      useMultiplayerStore.getState().reset();
    });
  }, []); // Only run on mount
}
