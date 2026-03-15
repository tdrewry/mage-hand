// ============= Base Payload Interface =============

/**
 * Base interface for all sync payloads
 * Includes message ID for deduplication and role IDs for permission verification
 */
export interface BaseSyncPayload {
  messageId: string;        // Unique ID for this message (for deduplication)
  userId: string;           // ID of user who initiated the action
  userRoleIds: string[];    // Role IDs of the sender for permission verification
  timestamp: number;        // Message creation time
}

// ============= Client → Server Events =============

export interface JoinSessionPayload {
  sessionCode: string;
  password?: string;
  username: string;
  roleIds?: string[]; // Optional initial role assignment
}

export interface CreateSessionPayload {
  password?: string;
  username: string;
}

// State sync payloads
export interface SyncTokenPayload extends BaseSyncPayload {
  action: 'add' | 'update' | 'remove' | 'updatePosition' | 'updateLabel' | 'updateColor' | 'updateVision';
  tokenId?: string;
  token?: any; // Full token for 'add'
  data?: any;  // Partial data for updates (x, y, label, etc.)
}

export interface SyncInitiativePayload extends BaseSyncPayload {
  action: 'start' | 'end' | 'add' | 'remove' | 'nextTurn' | 'previousTurn' | 'updateOrder';
  data?: any;
}

export interface SyncCombatPayload extends BaseSyncPayload {
  action: 'startCombat' | 'endCombat' | 'setTurn';
  data?: any;
}

export interface SyncFogPayload extends BaseSyncPayload {
  action: 'reveal' | 'conceal' | 'clear' | 'update';
  data: any;
}

export interface SyncLightPayload extends BaseSyncPayload {
  action: 'add' | 'update' | 'remove' | 'toggle';
  lightId?: string;
  light?: any; // Full light for 'add'
  data?: any; // Partial data for updates
}

export interface SyncRolePayload {
  action: 'assign' | 'unassign';
  userId: string;
  roleIds: string[];
  timestamp: number;
  senderId: string;
  messageId: string;
  userRoleIds: string[];
}

export interface SyncMapPayload extends BaseSyncPayload {
  action: 'add' | 'update' | 'remove' | 'reorder';
  mapId?: string;
  map?: any; // Full map for 'add'
  data?: any; // Partial data for updates
}

export interface SyncRegionPayload extends BaseSyncPayload {
  action: 'add' | 'update' | 'remove' | 'clear';
  regionId?: string;
  region?: any; // Full region for 'add'
  data?: any; // Partial data for updates
}

// ============= RPC Events (Remote Procedure Calls) =============

export interface SetUiModePayload {
  messageId: string;
  mode: 'dm' | 'play';
  targetUserId?: string; // If undefined, broadcast to all
  timestamp: number;
  senderId: string;
  senderRoleIds: string[];
}

export interface OpenCardPayload {
  messageId: string;
  cardType: string;
  targetUserId?: string;
  timestamp: number;
  senderId: string;
  senderRoleIds: string[];
}

export interface SyncInitiativeOrderPayload extends BaseSyncPayload {
  action: 'set_order';
  initiativeOrder: any[];
}

export interface RequestFullStatePayload {
  messageId: string;
  timestamp: number;
  senderId: string;
  senderRoleIds: string[];
}

export interface BroadcastFullStatePayload {
  messageId: string;
  timestamp: number;
  senderId: string;
  senderRoleIds: string[];
  targetUserId?: string; // If undefined, broadcast to all
}

// ============= Server → Client Events =============

export interface SessionJoinedPayload {
  sessionCode: string;
  sessionId: string;
  users: ConnectedUser[];
  yourUserId: string;
}

export interface UserJoinedPayload {
  user: ConnectedUser;
}

export interface UserLeftPayload {
  userId: string;
  username: string;
}

export interface ConnectedUser {
  userId: string;
  username: string;
  roleIds: string[];
  connectedAt: number;
  lastPing?: number;
  socketId?: string; // Server-side only
}

