/**
 * Base Transport Implementation
 * Provides common functionality for transport adapters
 */

import type { TransportAdapter, SyncPatchPayload, DeduplicationAdapter } from '../types';

type PatchHandler = (payload: SyncPatchPayload) => void;

/**
 * Abstract base class for transport adapters
 * Handles channel subscription management
 */
export abstract class BaseTransport implements TransportAdapter {
  protected handlers: Map<string, PatchHandler[]> = new Map();
  protected deduplication?: DeduplicationAdapter;
  protected currentUserId?: string;

  constructor(options?: { deduplication?: DeduplicationAdapter }) {
    this.deduplication = options?.deduplication;
  }

  /**
   * Set the current user ID
   */
  setUserId(userId: string | undefined): void {
    this.currentUserId = userId;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | undefined {
    return this.currentUserId;
  }

  /**
   * Subscribe to incoming patches for a channel
   */
  subscribe(channel: string, handler: PatchHandler): void {
    const existing = this.handlers.get(channel) || [];
    existing.push(handler);
    this.handlers.set(channel, existing);
  }

  /**
   * Unsubscribe from incoming patches
   */
  unsubscribe(channel: string): void {
    this.handlers.delete(channel);
  }

  /**
   * Dispatch incoming payload to registered handlers
   */
  protected dispatchToHandlers(payload: SyncPatchPayload): void {
    const { channel, messageId, userId } = payload;

    // Skip if this is our own message
    if (userId === this.currentUserId) {
      return;
    }

    // Deduplicate if adapter provided
    if (this.deduplication) {
      if (!this.deduplication.shouldProcess(messageId)) {
        return;
      }
      this.deduplication.markProcessed(messageId);
    }

    // Dispatch to channel handlers
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[Transport] Error in handler for channel ${channel}:`, error);
        }
      });
    }
  }

  // Abstract methods to be implemented by specific transports
  abstract send(payload: SyncPatchPayload): void;
  abstract isConnected(): boolean;
}
