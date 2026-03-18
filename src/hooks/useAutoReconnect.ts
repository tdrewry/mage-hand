import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { netManager } from '@/lib/net';
import { getOrCreateClientId } from '../../networking/client/NetworkSession';

/**
 * Hook to automatically reconnect to a multiplayer session on page load
 * if the user was previously connected to a session.
 *
 * Strategy: LEAVE then REJOIN — identical to the manual J-code rejoin flow.
 * This avoids zombie WebRTC connections, double-transport races, and
 * signaling ghost issues by starting completely fresh each time.
 *
 * Waits for persist rehydration before attempting reconnection.
 */
export function useAutoReconnect() {
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    function tryReconnect(state: ReturnType<typeof useMultiplayerStore.getState>) {
      if (hasAttemptedReconnect.current) return;
      if (!state._rehydrated) return;

      // Already connected or in progress
      if (state.isConnected || state.connectionStatus === 'connecting' || state.connectionStatus === 'reconnecting') return;

      // Need a valid Jazz session ID to reconnect
      const sessionId = state.currentSession?.sessionId;
      const sessionCode = state.currentSession?.sessionCode;
      const username = state.currentUsername;
      const roles = state.roles;

      if (!sessionId || !sessionId.startsWith('co_') || !username) return;

      hasAttemptedReconnect.current = true;

      console.log('🔄 [AutoReconnect] Starting leave-rejoin for session', sessionId);

      const executeReconnect = async () => {
        // ── Step 1: Clean slate ────────────────────────────────────────
        // Disconnect any stale transport cleanly (intentional so no auto-schedule fires)
        netManager.disconnect();

        // Mark as connecting BEFORE setCurrentSession so useAutoReconnect won't
        // re-trigger if this hook somehow fires again (same guard as handleJoinSession)
        useMultiplayerStore.getState().setConnectionStatus('connecting');
        useMultiplayerStore.getState().setActiveTransport('jazz');

        // ── Step 2: Rejoin — same path as manual handleJoinSession ─────
        const { joinJazzSession } = await import('@/lib/jazz/session');
        const { JazzTransport } = await import('@/lib/net/transports/JazzTransport');
        const { WebRTCTransport } = await import('@/lib/net/transports/WebRTCTransport');

        const info = await joinJazzSession(sessionId);
        const clientId = getOrCreateClientId();

        // Restore session info (connectWithTransport won't overwrite in ephemeralOnly mode)
        useMultiplayerStore.getState().setRoles(roles);
        useMultiplayerStore.getState().setCurrentSession({
          sessionCode: sessionCode || sessionId,
          sessionId: info.sessionCoId,
          createdAt: state.currentSession?.createdAt ?? Date.now(),
          hasPassword: state.currentSession?.hasPassword ?? false,
        });

        const transport = new JazzTransport(info.root, clientId, username, roles);
        const ephemeralTransport = new WebRTCTransport(info.root, clientId, roles);

        // ── Step 3: Connect (identical to handleJoinSession path) ──────
        await netManager.connectWithTransport({
          transport,
          ephemeralTransport,
          sessionCode: sessionCode || sessionId,
          username,
          roles: roles.length > 0 ? roles : undefined,
        });

        console.log('✅ [AutoReconnect] Rejoin complete');
      };

      executeReconnect().catch((err) => {
        console.warn('⚠️ [AutoReconnect] Rejoin failed:', err);
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