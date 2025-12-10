import { useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { syncManager } from '@/lib/syncManager';
import { toast } from 'sonner';

/**
 * Hook to automatically reconnect to a multiplayer session on page load
 * if the user was previously connected to a session
 */
export function useAutoReconnect() {
  const { currentSession, currentUsername, serverUrl, isConnected } = useMultiplayerStore();
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    // Only attempt reconnect once on mount
    if (hasAttemptedReconnect.current) return;
    
    // Don't reconnect if already connected
    if (isConnected) return;

    // Check if we have a session to reconnect to
    if (!currentSession || !currentUsername) return;

    console.log('🔄 Attempting auto-reconnect to session:', currentSession.sessionCode);
    hasAttemptedReconnect.current = true;

    const attemptReconnect = async () => {
      try {
        // Initialize sync manager if needed
        await syncManager.initialize(serverUrl);
        
        // Connect to server
        await syncManager.connect();
        
        // Rejoin the session
        await syncManager.joinSession(
          currentSession.sessionCode,
          currentUsername
        );

        toast.success("Reconnected", {
          description: `Rejoined session ${currentSession.sessionCode}`,
        });
      } catch (error) {
        console.error('❌ Auto-reconnect failed:', error);
        
        toast.error("Reconnection Failed", {
          description: "Could not reconnect to previous session",
        });

        // Clear the stale session data
        useMultiplayerStore.getState().reset();
      }
    };

    // Small delay to allow other initializations to complete
    const timeoutId = setTimeout(attemptReconnect, 500);

    return () => clearTimeout(timeoutId);
  }, []); // Empty deps - only run on mount
}
