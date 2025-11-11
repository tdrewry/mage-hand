import { SocketClient } from './socketClient';
import { throttle } from './throttle';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useRoleStore } from '@/stores/roleStore';
import { hasPermission } from './rolePermissions';
import type {
  JoinSessionPayload,
  CreateSessionPayload,
  SessionJoinedPayload,
  UserJoinedPayload,
  UserLeftPayload,
  FullStateSyncPayload,
  SyncTokenPayload,
  SyncInitiativePayload,
  TokenUpdatedPayload,
  SessionErrorPayload
} from '@/types/multiplayerEvents';

/**
 * Central synchronization manager for multiplayer functionality
 * Coordinates state changes between local stores and Socket.io server
 */
class SyncManager {
  private socketClient: SocketClient | null = null;
  private isInitialized: boolean = false;
  private throttledSyncTokenPosition: ((tokenId: string, x: number, y: number) => void) | null = null;

  /**
   * Initialize the sync manager with server URL
   */
  async initialize(serverUrl: string): Promise<void> {
    if (this.isInitialized) {
      console.warn('SyncManager already initialized');
      return;
    }

    console.log('🚀 Initializing SyncManager with server:', serverUrl);

    // Create socket client
    this.socketClient = new SocketClient({ serverUrl });

    // Setup status callback
    this.socketClient.onStatusChange((status) => {
      useMultiplayerStore.getState().setConnectionStatus(status);
    });

    // Setup event handlers
    this.setupEventHandlers();

    // Create throttled token position sync (100ms = 10 updates/sec max)
    this.throttledSyncTokenPosition = throttle((tokenId: string, x: number, y: number) => {
      this.syncTokenPosition(tokenId, x, y);
    }, 100);

    this.isInitialized = true;
  }

  /**
   * Connect to server and join/create session
   */
  async connect(): Promise<void> {
    if (!this.socketClient) {
      throw new Error('SyncManager not initialized');
    }

    await this.socketClient.connect();
  }

  /**
   * Create a new session
   */
  async createSession(username: string, password?: string): Promise<void> {
    if (!this.socketClient?.isConnected()) {
      throw new Error('Not connected to server');
    }

    const payload: CreateSessionPayload = {
      username,
      password
    };

    this.socketClient.emit('create_session', payload);
    
    // Response handled by 'session_created' event
  }

  /**
   * Join an existing session
   */
  async joinSession(sessionCode: string, username: string, password?: string): Promise<void> {
    if (!this.socketClient?.isConnected()) {
      throw new Error('Not connected to server');
    }

    const payload: JoinSessionPayload = {
      sessionCode,
      username,
      password
    };

    useMultiplayerStore.getState().setCurrentUsername(username);
    this.socketClient.emit('join_session', payload);
    
    // Response handled by 'session_joined' event
  }

  /**
   * Leave current session
   */
  leaveSession(): void {
    if (!this.socketClient?.isConnected()) {
      return;
    }

    this.socketClient.emit('leave_session');
    useMultiplayerStore.getState().reset();
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.socketClient?.disconnect();
    useMultiplayerStore.getState().reset();
  }

  /**
   * Setup all event handlers for server messages
   */
  private setupEventHandlers(): void {
    if (!this.socketClient) return;

    // Session events
    this.socketClient.on<SessionJoinedPayload>('session_joined', this.handleSessionJoined.bind(this));
    this.socketClient.on<SessionJoinedPayload>('session_created', this.handleSessionJoined.bind(this));
    this.socketClient.on<UserJoinedPayload>('user_joined', this.handleUserJoined.bind(this));
    this.socketClient.on<UserLeftPayload>('user_left', this.handleUserLeft.bind(this));
    this.socketClient.on<SessionErrorPayload>('session_error', this.handleSessionError.bind(this));

    // State sync events
    this.socketClient.on<FullStateSyncPayload>('full_state_sync', this.handleFullStateSync.bind(this));
    this.socketClient.on<TokenUpdatedPayload>('token_updated', this.handleTokenUpdated.bind(this));
    this.socketClient.on('token_added', this.handleTokenAdded.bind(this));
    this.socketClient.on('token_removed', this.handleTokenRemoved.bind(this));
    this.socketClient.on('initiative_updated', this.handleInitiativeUpdated.bind(this));
    this.socketClient.on('combat_state_changed', this.handleCombatStateChanged.bind(this));

    // User management
    this.socketClient.on('user_list_updated', this.handleUserListUpdated.bind(this));
    this.socketClient.on('user_role_changed', this.handleUserRoleChanged.bind(this));
  }

