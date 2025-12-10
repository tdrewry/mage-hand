/**
 * Project-specific Sync System
 * Bridges the generic sync-core library with project dependencies
 */

import { 
  createSyncPatch as createSyncPatchCore,
  createBroadcastFullState as createBroadcastFullStateCore,
  createSocketIOTransport,
  createDeduplication,
  type SyncMiddlewareConfig,
  type TransportAdapter
} from '../sync-core';
import { messageIdManager } from '../messageIdManager';
import { useMultiplayerStore } from '@/stores/multiplayerStore';

// Create a custom deduplication adapter that wraps our existing messageIdManager
const projectDeduplication = {
  generateMessageId: (userId: string) => messageIdManager.generateMessageId(userId),
  shouldProcess: (messageId: string) => messageIdManager.shouldProcess(messageId),
  markProcessed: (messageId: string) => messageIdManager.markProcessed(messageId),
};

// Create transport with project deduplication
const transport = createSocketIOTransport({
  deduplication: projectDeduplication,
});

// Override getUserId to use the multiplayer store
const originalGetUserId = transport.getUserId.bind(transport);
transport.getUserId = () => {
  return useMultiplayerStore.getState().currentUserId || undefined;
};

/**
 * Project transport instance
 * Use setSocket() after connection and clearSocket() on disconnect
 */
export const patchTransport = transport;

/**
 * syncPatch middleware factory
 * Pre-configured with project transport and deduplication
 */
export const syncPatch = createSyncPatchCore({
  transport: patchTransport,
  deduplication: projectDeduplication,
});

/**
 * Broadcast full state for a channel
 */
export const broadcastFullState = createBroadcastFullStateCore(
  patchTransport,
  projectDeduplication
);

// Re-export types from sync-core
export type {
  JsonPatchOperation,
  SyncPatchPayload,
  SyncMiddlewareConfig,
  TransportAdapter,
  SyncState,
  SyncEventType,
  SyncEvent,
} from '../sync-core';

// Re-export event names
export { DEFAULT_SEND_EVENT, DEFAULT_RECEIVE_EVENT } from '../sync-core';
