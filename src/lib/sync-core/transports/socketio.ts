/**
 * Socket.io Transport Adapter
 * Generic Socket.io transport for JSON Patch sync
 */

import type { SyncPatchPayload, DeduplicationAdapter } from '../types';
import { BaseTransport } from './base';

// Default event names
export const DEFAULT_SEND_EVENT = 'sync:patch';
export const DEFAULT_RECEIVE_EVENT = 'sync:patch_received';

export interface SocketIOTransportConfig {
  /** Deduplication adapter (optional) */
  deduplication?: DeduplicationAdapter;
  /** Event name for sending patches (default: 'sync:patch') */
  sendEvent?: string;
  /** Event name for receiving patches (default: 'sync:patch_received') */
  receiveEvent?: string;
}

/**
 * Socket.io Transport Adapter
 * Works with any Socket.io client instance
 */
export class SocketIOTransport extends BaseTransport {
  private socket: any = null;
  private isListening = false;
  private readonly sendEvent: string;
  private readonly receiveEvent: string;

  constructor(config: SocketIOTransportConfig = {}) {
    super({ deduplication: config.deduplication });
    this.sendEvent = config.sendEvent ?? DEFAULT_SEND_EVENT;
    this.receiveEvent = config.receiveEvent ?? DEFAULT_RECEIVE_EVENT;
  }

  /**
   * Initialize transport with a socket instance
   */
  setSocket(socket: any): void {
    this.socket = socket;
    this.setupListener();
  }

  /**
   * Clear socket reference on disconnect
   */
  clearSocket(): void {
    if (this.socket && this.isListening) {
      this.socket.off(this.receiveEvent);
    }
    this.socket = null;
    this.isListening = false;
  }

  private setupListener(): void {
    if (this.isListening || !this.socket) return;
    
    // Listen for incoming patches from server
    this.socket.on(this.receiveEvent, (payload: SyncPatchPayload) => {
      this.dispatchToHandlers(payload);
    });
    
    this.isListening = true;
  }

  send(payload: SyncPatchPayload): void {
    if (!this.isConnected()) {
      return;
    }

    // Mark our own message as processed to prevent echo
    if (this.deduplication && payload.messageId) {
      this.deduplication.markProcessed(payload.messageId);
    }

    this.socket.emit(this.sendEvent, payload);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

/**
 * Create a Socket.io transport adapter
 */
export function createSocketIOTransport(config?: SocketIOTransportConfig): SocketIOTransport {
  return new SocketIOTransport(config);
}
