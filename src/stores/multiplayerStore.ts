import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus } from '@/lib/socketClient';
import type { ConnectedUser } from '@/types/multiplayerEvents';

export interface SessionInfo {
  sessionCode: string;
  sessionId: string;
  createdAt: number;
  hasPassword: boolean;
}

export interface MultiplayerState {
  // Connection state
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  serverUrl: string;
  
  // Session state
  currentSession: SessionInfo | null;
  connectedUsers: ConnectedUser[];
  currentUserId: string | null;
  currentUsername: string;
  
  // Sync state
  isSyncing: boolean;
  lastSyncTimestamp: number;
  syncErrors: string[];
  
  // Actions
  /**
   * Updates the server URL.
   * @param url The new server URL.
   */
  setServerUrl: (url: string) => void;

  /**
   * Sets the current connection status and updates isConnected accordingly.
   * @param status The new connection status.
   */
  setConnectionStatus: (status: ConnectionStatus) => void;

  /**
   * Sets the current session information.
   * @param session The session information or null if no session is active.
   */
  setCurrentSession: (session: SessionInfo | null) => void;

  /**
   * Sets the current user's ID.
   * @param userId The current user's ID or null.
   */
  setCurrentUserId: (userId: string | null) => void;

  /**
   * Sets the current user's display name.
   * @param username The display name.
   */
  setCurrentUsername: (username: string) => void;

  /**
   * Replaces the entire list of connected users.
   * @param users The list of connected users.
   */
  setConnectedUsers: (users: ConnectedUser[]) => void;

  /**
   * Adds a new user to the list of connected users if they are not already present.
   * @param user The user to add.
   */
  addConnectedUser: (user: ConnectedUser) => void;

  /**
   * Removes a user from the connected users list by their ID.
   * @param userId The ID of the user to remove.
   */
  removeConnectedUser: (userId: string) => void;

  /**
   * Updates the roles for a specific user.
   * @param userId The ID of the user to update.
   * @param roleIds The new list of role IDs.
   */
  updateUserRoles: (userId: string, roleIds: string[]) => void;

  /**
   * Sets the synchronization status.
   * @param syncing True if currently syncing, false otherwise.
   */
  setSyncing: (syncing: boolean) => void;

  /**
   * Updates the last synchronization timestamp to the current time.
   */
  updateLastSyncTimestamp: () => void;

  /**
   * Adds a synchronization error to the history, keeping only the last 10 errors.
   * @param error The error message.
   */
  addSyncError: (error: string) => void;

  /**
   * Clears all synchronization errors.
   */
  clearSyncErrors: () => void;

  /**
   * Resets the multiplayer state to its default values.
   */
  reset: () => void;
}

const DEFAULT_SERVER_URL = 'http://localhost:3001';

export const useMultiplayerStore = create<MultiplayerState>()(
  persist(
    (set) => ({
      // Initial state
      isConnected: false,
      connectionStatus: 'disconnected',
      serverUrl: DEFAULT_SERVER_URL,
      currentSession: null,
      connectedUsers: [],
      currentUserId: null,
      currentUsername: '',
      isSyncing: false,
      lastSyncTimestamp: 0,
      syncErrors: [],
      
      // Actions
      setServerUrl: (url) => {
        set({ serverUrl: url });
      },
      
      setConnectionStatus: (status) => {
        set({ 
          connectionStatus: status,
          isConnected: status === 'connected'
        });
      },
      
      setCurrentSession: (session) => {
        set({ currentSession: session });
      },
      
      setCurrentUserId: (userId) => {
        set({ currentUserId: userId });
      },
      
      setCurrentUsername: (username) => {
        set({ currentUsername: username });
      },
      
      setConnectedUsers: (users) => {
        set({ connectedUsers: users });
      },
      
      addConnectedUser: (user) => {
        set((state) => {
          // Don't add if already exists
          if (state.connectedUsers.some(u => u.userId === user.userId)) {
            return state;
          }
          return {
            connectedUsers: [...state.connectedUsers, user]
          };
        });
      },
      
      removeConnectedUser: (userId) => {
        set((state) => ({
          connectedUsers: state.connectedUsers.filter(u => u.userId !== userId)
        }));
      },
      
      updateUserRoles: (userId, roleIds) => {
        set((state) => ({
          connectedUsers: state.connectedUsers.map(user =>
            user.userId === userId ? { ...user, roleIds } : user
          )
        }));
      },
      
      setSyncing: (syncing) => {
        set({ isSyncing: syncing });
      },
      
      updateLastSyncTimestamp: () => {
        set({ lastSyncTimestamp: Date.now() });
      },
      
      addSyncError: (error) => {
        set((state) => ({
          syncErrors: [...state.syncErrors, error].slice(-10) // Keep last 10 errors
        }));
      },
      
      clearSyncErrors: () => {
        set({ syncErrors: [] });
      },
      
      reset: () => {
        set({
          isConnected: false,
          connectionStatus: 'disconnected',
          currentSession: null,
          connectedUsers: [],
          currentUserId: null,
          isSyncing: false,
          lastSyncTimestamp: 0,
          syncErrors: []
        });
      }
    }),
    {
      name: 'vtt-multiplayer-storage',
      partialize: (state) => ({
        serverUrl: state.serverUrl,
        currentUsername: state.currentUsername,
        currentSession: state.currentSession,
        currentUserId: state.currentUserId,
      })
    }
  )
);
