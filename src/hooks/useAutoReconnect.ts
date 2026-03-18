import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { netManager } from '@/lib/net';
import { isJazzCode, decodeJazzCode, resolveSessionCode } from '@/lib/sessionCodeResolver';
import { joinJazzSession } from '@/lib/jazz';
import { JazzTransport } from '@/lib/net/transports/JazzTransport';
import { WebRTCTransport } from '@/lib/net/transports/WebRTCTransport';
import { getOrCreateClientId } from '../../networking/client/NetworkSession';

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
      const executeReconnect = async (targetCode: string) => {
        let isJazz = isJazzCode(targetCode);
        let coValueId = '';

        // Prefer the persisted sessionId (raw co_z CoValue ID) — always available after
        // a successful connect and avoids a registry round-trip on every page reload.
        const persistedSessionId = state.currentSession?.sessionId;
        if (persistedSessionId && persistedSessionId.startsWith('co_')) {
          isJazz = true;
          coValueId = persistedSessionId;
        } else if (isJazz) {
          coValueId = decodeJazzCode(targetCode) || '';
        } else if (!isJazz && targetCode.length <= 10) {
          // Last resort: registry lookup for codes that lack a stored sessionId
          try {
            const resolved = await resolveSessionCode(targetCode);
            if (resolved.transport === 'jazz') {
              isJazz = true;
              coValueId = resolved.connectionId;
            }
          } catch (e) {
            console.warn('⚠️ [AutoReconnect] Failed to resolve short code:', e);
          }
        }
        
        if (isJazz) {
          if (state.activeTransport !== 'jazz') {
            // Phase 1: Trigger the global provider tree to swap to <JazzActiveProvider>
            console.log('🔄 [AutoReconnect] Phase 1: Requesting Jazz Provider mount');
            useMultiplayerStore.getState().setActiveTransport('jazz');
            return;
          }

          if (!coValueId) {
            console.warn('⚠️ [AutoReconnect] Invalid Jazz code, clearing session');
            useMultiplayerStore.getState().reset();
            return;
          }

          console.log('🔄 [AutoReconnect] Phase 2: Reconnecting Jazz session', targetCode);
          useMultiplayerStore.getState().setConnectionStatus('reconnecting');

          // 1. Reconnect Jazz CRDT bridge directly
          joinJazzSession(coValueId)
          .then((info) => {
            const store = useMultiplayerStore.getState();
            store.setConnectionStatus('connected');
            console.log('✅ [AutoReconnect] Jazz session reconnected:', info.sessionCoId);
            
            // 2. Inject ephemeral transport
            const clientId = getOrCreateClientId();
            const transport = new JazzTransport(info.root, clientId, username, store.roles);
            const ephemeralTransport = new WebRTCTransport(info.root, clientId, store.roles);
            
            netManager.connectWithTransport({
              transport,
              ephemeralTransport,
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
        }
      };

      executeReconnect(code);
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