import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { netManager } from '@/lib/net';
import { isJazzCode, decodeJazzCode } from '@/lib/sessionCodeResolver';
import { joinJazzSession } from '@/lib/jazz';
import { JazzTransport } from '@/lib/net/transports/JazzTransport';

/**
 * Hook to automatically reconnect to a multiplayer session on page load
 * if the user was previously connected to a session.
 * Waits for persist rehydration before attempting reconnection.
 *
 * Supports both WebSocket (OpBridge) and Jazz (CRDT) transports.
 * For Jazz sessions, reconnects both the CRDT bridge AND the
 * ephemeral WebSocket in tandem mode.
 */
export function useAutoReconnect() {
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    function tryReconnect(state: ReturnType<typeof useMultiplayerStore.getState>) {
      if (hasAttemptedReconnect.current) return;
      if (!state._rehydrated) return;

      // Already connected or in progress
      if (state.isConnected || state.connectionStatus === 'connecting' || state.connectionStatus === 'reconnecting') return;

      // Need session details to reconnect
      const code = state.currentSession?.sessionCode;
      const username = state.currentUsername;
      if (!code || !username) return;

      hasAttemptedReconnect.current = true;

      // ── Jazz reconnect (tandem: CRDT + ephemeral WS) ─────────────
      if (isJazzCode(code)) {
        const coValueId = decodeJazzCode(code);
        if (!coValueId) {
          console.warn('⚠️ [AutoReconnect] Invalid Jazz code, clearing session');
          useMultiplayerStore.getState().reset();
          return;
        }

        console.log('🔄 [AutoReconnect] Reconnecting Jazz session', code);
        useMultiplayerStore.getState().setConnectionStatus('reconnecting');

        // 1. Reconnect Jazz CRDT bridge
        joinJazzSession(coValueId)
          .then((info) => {
            const store = useMultiplayerStore.getState();
            store.setConnectionStatus('connected');
            store.setActiveTransport('jazz');
            console.log('✅ [AutoReconnect] Jazz session reconnected:', info.sessionCoId);
            
            // 2. Inject ephemeral transport
            const transport = new JazzTransport(info.root);
            netManager.connectWithTransport({
              transport,
              sessionCode: code,
              username,
              roles: store.roles.length > 0 ? store.roles : undefined,
            }).then(() => {
              console.log('✅ [AutoReconnect] Jazz Ephemeral Transport injected');
            }).catch((err) => {
              console.warn('⚠️ [AutoReconnect] Transport injection failed:', err);
            });
          })
          .catch((err) => {
            console.warn('⚠️ [AutoReconnect] Jazz reconnect failed:', err);
            useMultiplayerStore.getState().reset();
          });

        return;
      }

      // ── OpBridge / WebSocket reconnect ──────────────────────────────
      if (!state.serverUrl) return;

      console.log('🔄 [AutoReconnect] Reconnecting to session', code);

      netManager.connect({
        serverUrl: state.serverUrl,
        sessionCode: code,
        username,
        roles: state.roles.length > 0 ? state.roles : undefined,
      }).then(() => {
        console.log('✅ [AutoReconnect] Reconnected successfully');
      }).catch((err) => {
        console.warn('⚠️ [AutoReconnect] Failed to reconnect:', err);
        useMultiplayerStore.getState().reset();
      });
    }

    // Subscribe to store changes so we can react once rehydration completes
    const unsub = useMultiplayerStore.subscribe((state) => {
      if (hasAttemptedReconnect.current) { unsub(); return; }
      tryReconnect(state);
      if (hasAttemptedReconnect.current) unsub();
    });

    // Also check immediately in case rehydration already happened
    tryReconnect(useMultiplayerStore.getState());
    if (hasAttemptedReconnect.current) unsub();

    return () => unsub();
  }, []);
}