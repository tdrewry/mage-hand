import React, { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectedUser } from '@/types/multiplayerEvents';

export type TransportType = 'jazz';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface SessionInfo {
  sessionCode: string;
  sessionId: string;
  createdAt: number;
  hasPassword: boolean;
}

export interface RosterPeer {
  id: string;
  displayName: string;
  role: 'host' | 'client';
  isLocal: boolean;
}

export interface MultiplayerState {
  // Connection state
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  
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
  customJazzUrl: string | null;
  customRegistryId: string | null;
  
  // WebRTC Ephemeral State
  webRtcConnections: Array<{ peerId: string; status: RTCPeerConnectionState | 'new' }>;
  
  // Sync state
  isSyncing: boolean;
  lastSyncTimestamp: number;
  syncErrors: string[];
  
  /** True once initial durable state pull (Jazz blobs) has completed after joining a session */
  syncReady: boolean;
  
  /** True once persist middleware has finished rehydrating from localStorage. */
  _rehydrated: boolean;
  
  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setCurrentSession: (session: SessionInfo | null) => void;
  setCurrentUserId: (userId: string | null) => void;
  setCurrentUsername: (username: string) => void;
  setConnectedUsers: (users: ConnectedUser[]) => void;
  syncPresenceHeartbeats: (users: ConnectedUser[]) => void;
  addConnectedUser: (user: ConnectedUser) => void;
  removeConnectedUser: (userId: string) => void;
  updateUserRoles: (userId: string, roleIds: string[]) => void;
  setRoles: (roles: string[]) => void;
  setPermissions: (permissions: string[]) => void;
  setLastError: (error: string | null) => void;
  setActiveTransport: (transport: TransportType | null) => void;
  setCustomJazzUrl: (url: string | null) => void;
  setCustomRegistryId: (id: string | null) => void;
  setWebRtcConnection: (peerId: string, status: RTCPeerConnectionState | 'new') => void;
  removeWebRtcConnection: (peerId: string) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncReady: (ready: boolean) => void;
  updateLastSyncTimestamp: () => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  reset: () => void;
}


