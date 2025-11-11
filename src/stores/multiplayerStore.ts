import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus } from '@/lib/socketClient';
import type { ConnectedUser } from '@/types/multiplayerEvents';
import type { VisibilitySnapshot } from '@/lib/visibilitySync';

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
  
  // Visibility state
  visibilitySnapshot: VisibilitySnapshot | null;
  
  // Actions
  setServerUrl: (url: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setCurrentSession: (session: SessionInfo | null) => void;
  setCurrentUserId: (userId: string | null) => void;
  setCurrentUsername: (username: string) => void;
  setConnectedUsers: (users: ConnectedUser[]) => void;
  addConnectedUser: (user: ConnectedUser) => void;
  removeConnectedUser: (userId: string) => void;
  updateUserRoles: (userId: string, roleIds: string[]) => void;
  setSyncing: (syncing: boolean) => void;
  updateLastSyncTimestamp: () => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  setVisibilitySnapshot: (snapshot: VisibilitySnapshot | null) => void;
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
      visibilitySnapshot: null,
      
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
      
      setVisibilitySnapshot: (snapshot) => {
        set({ visibilitySnapshot: snapshot });
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
          syncErrors: [],
          visibilitySnapshot: null
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
