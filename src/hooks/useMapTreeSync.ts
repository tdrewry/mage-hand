// src/hooks/useMapTreeSync.ts
// Auto-broadcasts map tree state changes from DM to all clients via ephemeral ops.
// Only active when connected as DM.

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { useMapFocusStore } from '@/stores/mapFocusStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { emitMapTreeSync } from '@/lib/net/ephemeral/mapHandlers';

/**
 * Watches mapStore (activations, selectedMapId, structures) and mapFocusStore
 * (opacity, blur, selectionLock) for changes. When the current user is a DM
 * and connected, broadcasts the full map tree state to all clients.
 *
 * Uses a trailing-edge debounce (300ms) to avoid flooding during rapid toggles.
 */
export function useMapTreeSync(): void {
  const timerRef = useRef<number | null>(null);
  const isDmRef = useRef(false);
  const isConnectedRef = useRef(false);

  // Track DM and connection status
  useEffect(() => {
    const unsub = useMultiplayerStore.subscribe((state) => {
      isDmRef.current = state.roles.includes('dm');
      isConnectedRef.current = state.connectionStatus === 'connected';
    });
    // Init
    const s = useMultiplayerStore.getState();
    isDmRef.current = s.roles.includes('dm');
    isConnectedRef.current = s.connectionStatus === 'connected';
    return unsub;
  }, []);

  // Debounced emit
  const scheduleSync = () => {
    if (!isDmRef.current || !isConnectedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (isDmRef.current && isConnectedRef.current) {
        emitMapTreeSync();
      }
    }, 300);
  };

  // Watch mapStore changes
  useEffect(() => {
    const unsub = useMapStore.subscribe((state, prev) => {
      // Check if activations, selectedMapId, or structures changed
      const activationsChanged = state.maps.some((m, i) => {
        const pm = prev.maps[i];
        return !pm || pm.id !== m.id || pm.active !== m.active;
      }) || state.maps.length !== prev.maps.length;

      const selectionChanged = state.selectedMapId !== prev.selectedMapId;
      const structuresChanged = state.structures !== prev.structures;

      if (activationsChanged || selectionChanged || structuresChanged) {
        scheduleSync();
      }
    });
    return unsub;
  }, []);

  // Watch mapFocusStore changes
  useEffect(() => {
    const unsub = useMapFocusStore.subscribe((state, prev) => {
      if (
        state.unfocusedOpacity !== prev.unfocusedOpacity ||
        state.unfocusedBlur !== prev.unfocusedBlur ||
        state.selectionLockEnabled !== prev.selectionLockEnabled
      ) {
        scheduleSync();
      }
    });
    return unsub;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
