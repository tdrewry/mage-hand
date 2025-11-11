/**
 * Hook to automatically compute and sync token visibility in multiplayer sessions
 * Recomputes visibility when tokens move, fog changes, or walls change
 */

import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useFogStore } from '@/stores/fogStore';
import { useRegionStore } from '@/stores/regionStore';
import { useRoleStore } from '@/stores/roleStore';
import { computeTokenVisibility } from '@/lib/visibilitySync';
import { syncManager } from '@/lib/syncManager';
import { throttle } from '@/lib/throttle';

/**
 * Hook that syncs token visibility across multiplayer sessions
 * Only DM should compute and broadcast visibility
 */
export function useVisibilitySync() {
  const isConnected = useMultiplayerStore(state => state.isConnected);
  const currentUserId = useMultiplayerStore(state => state.currentUserId);
  const connectedUsers = useMultiplayerStore(state => state.connectedUsers);
  const setVisibilitySnapshot = useMultiplayerStore(state => state.setVisibilitySnapshot);
  
  const tokens = useSessionStore(state => state.tokens);
  const players = useSessionStore(state => state.players);
  const currentPlayerId = useSessionStore(state => state.currentPlayerId);
  
  const fogEnabled = useFogStore(state => state.enabled);
  const exploredAreas = useFogStore(state => state.serializedExploredAreas);
  
  const regions = useRegionStore(state => state.regions);
  const roles = useRoleStore(state => state.roles);
  
  // Throttled visibility computation (max once per 500ms)
  const computeAndSyncVisibilityRef = useRef(
    throttle(() => {
      // Only DM should compute and broadcast visibility
      const currentPlayer = players.find(p => p.id === currentPlayerId);
      const isDM = currentPlayer?.roleIds?.includes('dm') || false;
      
      if (!isDM || !syncManager.isConnected()) {
        return;
      }
      
      console.log('🔍 Computing token visibility for all players');
      
      // Get walls (regions with isWall = true)
      const walls = regions.filter(r => (r as any).isWall === true);
      
      // Compute visibility for all tokens
      const visibilitySnapshot = computeTokenVisibility(
        tokens,
        players,
        roles,
        walls,
        fogEnabled,
        exploredAreas
      );
      
      // Update local state
      setVisibilitySnapshot(visibilitySnapshot);
      
      // Sync to all clients
      syncManager.syncVisibility(visibilitySnapshot.tokens);
      
      console.log(`✅ Visibility computed for ${visibilitySnapshot.tokens.length} tokens`);
    }, 500)
  );
  
  // Recompute visibility when relevant state changes
  useEffect(() => {
    if (!isConnected || !currentUserId) {
      return;
    }
    
    // Compute visibility whenever tokens, fog, walls, or players change
    computeAndSyncVisibilityRef.current();
    
  }, [
    isConnected,
    currentUserId,
    tokens.length,
    // Monitor token positions (stringify to detect changes)
    JSON.stringify(tokens.map(t => ({ id: t.id, x: t.x, y: t.y, isHidden: t.isHidden }))),
    players.length,
    JSON.stringify(players.map(p => ({ id: p.id, roleIds: p.roleIds }))),
    fogEnabled,
    exploredAreas,
    regions.length,
    JSON.stringify(regions.filter(r => (r as any).isWall).map(r => ({ id: r.id, x: r.x, y: r.y }))),
  ]);
  
  // Also recompute when users join/leave
  useEffect(() => {
    if (!isConnected) return;
    
    computeAndSyncVisibilityRef.current();
  }, [connectedUsers.length]);
}
