import { io, Socket } from 'socket.io-client';
import type { 
  ClientEventName, 
  ServerEventName
} from '@/types/multiplayerEvents';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface SocketClientConfig {
  serverUrl: string;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
}

export class SocketClient {
  private socket: Socket | null = null;
  private config: Required<SocketClientConfig>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private eventHandlers: Map<ServerEventName, Set<(...args: any[]) => void>> = new Map();
  private statusCallback: ((status: ConnectionStatus) => void) | null = null;

  constructor(config: SocketClientConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      reconnectionAttempts: config.reconnectionAttempts ?? 5,
      reconnectionDelay: config.reconnectionDelay ?? 2000,
      reconnectionDelayMax: config.reconnectionDelayMax ?? 30000,
    };
    this.maxReconnectAttempts = this.config.reconnectionAttempts;
  }

  /**
   * Connect to Socket.io server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.warn('Socket already connected');
      return;
    }

    this.updateStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.config.reconnectionAttempts,
          reconnectionDelay: this.config.reconnectionDelay,
          reconnectionDelayMax: this.config.reconnectionDelayMax,
          timeout: 10000,
        });

        this.setupInternalHandlers();
        this.registerPendingHandlers();

        this.socket.on('connect', () => {
          console.log('✅ Socket connected:', this.socket?.id);
          this.reconnectAttempts = 0;
          this.updateStatus('connected');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error);
          this.updateStatus('error');
          reject(error);
        });

      } catch (error) {
        console.error('❌ Failed to create socket:', error);
        this.updateStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Register all pending event handlers with the socket
   */
  private registerPendingHandlers(): void {
    if (!this.socket) return;
    
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket!.on(event, handler);
      });
    });
    
    console.log(`📡 Registered ${this.eventHandlers.size} event handlers`);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.updateStatus('disconnected');
      console.log('🔌 Socket disconnected');
    }
  }

  /**
   * Setup internal event handlers for connection lifecycle
   */
  private setupInternalHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket disconnected:', reason);
      this.updateStatus('disconnected');

      // Auto-reconnect for certain reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - attempt reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
      this.updateStatus('connected');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
      this.updateStatus('reconnecting');
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error);
      this.updateStatus('error');
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed - max attempts reached');
      this.updateStatus('error');
    });
  }

  /**
   * Attempt manual reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.updateStatus('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectionDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.reconnectionDelayMax
    );

    console.log(`🔄 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.updateStatus('reconnecting');

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Emit event to server
   */
  emit<T = any>(event: ClientEventName, data?: T): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot emit - socket not connected:', event);
      return;
    }

    console.log('📤 Emitting:', event, data);
    this.socket.emit(event, data);
  }

  /**
   * Register event handler
   */
  on<T = any>(event: ServerEventName, handler: (data: T) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    this.eventHandlers.get(event)!.add(handler);

    // Register with socket
    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  /**
   * Unregister event handler
   */
  off(event: ServerEventName, handler?: (...args: any[]) => void): void {
    if (handler) {
      this.eventHandlers.get(event)?.delete(handler);
      this.socket?.off(event, handler);
    } else {
      // Remove all handlers for event
      this.eventHandlers.delete(event);
      this.socket?.off(event);
    }
  }

  /**
   * Register connection status callback
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  /**
   * Update connection status and notify callback
   */
  private updateStatus(status: ConnectionStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get raw socket instance (for patch transport integration)
   */
  getSocket(): typeof this.socket {
    return this.socket;
  }
}
