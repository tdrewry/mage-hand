/**
 * JSON Patch Sync Types
 * RFC 6902 compliant JSON Patch types and sync middleware configuration
 */

import type { Operation } from 'fast-json-patch';

// Re-export the Operation type from fast-json-patch
export type JsonPatchOperation = Operation;

/**
 * Payload for sync patch events
 */
export interface SyncPatchPayload {
  /** Unique message ID for deduplication */
  messageId: string;
  /** User ID of the sender */
  userId: string;
  /** Channel/store name (e.g., 'tokens', 'regions', 'maps') */
  channel: string;
  /** JSON Patch operations to apply */
  patches: JsonPatchOperation[];
  /** Timestamp of the change */
  timestamp: number;
  /** Optional: target specific user */
  targetUserId?: string;
}

/**
 * Configuration for the sync patch middleware
 */
export interface SyncMiddlewareConfig {
  /** Channel name for this store (e.g., 'tokens', 'regions') */
  channel: string;
  /** Whether sync is enabled (default: true) */
  enabled?: boolean;
  /** Throttle delay in ms for high-frequency updates (default: 0) */
  throttleMs?: number;
  /** Paths to exclude from sync (e.g., ['ui', 'local']) */
  excludePaths?: string[];
  /** Paths to include in sync (if set, only these paths are synced) */
  includePaths?: string[];
  /** Whether to log sync operations for debugging */
  debug?: boolean;
}

/**
 * Transport adapter interface for pluggable transports
 */
export interface TransportAdapter {
  /** Send patches to other clients */
  send(payload: SyncPatchPayload): void;
  /** Subscribe to incoming patches */
  subscribe(channel: string, handler: (payload: SyncPatchPayload) => void): void;
  /** Unsubscribe from incoming patches */
  unsubscribe(channel: string): void;
  /** Check if connected */
  isConnected(): boolean;
  /** Get current user ID */
  getUserId(): string | undefined;
}

/**
 * State for tracking sync middleware internals
 */
export interface SyncState {
  /** Flag to prevent echo loops when applying remote patches */
  isApplyingRemote: boolean;
  /** Last known state for generating diffs */
  lastState: unknown;
  /** Pending patches to be sent (for batching) */
  pendingPatches: JsonPatchOperation[];
  /** Throttle timer ID */
  throttleTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Events emitted by the sync system
 */
export type SyncEventType = 
  | 'sync:connected'
  | 'sync:disconnected'
  | 'sync:patch_sent'
  | 'sync:patch_received'
  | 'sync:patch_applied'
  | 'sync:error';

export interface SyncEvent {
  type: SyncEventType;
  channel?: string;
  payload?: unknown;
  error?: Error;
}
