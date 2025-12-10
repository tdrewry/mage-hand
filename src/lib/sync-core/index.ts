/**
 * Sync-Core Library
 * 
 * A reusable JSON Patch (RFC 6902) synchronization library for Zustand stores.
 * Provides automatic state diffing, patch generation, and real-time sync
 * across clients via pluggable transport adapters.
 * 
 * Features:
 * - Automatic JSON Patch generation on state changes
 * - Pluggable transport adapters (Socket.io, WebSocket, gRPC, etc.)
 * - Built-in message deduplication with TTL
 * - Throttling support for high-frequency updates
 * - Path-based include/exclude filtering
 * - Type-safe with full TypeScript support
 * 
 * @example
 * ```typescript
 * import { createSyncPatch, createSocketIOTransport, createDeduplication } from '@/lib/sync-core';
 * import { create } from 'zustand';
 * 
 * // Create transport and deduplication
 * const transport = createSocketIOTransport();
 * const deduplication = createDeduplication();
 * 
 * // Create the middleware factory
 * const syncPatch = createSyncPatch({ transport, deduplication });
 * 
 * // Use in your store
 * const useMyStore = create(
 *   syncPatch({ channel: 'myChannel', throttleMs: 50 })((set, get) => ({
 *     items: [],
 *     addItem: (item) => set((state) => ({ items: [...state.items, item] })),
 *   }))
 * );
 * 
 * // Connect socket when ready
 * transport.setSocket(mySocketClient);
 * transport.setUserId(currentUserId);
 * ```
 */

// Core middleware
export { createSyncPatch, createBroadcastFullState } from './middleware';

// Deduplication
export { 
  MessageDeduplication, 
  createDeduplication,
  type DeduplicationConfig 
} from './deduplication';

// Transport adapters
export { 
  BaseTransport,
  SocketIOTransport, 
  createSocketIOTransport,
  DEFAULT_SEND_EVENT,
  DEFAULT_RECEIVE_EVENT,
  type SocketIOTransportConfig,
} from './transports';

// Types
export type {
  JsonPatchOperation,
  SyncPatchPayload,
  SyncMiddlewareConfig,
  TransportAdapter,
  DeduplicationAdapter,
  SyncState,
  SyncEventType,
  SyncEvent,
  CreateSyncPatchOptions,
} from './types';
