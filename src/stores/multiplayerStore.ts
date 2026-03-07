import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectedUser } from '@/types/multiplayerEvents';

export type TransportType = 'opbridge' | 'jazz';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

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
  
  // New WebSocket protocol fields
  roles: string[];
  permissions: string[];
  lastError: string | null;
  activeTransport: TransportType | null;
  
  // Sync state
  isSyncing: boolean;
  lastSyncTimestamp: number;
  syncErrors: string[];
  
  /** True once initial durable state pull (Jazz blobs) has completed after joining a session */
  syncReady: boolean;
  
  /** True once persist middleware has finished rehydrating from localStorage. */
  _rehydrated: boolean;
  
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
  setRoles: (roles: string[]) => void;
  setPermissions: (permissions: string[]) => void;
  setLastError: (error: string | null) => void;
  setActiveTransport: (transport: TransportType | null) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncReady: (ready: boolean) => void;
  updateLastSyncTimestamp: () => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  reset: () => void;
}

const DEFAULT_SERVER_URL = 'ws://localhost:3001';

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
      roles: [],
      permissions: [],
      lastError: null,
      activeTransport: null,
      isSyncing: false,
      lastSyncTimestamp: 0,
      syncErrors: [],
      syncReady: false,
      _rehydrated: false,
      
      // Actions
      setServerUrl: (url) => set({ serverUrl: url }),
      
      setConnectionStatus: (status) => set({ 
        connectionStatus: status,
        isConnected: status === 'connected'
      }),
      
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      setCurrentUsername: (username) => set({ currentUsername: username }),
      setConnectedUsers: (users) => {
        // Deduplicate by userId — first occurrence wins (preserves priority of selfUser)
        const seen = new Set<string>();
        const deduped = users.filter(u => {
          if (seen.has(u.userId)) return false;
          seen.add(u.userId);
          return true;
        });
        set({ connectedUsers: deduped });
      },
      
      addConnectedUser: (user) => set((state) => {
        const existing = state.connectedUsers.find(u => u.userId === user.userId);
        if (existing) {
          // Update existing entry (e.g. username or roles changed on reconnect)
          return {
            connectedUsers: state.connectedUsers.map(u =>
              u.userId === user.userId ? { ...u, ...user, connectedAt: u.connectedAt } : u
            ),
          };
        }
        return { connectedUsers: [...state.connectedUsers, user] };
      }),
      
      removeConnectedUser: (userId) => set((state) => ({
        connectedUsers: state.connectedUsers.filter(u => u.userId !== userId)
      })),
      
      updateUserRoles: (userId, roleIds) => set((state) => ({
        connectedUsers: state.connectedUsers.map(user =>
          user.userId === userId ? { ...user, roleIds } : user
        )
      })),
      
      setRoles: (roles) => set({ roles }),
      setPermissions: (permissions) => set({ permissions }),
      setLastError: (error) => set({ lastError: error }),
      setActiveTransport: (transport) => set({ activeTransport: transport }),
      
      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setSyncReady: (ready) => set({ syncReady: ready }),
      updateLastSyncTimestamp: () => set({ lastSyncTimestamp: Date.now() }),
      
      addSyncError: (error) => set((state) => ({
        syncErrors: [...state.syncErrors, error].slice(-10)
      })),
      
      clearSyncErrors: () => set({ syncErrors: [] }),
      
      reset: () => set({
        isConnected: false,
        connectionStatus: 'disconnected',
        currentSession: null,
        connectedUsers: [],
        currentUserId: null,
        roles: [],
        permissions: [],
        lastError: null,
        activeTransport: null,
        isSyncing: false,
        lastSyncTimestamp: 0,
        syncErrors: [],
        syncReady: false
      })
    }),
    {
      name: 'vtt-multiplayer-storage',
      partialize: (state) => ({
        serverUrl: state.serverUrl,
        currentUsername: state.currentUsername,
        currentSession: state.currentSession,
        currentUserId: state.currentUserId,
        roles: state.roles,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // Reset runtime connection state — we're not connected after a page load
            state.isConnected = false;
            state.connectionStatus = 'disconnected';
            state.connectedUsers = [];
            state.permissions = [];
            state.lastError = null;
            state.isSyncing = false;
            state.syncErrors = [];
            state.syncReady = false;
            state._rehydrated = true;
          }
        };
      },
    }
  )
);