export const useMultiplayerStore = create<MultiplayerState>()(
  persist(
    (set) => ({
      // Initial state
      isConnected: false,
      connectionStatus: 'disconnected',
      currentSession: null,
      connectedUsers: [],
      currentUserId: null,
      currentUsername: '',
      roles: [],
      permissions: [],
      lastError: null,
      activeTransport: null,
      customJazzUrl: null,
      customRegistryId: null,
      webRtcConnections: [],
      isSyncing: false,
      lastSyncTimestamp: 0,
      syncErrors: [],
      syncReady: false,
      _rehydrated: false,
      
      // Actions
      
      setConnectionStatus: (status) => set({ 
        connectionStatus: status,
        isConnected: status === 'connected'
      }),
      
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      setCurrentUsername: (username) => set({ currentUsername: username }),
      setConnectedUsers: (users) => set((state) => {
        // Merge the incoming array with the existing users to avoid dropping early presence events
        const combined = [...users, ...state.connectedUsers];
        // Deduplicate by username — first occurrence wins (preserves priority of new array and selfUser)
        const seen = new Set<string>();
        const deduped = combined.filter(u => {
          if (!u.username) return false;
          const uname = u.username.toLowerCase();
          if (seen.has(uname)) return false;
          seen.add(uname);
          return true;
        });
        return { connectedUsers: deduped };
      }),
      
      syncPresenceHeartbeats: (users) => set((state) => {
        const now = Date.now();
        // Create lookup map of incoming sync payload
        const incomingMap = new Map<string, ConnectedUser>();
        for (const u of users) {
          if (u.username) incomingMap.set(u.username.toLowerCase(), u);
        }

        const merged: ConnectedUser[] = [];
        Array.from(incomingMap.entries()).forEach(([uname, inc]) => {
          const existing = state.connectedUsers.find(e => e.username?.toLowerCase() === uname);
          merged.push({
            userId: inc.userId,
            username: inc.username,
            roleIds: inc.roleIds,
            connectedAt: existing?.connectedAt || inc.lastPing || now,
            lastPing: inc.lastPing || now
          });
        });

        // Cull any entries older than 25 seconds unless it's the local user
        const CUTOFF_MS = 25000;
        const activeOnly = merged.filter(u => {
           if (u.username.toLowerCase() === state.currentUsername.toLowerCase()) return true;
           return (now - (u.lastPing || 0)) < CUTOFF_MS;
        });
        
        // Optimisation: Skip UI re-render if connection counts/contents are identical
        if (activeOnly.length === state.connectedUsers.length) {
            const hasChanges = activeOnly.some((u, i) => 
               u.userId !== state.connectedUsers[i].userId || 
               u.roleIds.join() !== state.connectedUsers[i].roleIds.join()
            );
            if (!hasChanges) return state;
        }

        return { connectedUsers: activeOnly };
      }),

      addConnectedUser: (user) => set((state) => {
        if (!user.username) return state;
        const uname = user.username.toLowerCase();
        const existing = state.connectedUsers.find(u => u.username?.toLowerCase() === uname);
        if (existing) {
          // Update existing entry (e.g. username or roles changed on reconnect)
          return {
            connectedUsers: state.connectedUsers.map(u =>
              u.username?.toLowerCase() === uname ? { ...u, ...user, connectedAt: u.connectedAt } : u
            ),
          };
        }
        return { connectedUsers: [...state.connectedUsers, user] };
      }),
      
      removeConnectedUser: (userId) => set((state) => ({
        // We still support removing by userId primarily because the presence leave event provides it.
        // However, we ideally should remove by username if transport IDs drift.
        // For safety, let's just use the strict userId here since it's targeted.
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
      setCustomJazzUrl: (url) => set({ customJazzUrl: url }),
      setCustomRegistryId: (id) => set({ customRegistryId: id }),
      
      setWebRtcConnection: (peerId, status) => set((state) => {
         const existing = state.webRtcConnections.find(c => c.peerId === peerId);
         if (existing) {
             return { webRtcConnections: state.webRtcConnections.map(c => c.peerId === peerId ? { ...c, status } : c) };
         }
         return { webRtcConnections: [...state.webRtcConnections, { peerId, status }] };
      }),
      
      removeWebRtcConnection: (peerId) => set((state) => ({
         webRtcConnections: state.webRtcConnections.filter(c => c.peerId !== peerId)
      })),
      
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
        activeTransport: null,
        webRtcConnections: [],
        isSyncing: false,
        lastSyncTimestamp: 0,
        syncErrors: [],
        syncReady: false
      })
    }),
    {
      name: 'vtt-multiplayer-storage',
      partialize: (state) => ({
        currentUsername: state.currentUsername,
        currentSession: state.currentSession,
        currentUserId: state.currentUserId,
        roles: state.roles,
        customJazzUrl: state.customJazzUrl,
        customRegistryId: state.customRegistryId,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.connectionStatus = 'disconnected';
            state.connectedUsers = [];
            state.webRtcConnections = [];
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

export const useActiveRoster = (): RosterPeer[] => {
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const currentUsername = useMultiplayerStore((s) => s.currentUsername);
  const roles = useMultiplayerStore((s) => s.roles);
  const webRtcConnections = useMultiplayerStore((s) => s.webRtcConnections);
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);

  return useMemo(() => {
    const roster: RosterPeer[] = [];
    const isHost = roles.includes('dm');

    // 1. Always include local user
    roster.push({
      id: currentUserId || 'local',
      displayName: currentUsername || 'You',
      role: isHost ? 'host' : 'client',
      isLocal: true,
    });

    // 2. Add everyone in connectedUsers (excluding local user)
    connectedUsers.forEach((u) => {
      if (u.userId !== currentUserId) {
        roster.push({
          id: u.userId,
          displayName: u.username,
          role: u.roleIds.includes('dm') ? 'host' : 'client',
          isLocal: false,
        });
      }
    });

    // 3. Identify active WebRTC peers (fallback if not in connectedUsers yet)
    webRtcConnections.forEach((conn) => {
      // Treat anything not cleanly disconnected as active enough to be in the roster
      if (
        conn.status !== 'disconnected' &&
        conn.status !== 'failed' &&
        conn.status !== 'closed'
      ) {
        // If not already in roster from connectedUsers
        if (!roster.some((r) => r.id === conn.peerId)) {
          if (isHost) {
            // We are the host, connected peers are clients
            roster.push({
              id: conn.peerId,
              displayName: `Guest-${conn.peerId.slice(0, 4)}`,
              role: 'client',
              isLocal: false,
            });
          } else {
            // We are a client, connected peers are hosts
            roster.push({
              id: conn.peerId,
              displayName: `Host-${conn.peerId.slice(0, 4)}`,
              role: 'host',
              isLocal: false,
            });
          }
        }
      }
    });

    // Deduplicate roster just in case
    const seen = new Set<string>();
    return roster.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [currentUserId, currentUsername, roles, webRtcConnections, connectedUsers]);
};