  // ============= Event Handlers =============

  private handleSessionJoined(data: SessionJoinedPayload): void {
    console.log('✅ Session joined:', data);

    const multiplayerStore = useMultiplayerStore.getState();
    
    multiplayerStore.setCurrentSession({
      sessionCode: data.sessionCode,
      sessionId: data.sessionId,
      createdAt: Date.now(),
      hasPassword: false // Server should provide this
    });

    multiplayerStore.setCurrentUserId(data.yourUserId);
    multiplayerStore.setConnectedUsers(data.users);

    // Request full state sync
    this.socketClient?.emit('request_full_sync');
  }

  private handleUserJoined(data: UserJoinedPayload): void {
    console.log('👋 User joined:', data.user.username);
    useMultiplayerStore.getState().addConnectedUser(data.user);
  }

  private handleUserLeft(data: UserLeftPayload): void {
    console.log('👋 User left:', data.username);
    useMultiplayerStore.getState().removeConnectedUser(data.userId);
  }

  private handleSessionError(data: SessionErrorPayload): void {
    console.error('❌ Session error:', data.message);
    useMultiplayerStore.getState().addSyncError(data.message);
  }

  private handleFullStateSync(data: FullStateSyncPayload): void {
    console.log('📦 Received full state sync');

    const sessionStore = useSessionStore.getState();
    const initiativeStore = useInitiativeStore.getState();

    // Apply tokens
    if (data.tokens && data.tokens.length > 0) {
      sessionStore.clearAllTokens();
      data.tokens.forEach(token => sessionStore.addToken(token));
    }

    // Apply initiative
    if (data.initiative) {
      initiativeStore.setInitiativeOrder(data.initiative.initiativeOrder || []);
      if (data.initiative.isInCombat) {
        initiativeStore.startCombat();
        initiativeStore.setCurrentTurn(data.initiative.currentTurnIndex);
      }
    }

    // Apply connected users
    if (data.players) {
      useMultiplayerStore.getState().setConnectedUsers(data.players);
    }

    useMultiplayerStore.getState().updateLastSyncTimestamp();
  }

  private handleTokenUpdated(data: TokenUpdatedPayload): void {
    const sessionStore = useSessionStore.getState();
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    // Ignore our own updates (already applied locally)
    if (data.userId === currentUserId) {
      return;
    }

    console.log('🔄 Token updated from remote:', data.action);

    switch (data.action) {
      case 'updatePosition':
        if (data.tokenId && data.data) {
          sessionStore.updateTokenPosition(data.tokenId, data.data.x, data.data.y);
        }
        break;
      case 'updateLabel':
        if (data.tokenId && data.data) {
          sessionStore.updateTokenLabel(data.tokenId, data.data.label);
        }
        break;
      case 'updateColor':
        if (data.tokenId && data.data) {
          sessionStore.updateTokenColor(data.tokenId, data.data.color);
        }
        break;
      case 'updateVision':
        if (data.tokenId && data.data) {
          sessionStore.updateTokenVision(data.tokenId, data.data.hasVision);
        }
        break;
    }
  }

  private handleTokenAdded(data: any): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;
    if (data.userId === currentUserId) return;

