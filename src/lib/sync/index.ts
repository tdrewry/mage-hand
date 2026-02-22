/**
 * Project-specific Sync System
 * 
 * NOTE: The old Socket.IO-based sync has been removed.
 * State synchronization now goes through src/lib/net/ (WebSocket JSON protocol).
 * This module provides no-op stubs so stores that previously used syncPatch middleware
 * continue to compile and function without the Socket.IO transport.
 */

import type { StateCreator } from 'zustand';
import type { SyncMiddlewareConfig } from '../sync-core';

/**
 * No-op syncPatch middleware stub.
 * Returns the store creator unchanged (passthrough).
 */
export function syncPatch<T>(_config: Partial<SyncMiddlewareConfig> & { channel: string }) {
  return (creator: StateCreator<T, [], []>): StateCreator<T, [], []> => creator;
}

/**
 * No-op patchTransport stub for modules that referenced it.
 */
export const patchTransport = {
  setSocket: (_socket: unknown) => {},
  clearSocket: () => {},
  getSocket: () => null as unknown,
  getUserId: () => undefined as string | undefined,
  setUserId: (_id: string) => {},
};

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
