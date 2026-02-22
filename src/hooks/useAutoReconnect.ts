import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { netManager } from '@/lib/net';

/**
 * Hook to automatically reconnect to a multiplayer session on page load
 * if the user was previously connected to a session.
 * Waits for persist rehydration before attempting reconnection.
 */
export function useAutoReconnect() {
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    // Subscribe to store changes so we can react once rehydration completes
    const unsub = useMultiplayerStore.subscribe((state) => {
      if (hasAttemptedReconnect.current) return;
      if (!state._rehydrated) return;

      // Already connected or in progress
      if (state.isConnected || state.connectionStatus === 'connecting' || state.connectionStatus === 'reconnecting') return;

      // Need session details to reconnect
      if (!state.currentSession?.sessionCode || !state.currentUsername || !state.serverUrl) return;

      hasAttemptedReconnect.current = true;
      unsub(); // Stop listening

      console.log('🔄 [AutoReconnect] Reconnecting to session', state.currentSession.sessionCode);

      netManager.connect({
        serverUrl: state.serverUrl,
        sessionCode: state.currentSession.sessionCode,
        username: state.currentUsername,
        roles: state.roles.length > 0 ? state.roles : undefined,
      }).then(() => {
        console.log('✅ [AutoReconnect] Reconnected successfully');
      }).catch((err) => {
        console.warn('⚠️ [AutoReconnect] Failed to reconnect:', err);
        // Clear stale session so user can start fresh
        useMultiplayerStore.getState().reset();
      });
    });

    // Also check immediately in case rehydration already happened
    const state = useMultiplayerStore.getState();
    if (state._rehydrated && !hasAttemptedReconnect.current) {
      if (!state.isConnected && state.connectionStatus !== 'connecting' && state.connectionStatus !== 'reconnecting') {
        if (state.currentSession?.sessionCode && state.currentUsername && state.serverUrl) {
          hasAttemptedReconnect.current = true;
          unsub();

          console.log('🔄 [AutoReconnect] Reconnecting to session (immediate)', state.currentSession.sessionCode);

          netManager.connect({
            serverUrl: state.serverUrl,
            sessionCode: state.currentSession.sessionCode,
            username: state.currentUsername,
            roles: state.roles.length > 0 ? state.roles : undefined,
          }).then(() => {
            console.log('✅ [AutoReconnect] Reconnected successfully');
          }).catch((err) => {
            console.warn('⚠️ [AutoReconnect] Failed to reconnect:', err);
            useMultiplayerStore.getState().reset();
          });
        }
      }
    }

    return () => unsub();
  }, []);
}
