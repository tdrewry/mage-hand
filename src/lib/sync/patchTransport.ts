/**
 * Socket.io Transport Adapter for JSON Patch Sync
 * Bridges the sync middleware to the existing syncManager/socketClient
 */

import type { TransportAdapter, SyncPatchPayload } from './types';
import { messageIdManager } from '../messageIdManager';
import { useMultiplayerStore } from '@/stores/multiplayerStore';

// Event names for patch sync
export const PATCH_SEND_EVENT = 'sync:patch';
export const PATCH_RECEIVE_EVENT = 'sync:patch_received';

type PatchHandler = (payload: SyncPatchPayload) => void;

/**
 * Patch Transport - handles sending/receiving JSON patches
 * Designed to be initialized with a socket reference from syncManager
 */
class PatchTransport implements TransportAdapter {
  private handlers: Map<string, PatchHandler[]> = new Map();
  private socket: any = null;
  private isListening = false;

  /**
   * Initialize transport with a socket instance
   * Called by syncManager after connection
   */
  setSocket(socket: any): void {
    this.socket = socket;
    this.setupListener();
  }

  /**
   * Clear socket reference on disconnect
   */
  clearSocket(): void {
    this.socket = null;
    this.isListening = false;
  }

  private setupListener(): void {
    if (this.isListening || !this.socket) return;
    
    // Listen for incoming patches from server
    this.socket.on(PATCH_RECEIVE_EVENT, (payload: SyncPatchPayload) => {
      this.handleIncomingPatch(payload);
    });
    
    this.isListening = true;
  }

  private handleIncomingPatch(payload: SyncPatchPayload): void {
    const { channel, messageId, userId } = payload;
    
    // Skip if this is our own message
    const currentUserId = this.getUserId();
    if (userId === currentUserId) {
      return;
    }

    // Deduplicate using messageIdManager
    if (!messageIdManager.shouldProcess(messageId)) {
      console.debug(`[PatchTransport] Skipping duplicate message: ${messageId}`);
      return;
    }
    messageIdManager.markProcessed(messageId);

    // Dispatch to channel handlers
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[PatchTransport] Error in handler for channel ${channel}:`, error);
        }
      });
    }
  }

  send(payload: SyncPatchPayload): void {
    if (!this.isConnected()) {
      console.debug('[PatchTransport] Not connected, skipping send');
      return;
    }

    // Generate message ID if not provided
    if (!payload.messageId) {
      payload.messageId = messageIdManager.generateMessageId(payload.userId);
    }

    // Mark our own message as processed to prevent echo
    messageIdManager.markProcessed(payload.messageId);

    this.socket.emit(PATCH_SEND_EVENT, payload);
  }

  subscribe(channel: string, handler: PatchHandler): void {
    const existing = this.handlers.get(channel) || [];
    existing.push(handler);
    this.handlers.set(channel, existing);
  }

  unsubscribe(channel: string): void {
    this.handlers.delete(channel);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getUserId(): string | undefined {
    return useMultiplayerStore.getState().currentUserId || undefined;
  }
}

// Singleton instance
export const patchTransport = new PatchTransport();