export interface FullStateSyncPayload {
  tokens: any[];
  initiative: {
    isInCombat: boolean;
    currentTurnIndex: number;
    roundNumber: number;
    initiativeOrder: any[];
  };
  maps?: any[];
  regions?: any[];
  fog?: any;
  lights?: any[];
  roles?: any[];
  players: ConnectedUser[];
  sessionMetadata: {
    sessionCode: string;
    createdAt: number;
  };
}

export interface SessionErrorPayload {
  code: 'NOT_FOUND' | 'INVALID_PASSWORD' | 'PERMISSION_DENIED' | 'SERVER_ERROR';
  message: string;
}

// Token update events
export interface TokenUpdatedPayload extends SyncTokenPayload {}
export interface TokenAddedPayload {
  token: any;
  userId: string;
  timestamp: number;
}
export interface TokenRemovedPayload {
  tokenId: string;
  userId: string;
  timestamp: number;
}

// Initiative events
export interface InitiativeUpdatedPayload extends SyncInitiativePayload {}
export interface CombatStateChangedPayload {
  isInCombat: boolean;
  currentTurnIndex: number;
  roundNumber: number;
  timestamp: number;
}

// User management
export interface UserListUpdatedPayload {
  users: ConnectedUser[];
}

export interface UserRoleChangedPayload {
  userId: string;
  roleIds: string[];
  timestamp: number;
}

// ============= Event Names (for type safety) =============

export const ClientEvents = {
  // Session management
  CREATE_SESSION: 'create_session',
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  
  // State sync
  SYNC_TOKEN: 'sync_token',
  SYNC_INITIATIVE: 'sync_initiative',
  SYNC_COMBAT: 'sync_combat',
  SYNC_FOG: 'sync_fog',
  SYNC_ROLE: 'sync_role',
  SYNC_MAP: 'sync_map',
  SYNC_REGION: 'sync_region',
  SYNC_LIGHT: 'sync_light',
  
  // RPC commands
  RPC_SET_UI_MODE: 'rpc_set_ui_mode',
  RPC_OPEN_CARD: 'rpc_open_card',
  RPC_SYNC_INITIATIVE_ORDER: 'rpc_sync_initiative_order',
  RPC_REQUEST_FULL_STATE: 'rpc_request_full_state',
  RPC_BROADCAST_FULL_STATE: 'rpc_broadcast_full_state',
  
  // Requests
  REQUEST_FULL_SYNC: 'request_full_sync',
  KICK_USER: 'kick_user',
} as const;

export const ServerEvents = {
  // Session events
  SESSION_CREATED: 'session_created',
  SESSION_JOINED: 'session_joined',
  SESSION_LEFT: 'session_left',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  SESSION_ERROR: 'session_error',
  
  // State sync
  FULL_STATE_SYNC: 'full_state_sync',
  TOKEN_UPDATED: 'token_updated',
  TOKEN_ADDED: 'token_added',
  TOKEN_REMOVED: 'token_removed',
  INITIATIVE_UPDATED: 'initiative_updated',
  COMBAT_STATE_CHANGED: 'combat_state_changed',
  TURN_CHANGED: 'turn_changed',
  FOG_UPDATED: 'fog_updated',
  ROLE_ASSIGNED: 'role_assigned',
  MAP_UPDATED: 'map_updated',
  REGION_UPDATED: 'region_updated',
  LIGHT_UPDATED: 'light_updated',
  ROLE_UPDATED: 'role_updated',
  
  // RPC events
  UI_MODE_CHANGED: 'ui_mode_changed',
  CARD_OPENED: 'card_opened',
  INITIATIVE_ORDER_SYNCED: 'initiative_order_synced',
  FULL_STATE_REQUESTED: 'full_state_requested',
  FULL_STATE_BROADCASTED: 'full_state_broadcasted',
  
  // User management
  USER_LIST_UPDATED: 'user_list_updated',
  USER_ROLE_CHANGED: 'user_role_changed',
} as const;

export type ClientEventName = typeof ClientEvents[keyof typeof ClientEvents];
export type ServerEventName = typeof ServerEvents[keyof typeof ServerEvents];