    console.log('➕ Token added from remote');
    useSessionStore.getState().addToken(data.token);
  }

  private handleTokenRemoved(data: any): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;
    if (data.userId === currentUserId) return;

    console.log('➖ Token removed from remote');
    useSessionStore.getState().removeToken(data.tokenId);
  }

  private handleInitiativeUpdated(data: SyncInitiativePayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;
    if (data.userId === currentUserId) return;

    console.log('🎲 Initiative updated from remote:', data.action);
    const initiativeStore = useInitiativeStore.getState();

    switch (data.action) {
      case 'add':
        if (data.data) {
          initiativeStore.addToInitiative(data.data.tokenId, data.data.initiative);
        }
        break;
      case 'remove':
        if (data.data) {
          initiativeStore.removeFromInitiative(data.data.tokenId);
        }
        break;
      case 'nextTurn':
        initiativeStore.nextTurn();
        break;
      case 'previousTurn':
        initiativeStore.previousTurn();
        break;
    }
  }

  private handleCombatStateChanged(data: any): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;
    if (data.userId === currentUserId) return;

    console.log('⚔️ Combat state changed from remote');
    const initiativeStore = useInitiativeStore.getState();

    if (data.isInCombat) {
      initiativeStore.startCombat();
    } else {
      initiativeStore.endCombat();
    }
  }

  private handleUserListUpdated(data: any): void {
    console.log('👥 User list updated');
    useMultiplayerStore.getState().setConnectedUsers(data.users);
  }

  private handleUserRoleChanged(data: any): void {
    console.log('🎭 User role changed:', data.userId);
    useMultiplayerStore.getState().updateUserRoles(data.userId, data.roleIds);
  }

  // ============= Sync Methods (Local → Server) =============

  /**
   * Sync token position (throttled)
   */
  syncTokenPositionThrottled(tokenId: string, x: number, y: number): void {
    if (this.throttledSyncTokenPosition) {
      this.throttledSyncTokenPosition(tokenId, x, y);
    }
  }

  /**
   * Internal token position sync (called by throttled version)
   */
  private syncTokenPosition(tokenId: string, x: number, y: number): void {
    if (!this.canSync()) return;

    const payload: SyncTokenPayload = {
      action: 'updatePosition',
      tokenId,
      data: { x, y },
      timestamp: Date.now(),
      userId: useMultiplayerStore.getState().currentUserId || ''
    };

    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync token addition
   */
  syncTokenAdd(token: any): void {
    if (!this.canSync()) return;

    const payload: SyncTokenPayload = {
      action: 'add',
      token,
      timestamp: Date.now(),
      userId: useMultiplayerStore.getState().currentUserId || ''
    };

    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync token removal
   */
  syncTokenRemove(tokenId: string): void {
    if (!this.canSync()) return;

    const payload: SyncTokenPayload = {
      action: 'remove',
      tokenId,
      timestamp: Date.now(),
      userId: useMultiplayerStore.getState().currentUserId || ''
    };

    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync initiative changes
   */
  syncInitiative(action: string, data?: any): void {
    if (!this.canSync()) return;

    const payload: SyncInitiativePayload = {
      action: action as any,
      data,
      timestamp: Date.now(),
      userId: useMultiplayerStore.getState().currentUserId || ''
    };

    this.socketClient?.emit('sync_initiative', payload);
  }

  /**
   * Check if we can sync (connected + have permission)
   */
  private canSync(): boolean {
    if (!this.socketClient?.isConnected()) {
      console.warn('Cannot sync - not connected');
      return false;
    }

    return true;
  }

  /**
   * Check if user has permission for action
   */
  checkPermission(action: string): boolean {
    const sessionStore = useSessionStore.getState();
    const roleStore = useRoleStore.getState();
    const multiplayerStore = useMultiplayerStore.getState();

    const currentPlayer = sessionStore.players.find(
      p => p.id === multiplayerStore.currentUserId
    );

    if (!currentPlayer) return false;

    // Map actions to permission keys
    const permissionMap: Record<string, string> = {
      'token.add': 'canCreateTokens',
      'token.update': 'canControlOwnTokens',
      'token.delete': 'canDeleteOwnTokens',
      'initiative.manage': 'canManageInitiative',
      'map.edit': 'canEditMap',
      'fog.manage': 'canManageFog',
    };

    const permissionKey = permissionMap[action];
    if (!permissionKey) return true; // Allow if no specific permission required

    return hasPermission(currentPlayer, roleStore.roles, permissionKey as any);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): string {
    return this.socketClient?.getStatus() || 'disconnected';
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socketClient?.isConnected() || false;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
