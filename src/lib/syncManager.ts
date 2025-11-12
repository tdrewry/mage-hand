import { SocketClient } from './socketClient';
import { throttle } from './throttle';
import { messageIdManager } from './messageIdManager';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useRoleStore } from '@/stores/roleStore';
import { useMapStore } from '@/stores/mapStore';
import { useFogStore } from '@/stores/fogStore';
import { useRegionStore } from '@/stores/regionStore';
import { useLightStore } from '@/stores/lightStore';
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
  SyncMapPayload,
  SyncFogPayload,
  SyncRegionPayload,
  SyncLightPayload,
  SyncRolePayload,
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
    this.socketClient.on<SyncTokenPayload>('token_updated', this.handleTokenUpdated.bind(this));
    this.socketClient.on('initiative_updated', this.handleInitiativeUpdated.bind(this));
    this.socketClient.on('combat_state_changed', this.handleCombatStateChanged.bind(this));
    this.socketClient.on('map_updated', this.handleMapUpdated.bind(this));
    this.socketClient.on('fog_updated', this.handleFogUpdated.bind(this));
    this.socketClient.on('region_updated', this.handleRegionUpdated.bind(this));
    this.socketClient.on('light_updated', this.handleLightUpdated.bind(this));
    this.socketClient.on('role_updated', this.handleRoleUpdated.bind(this));

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

    // If this is the first user (session creator), sync local maps to server
    if (data.users.length === 1) {
      console.log('📤 Syncing initial map state to server');
      const mapStore = useMapStore.getState();
      mapStore.maps.forEach(map => {
        this.syncMapAdd(map);
      });
    }

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
    console.log('📦 Received full state sync', {
      tokensCount: data.tokens?.length || 0,
      mapsCount: data.maps?.length || 0,
      playersCount: data.players?.length || 0
    });

    const sessionStore = useSessionStore.getState();
    const initiativeStore = useInitiativeStore.getState();
    const mapStore = useMapStore.getState();
    const currentUserId = useMultiplayerStore.getState().currentUserId;

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

    // Apply maps (only if we received maps from server)
    if (data.maps && data.maps.length > 0) {
      console.log('🗺️ Replacing local maps with', data.maps.length, 'maps from server');
      
      // Directly set the maps state without triggering sync
      // This is safe because we're receiving authoritative server state
      const set = (mapStore as any)._set || ((mapStore as any).setState);
      if (set) {
        set({ 
          maps: data.maps,
          selectedMapId: data.maps[0]?.id || null 
        });
      }
    }

    // Apply fog settings
    if (data.fog) {
      console.log('🌫️ Applying fog state from server');
      const fogStore = useFogStore.getState();
      const set = (fogStore as any)._set || ((fogStore as any).setState);
      if (set) {
        set(data.fog);
      }
    }

    // Apply regions
    if (data.regions && data.regions.length > 0) {
      console.log('🗺️ Applying regions from server');
      const regionStore = useRegionStore.getState();
      regionStore.setRegions(data.regions);
    }

    // Apply lights
    if (data.lights) {
      console.log('💡 Applying lights from server');
      const lightStore = useLightStore.getState();
      const set = (lightStore as any)._set || ((lightStore as any).setState);
      if (set) {
        set({ lights: data.lights });
      }
    }

    // Apply roles
    if (data.roles && data.roles.length > 0) {
      console.log('🔐 Applying roles from server');
      const roleStore = useRoleStore.getState();
      const set = (roleStore as any)._set || ((roleStore as any).setState);
      if (set) {
        set({ roles: data.roles });
      }
    }

    // Apply connected users
    if (data.players) {
      useMultiplayerStore.getState().setConnectedUsers(data.players);
    }

    useMultiplayerStore.getState().updateLastSyncTimestamp();
  }

  private handleTokenUpdated(data: SyncTokenPayload): void {
    const sessionStore = useSessionStore.getState();
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 TOKEN EVENT:', {
      action: data.action,
      messageId: data.messageId,
      fromUser: data.userId,
      currentUser: currentUserId,
      fromRoles: data.userRoleIds,
    });

    // ✅ CRITICAL: Check if we've already processed this message
    if (!messageIdManager.shouldProcess(data.messageId)) {
      return; // Already processed, skip
    }

    // ✅ CRITICAL: Ignore our own updates (belt-and-suspenders with messageId check)
    if (data.userId === currentUserId) {
      console.log('⏭️ IGNORING: Own token update');
      messageIdManager.markProcessed(data.messageId); // Mark as processed to prevent re-processing
      return;
    }

    // Mark message as being processed NOW (before async operations)
    messageIdManager.markProcessed(data.messageId);

    console.log('✅ PROCESSING TOKEN UPDATE:', data.action);

    switch (data.action) {
      case 'add':
        if (data.token) {
          // Check if token already exists to prevent duplicates
          const exists = sessionStore.tokens.some(t => t.id === data.token.id);
          if (!exists) {
            console.log('  ➕ Adding token:', data.token.id);
            sessionStore.setTokens([...sessionStore.tokens, data.token]);
          } else {
            console.log('  ⏭️ Token already exists:', data.token.id);
          }
        }
        break;
      case 'update':
        if (data.tokenId && data.data) {
          console.log('  ✏️ Updating token:', data.tokenId, data.data);
          sessionStore.setTokens(
            sessionStore.tokens.map(t => 
              t.id === data.tokenId ? { ...t, ...data.data } : t
            )
          );
        }
        break;
      case 'updatePosition':
        if (data.tokenId && data.data) {
          console.log('  📍 Updating token position:', data.tokenId, data.data.x, data.data.y);
          sessionStore.setTokens(
            sessionStore.tokens.map(t => 
              t.id === data.tokenId ? { ...t, x: data.data.x, y: data.data.y } : t
            )
          );
        }
        break;
      case 'remove':
        if (data.tokenId) {
          console.log('  ➖ Removing token:', data.tokenId);
          sessionStore.setTokens(sessionStore.tokens.filter(t => t.id !== data.tokenId));
        }
        break;
    }
  }

  private handleInitiativeUpdated(data: SyncInitiativePayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 INITIATIVE EVENT:', {
      action: data.action,
      messageId: data.messageId,
      fromUser: data.userId,
      currentUser: currentUserId,
    });

    // Check message ID
    if (!messageIdManager.shouldProcess(data.messageId)) {
      return;
    }

    // Ignore own updates
    if (data.userId === currentUserId) {
      console.log('⏭️ IGNORING: Own initiative update');
      messageIdManager.markProcessed(data.messageId);
      return;
    }

    messageIdManager.markProcessed(data.messageId);
    console.log('✅ PROCESSING INITIATIVE UPDATE:', data.action);
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

  private handleMapUpdated(data: SyncMapPayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 MAP EVENT:', {
      action: data.action,
      messageId: data.messageId,
      fromUser: data.userId,
      currentUser: currentUserId,
    });

    if (!messageIdManager.shouldProcess(data.messageId)) {
      return;
    }

    if (data.userId === currentUserId) {
      console.log('⏭️ IGNORING: Own map update');
      messageIdManager.markProcessed(data.messageId);
      return;
    }

    messageIdManager.markProcessed(data.messageId);
    console.log('✅ PROCESSING MAP UPDATE:', data.action);
    const mapStore = useMapStore.getState();
    const set = (mapStore as any)._set || ((mapStore as any).setState);

    switch (data.action) {
      case 'add':
        if (data.map && set) {
          console.log('  ➕ Adding map:', data.map.name);
          set({ maps: [...mapStore.maps, data.map] });
        }
        break;
      case 'update':
        if (data.mapId && data.data && set) {
          console.log('  ✏️ Updating map:', data.mapId);
          set({
            maps: mapStore.maps.map((map) =>
              map.id === data.mapId ? { ...map, ...data.data } : map
            )
          });
        }
        break;
      case 'remove':
        if (data.mapId && set) {
          console.log('  ➖ Removing map:', data.mapId);
          const newMaps = mapStore.maps.filter((map) => map.id !== data.mapId);
          set({
            maps: newMaps,
            selectedMapId: mapStore.selectedMapId === data.mapId ? newMaps[0]?.id || null : mapStore.selectedMapId
          });
        }
        break;
      case 'reorder':
        if (data.data?.fromIndex !== undefined && data.data?.toIndex !== undefined && set) {
          console.log('  🔄 Reordering maps:', data.data.fromIndex, '->', data.data.toIndex);
          const newMaps = [...mapStore.maps];
          const [removed] = newMaps.splice(data.data.fromIndex, 1);
          newMaps.splice(data.data.toIndex, 0, removed);
          
          // Update z-indices
          newMaps.forEach((map, index) => {
            map.zIndex = index;
          });
          
          set({ maps: newMaps });
        }
        break;
    }
  }

  private handleFogUpdated(data: SyncFogPayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 FOG EVENT:', {
      action: data.action,
      messageId: data.messageId,
      fromUser: data.userId,
      currentUser: currentUserId,
    });

    if (!messageIdManager.shouldProcess(data.messageId)) {
      return;
    }

    if (data.userId === currentUserId) {
      console.log('⏭️ IGNORING: Own fog update');
      messageIdManager.markProcessed(data.messageId);
      return;
    }

    messageIdManager.markProcessed(data.messageId);
    console.log('✅ PROCESSING FOG UPDATE:', data.action);

    switch (data.action) {
      case 'reveal':
        if (data.data?.serializedExploredAreas !== undefined) {
          console.log('  👁️ Applying fog reveals from remote');
          // Use the store's internal setState directly from the module
          useFogStore.setState({ serializedExploredAreas: data.data.serializedExploredAreas });
        }
        break;
      case 'update':
        console.log('  ⚙️ Applying fog settings from remote');
        // Use the store's internal setState directly from the module
        useFogStore.setState(data.data);
        break;
      case 'clear':
        console.log('  🧹 Clearing fog from remote');
        // Use the store's internal setState directly from the module
        useFogStore.setState({ serializedExploredAreas: '' });
        break;
    }
  }

  private handleRegionUpdated(data: SyncRegionPayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 REGION EVENT:', {
      action: data.action,
      messageId: data.messageId,
      fromUser: data.userId,
      currentUser: currentUserId,
    });

    if (!messageIdManager.shouldProcess(data.messageId)) {
      return;
    }

    if (data.userId === currentUserId) {
      console.log('⏭️ IGNORING: Own region update');
      messageIdManager.markProcessed(data.messageId);
      return;
    }

    messageIdManager.markProcessed(data.messageId);
    console.log('✅ PROCESSING REGION UPDATE:', data.action);
    const regionStore = useRegionStore.getState();

    switch (data.action) {
      case 'add':
        if (data.region) {
          console.log('  ➕ Adding region:', data.region.id);
          // Add flag to indicate this is from remote to prevent re-syncing
          const regionWithFlag = { ...data.region, _fromRemote: true };
          regionStore.addRegion(regionWithFlag);
        }
        break;
      case 'update':
        if (data.regionId && data.data) {
          // Directly update state without triggering sync
          regionStore.setRegions(
            regionStore.regions.map(r => 
              r.id === data.regionId ? { ...r, ...data.data } : r
            )
          );
        }
        break;
      case 'remove':
        if (data.regionId) {
          // Directly update state without triggering sync
          regionStore.setRegions(regionStore.regions.filter(r => r.id !== data.regionId));
        }
        break;
      case 'clear':
        regionStore.clearRegions();
        break;
    }
  }

  private handleLightUpdated(data: SyncLightPayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 LIGHT EVENT:', {
      action: data.action,
      messageId: data.messageId,
      fromUser: data.userId,
      currentUser: currentUserId,
    });

    if (!messageIdManager.shouldProcess(data.messageId)) {
      return;
    }

    if (data.userId === currentUserId) {
      console.log('⏭️ IGNORING: Own light update');
      messageIdManager.markProcessed(data.messageId);
      return;
    }

    messageIdManager.markProcessed(data.messageId);
    console.log('✅ PROCESSING LIGHT UPDATE:', data.action);
    const lightStore = useLightStore.getState();

    switch (data.action) {
      case 'add':
        if (data.light) {
          // Directly update state without triggering sync
          lightStore.setLights([...lightStore.lights, data.light]);
        }
        break;
      case 'update':
        if (data.lightId && data.data) {
          // Directly update state without triggering sync
          lightStore.setLights(
            lightStore.lights.map(l => 
              l.id === data.lightId ? { ...l, ...data.data } : l
            )
          );
        }
        break;
      case 'remove':
        if (data.lightId) {
          // Directly update state without triggering sync
          lightStore.setLights(lightStore.lights.filter(l => l.id !== data.lightId));
        }
        break;
      case 'toggle':
        if (data.lightId) {
          // Directly update state without triggering sync
          lightStore.setLights(
            lightStore.lights.map(l => 
              l.id === data.lightId ? { ...l, enabled: !l.enabled } : l
            )
          );
        }
        break;
    }
  }

  private handleRoleUpdated(data: SyncRolePayload): void {
    const currentUserId = useMultiplayerStore.getState().currentUserId;

    console.log('📥 ROLE EVENT:', {
      action: data.action,
      messageId: data.messageId,
      senderId: data.senderId,
      currentUser: currentUserId,
    });

    if (!messageIdManager.shouldProcess(data.messageId)) {
      return;
    }

    if (data.senderId === currentUserId) {
      console.log('⏭️ IGNORING: Own role update');
      messageIdManager.markProcessed(data.messageId);
      return;
    }

    messageIdManager.markProcessed(data.messageId);
    console.log('✅ PROCESSING ROLE UPDATE:', data.action);
    
    // Update the user's roles in the multiplayer store
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

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncTokenPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'updatePosition',
      tokenId,
      data: { x, y },
    };

    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync token addition
   */
  syncTokenAdd(token: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncTokenPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'add',
      token,
    };

    console.log('📤 TOKEN ADD:', { messageId, userId, tokenId: token.id });
    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync token update (non-position changes)
   */
  syncTokenUpdate(tokenId: string, updates: Partial<any>): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncTokenPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'update',
      tokenId,
      data: updates,
    };

    console.log('📤 TOKEN UPDATE:', { messageId, userId, tokenId });
    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync token removal
   */
  syncTokenRemove(tokenId: string): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncTokenPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'remove',
      tokenId,
    };

    console.log('📤 TOKEN REMOVE:', { messageId, userId, tokenId });
    this.socketClient?.emit('sync_token', payload);
  }

  /**
   * Sync initiative changes
   */
  syncInitiative(action: string, data?: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncInitiativePayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: action as any,
      data,
    };

    console.log('📤 INITIATIVE:', { messageId, userId, action });
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

  // ============= Map Sync Methods =============

  /**
   * Sync map addition
   */
  syncMapAdd(map: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncMapPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'add',
      map,
    };

    console.log('📤 MAP ADD:', { messageId, userId, mapId: map.id });
    this.socketClient?.emit('sync_map', payload);
  }

  /**
   * Sync map update
   */
  syncMapUpdate(mapId: string, data: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncMapPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'update',
      mapId,
      data,
    };

    console.log('📤 MAP UPDATE:', { messageId, userId, mapId });
    this.socketClient?.emit('sync_map', payload);
  }

  /**
   * Sync map removal
   */
  syncMapRemove(mapId: string): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncMapPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'remove',
      mapId,
    };

    console.log('📤 MAP REMOVE:', { messageId, userId, mapId });
    this.socketClient?.emit('sync_map', payload);
  }

  /**
   * Sync map reorder
   */
  syncMapReorder(fromIndex: number, toIndex: number): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncMapPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'reorder',
      data: { fromIndex, toIndex },
    };

    console.log('📤 MAP REORDER:', { messageId, userId, fromIndex, toIndex });
    this.socketClient?.emit('sync_map', payload);
  }

  // ============= Fog Sync Methods =============

  /**
   * Sync fog reveals (explored areas)
   */
  syncFogReveal(serializedData: string): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncFogPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'reveal',
      data: { serializedExploredAreas: serializedData },
    };

    console.log('📤 FOG REVEAL:', { messageId, userId });
    this.socketClient?.emit('sync_fog', payload);
  }

  /**
   * Sync fog settings changes
   */
  syncFogSettings(settings: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncFogPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'update',
      data: settings,
    };

    console.log('📤 FOG SETTINGS:', { messageId, userId });
    this.socketClient?.emit('sync_fog', payload);
  }

  /**
   * Clear all fog
   */
  syncFogClear(): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncFogPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'clear',
      data: {},
    };

    console.log('📤 FOG CLEAR:', { messageId, userId });
    this.socketClient?.emit('sync_fog', payload);
  }

  // ============= Region Sync Methods =============

  syncRegionAdd(region: any): void {
    console.log('🔷 syncRegionAdd called, canSync:', this.canSync());
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncRegionPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'add',
      region,
    };

    console.log('📤 REGION ADD:', { messageId, userId, regionId: region.id });
    this.socketClient?.emit('sync_region', payload);
  }

  syncRegionUpdate(regionId: string, data: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncRegionPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'update',
      regionId,
      data,
    };

    console.log('📤 REGION UPDATE:', { messageId, userId, regionId });
    this.socketClient?.emit('sync_region', payload);
  }

  syncRegionRemove(regionId: string): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncRegionPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'remove',
      regionId,
    };

    console.log('📤 REGION REMOVE:', { messageId, userId, regionId });
    this.socketClient?.emit('sync_region', payload);
  }

  // ============= Light Sync Methods =============

  syncLightAdd(light: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncLightPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'add',
      light,
    };

    console.log('📤 LIGHT ADD:', { messageId, userId, lightId: light.id });
    this.socketClient?.emit('sync_light', payload);
  }

  syncLightUpdate(lightId: string, data: any): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncLightPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'update',
      lightId,
      data,
    };

    console.log('📤 LIGHT UPDATE:', { messageId, userId, lightId });
    this.socketClient?.emit('sync_light', payload);
  }

  syncLightRemove(lightId: string): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncLightPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'remove',
      lightId,
    };

    console.log('📤 LIGHT REMOVE:', { messageId, userId, lightId });
    this.socketClient?.emit('sync_light', payload);
  }

  syncLightToggle(lightId: string): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const userId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(userId);

    const payload: SyncLightPayload = {
      messageId,
      userId,
      userRoleIds: currentPlayer?.roleIds || [],
      timestamp: Date.now(),
      action: 'toggle',
      lightId,
    };

    console.log('📤 LIGHT TOGGLE:', { messageId, userId, lightId });
    this.socketClient?.emit('sync_light', payload);
  }

  // ============= Role Sync Methods =============

  syncRoleAssign(userId: string, roleIds: string[]): void {
    if (!this.canSync()) return;

    const multiplayerStore = useMultiplayerStore.getState();
    const sessionStore = useSessionStore.getState();
    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);
    
    const senderId = multiplayerStore.currentUserId || '';
    const messageId = messageIdManager.generateMessageId(senderId);

    const payload: SyncRolePayload = {
      messageId,
      userRoleIds: currentPlayer?.roleIds || [],
      action: 'assign',
      userId,
      roleIds,
      timestamp: Date.now(),
      senderId,
    };

    console.log('📤 ROLE ASSIGN:', { messageId, senderId, targetUserId: userId, roleIds });
    this.socketClient?.emit('sync_role', payload);
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
