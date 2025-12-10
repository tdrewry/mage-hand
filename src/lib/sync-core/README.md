# Sync-Core Library

A reusable JSON Patch (RFC 6902) synchronization library for Zustand stores.

## Features

- **Automatic JSON Patch generation** on state changes
- **Pluggable transport adapters** (Socket.io, WebSocket, gRPC, etc.)
- **Built-in message deduplication** with TTL-based expiration
- **Throttling support** for high-frequency updates
- **Path-based filtering** (include/exclude specific state paths)
- **Type-safe** with full TypeScript support
- **Zero project-specific dependencies** - fully reusable

## Installation

This library is part of your project. It has one dependency:

```bash
npm install fast-json-patch
```

## Quick Start

```typescript
import { create } from 'zustand';
import { 
  createSyncPatch, 
  createSocketIOTransport, 
  createDeduplication 
} from '@/lib/sync-core';
import { io } from 'socket.io-client';

// 1. Create transport and deduplication instances
const transport = createSocketIOTransport();
const deduplication = createDeduplication({ ttlMs: 5 * 60 * 1000 });

// 2. Create the middleware factory
const syncPatch = createSyncPatch({ transport, deduplication });

// 3. Use in your Zustand store
const useItemStore = create(
  syncPatch({ 
    channel: 'items',
    throttleMs: 50,
    excludePaths: ['ui', 'local'],
    debug: true
  })((set, get) => ({
    items: [],
    ui: { isLoading: false }, // Not synced (excluded)
    
    addItem: (item) => set((state) => ({ 
      items: [...state.items, item] 
    })),
    
    removeItem: (id) => set((state) => ({ 
      items: state.items.filter(i => i.id !== id) 
    })),
  }))
);

// 4. Connect when socket is ready
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  transport.setSocket(socket);
  transport.setUserId(myUserId);
});

socket.on('disconnect', () => {
  transport.clearSocket();
});
```

## Configuration Options

### SyncMiddlewareConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channel` | `string` | required | Channel name for routing patches |
| `enabled` | `boolean` | `true` | Enable/disable sync |
| `throttleMs` | `number` | `0` | Throttle delay for batching |
| `excludePaths` | `string[]` | `[]` | Paths to exclude from sync |
| `includePaths` | `string[]` | `undefined` | Only sync these paths |
| `debug` | `boolean` | `false` | Enable debug logging |

### DeduplicationConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttlMs` | `number` | `300000` | Message ID TTL (5 min) |
| `cleanupIntervalMs` | `number` | `60000` | Cleanup interval (1 min) |
| `maxEntries` | `number` | `10000` | Max tracked message IDs |

## Server Implementation

The server should relay patches to other clients in the session:

```javascript
// Server-side (Node.js with Socket.io)
socket.on('sync:patch', (payload) => {
  const { channel, patches, messageId, userId, timestamp, targetUserId } = payload;
  
  // Validate payload
  if (!channel || !Array.isArray(patches)) return;
  
  // Get user's session/room
  const session = getSessionBySocket(socket.id);
  if (!session) return;
  
  // Broadcast to other clients in session
  if (targetUserId) {
    // Send to specific user
    const targetSocket = getSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit('sync:patch_received', payload);
    }
  } else {
    // Broadcast to all others
    socket.to(session.id).emit('sync:patch_received', payload);
  }
});
```

## Custom Transport Adapters

Implement the `TransportAdapter` interface for other protocols:

```typescript
import type { TransportAdapter, SyncPatchPayload } from '@/lib/sync-core';

class WebSocketTransport implements TransportAdapter {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Function[]>();
  private userId?: string;

  setSocket(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      this.dispatchToHandlers(payload);
    };
  }

  send(payload: SyncPatchPayload): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  subscribe(channel: string, handler: Function): void {
    const existing = this.handlers.get(channel) || [];
    existing.push(handler);
    this.handlers.set(channel, existing);
  }

  unsubscribe(channel: string): void {
    this.handlers.delete(channel);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  setUserId(id: string) {
    this.userId = id;
  }

  private dispatchToHandlers(payload: SyncPatchPayload) {
    const handlers = this.handlers.get(payload.channel);
    handlers?.forEach(h => h(payload));
  }
}
```

## Using with Persist Middleware

The syncPatch middleware works with Zustand's persist middleware:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    syncPatch({ channel: 'myStore' })((set, get) => ({
      // ... store definition
    })),
    { name: 'my-storage' }
  )
);
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Zustand       │     │   syncPatch      │     │   Transport     │
│   Store         │────▶│   Middleware     │────▶│   Adapter       │
│                 │     │                  │     │   (Socket.io)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │ state changes          │ JSON Patches           │ network
        ▼                        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Components    │     │   Deduplication  │     │   Server        │
│   (React)       │     │   (TTL cache)    │     │   (relay)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## License

MIT
