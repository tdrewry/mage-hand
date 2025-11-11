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
export interface SyncTokenPayload {
  action: 'add' | 'update' | 'remove' | 'updatePosition' | 'updateLabel' | 'updateColor' | 'updateVision';
  tokenId?: string;
  token?: any; // Full token for 'add'
  data?: any;  // Partial data for updates (x, y, label, etc.)
  timestamp: number;
  userId: string;
}

export interface SyncInitiativePayload {
  action: 'start' | 'end' | 'add' | 'remove' | 'nextTurn' | 'previousTurn' | 'updateOrder';
  data?: any;
  timestamp: number;
  userId: string;
}

export interface SyncCombatPayload {
  action: 'startCombat' | 'endCombat' | 'setTurn';
  data?: any;
  timestamp: number;
  userId: string;
}

export interface SyncFogPayload {
  action: 'reveal' | 'conceal' | 'clear';
  data: any;
  timestamp: number;
  userId: string;
}

export interface SyncRolePayload {
  action: 'assign' | 'unassign';
  userId: string;
  roleIds: string[];
  timestamp: number;
  senderId: string;
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
  fog?: any;
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
  
  // User management
  USER_LIST_UPDATED: 'user_list_updated',
  USER_ROLE_CHANGED: 'user_role_changed',
} as const;

export type ClientEventName = typeof ClientEvents[keyof typeof ClientEvents];
export type ServerEventName = typeof ServerEvents[keyof typeof ServerEvents];
