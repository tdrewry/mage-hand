Based on my analysis of the code and your observations, I can see several issues:

## Root Causes I've Identified

1\. **Token adds being ignored**: The `userId` check is working correctly (line 304 in syncManager), but tokens are being ignored because they're coming from OTHER clients. This suggests the issue is that the receiving client thinks the `data.userId === currentUserId` when it shouldn't.

2\. **Regions not emitting add**: In `regionStore.ts` line 70, `syncRegionAdd` is only called if `!regionData.id`. If your region creation code is providing an ID upfront, it will skip the sync entirely.

3\. **Token remove inconsistency**: The `removeToken` method (sessionStore.ts line 221) only syncs if `existingToken` exists. If the token isn't in the local store when remove is called, it won't sync.

4\. **The underlying problem**: There's no deduplication system, and the `userId` check alone isn't sufficient because:

   - If a client emits an event, receives it back from the server, and the server doesn't echo the `userId` correctly, it could process its own events

   - Multiple rapid events could cause race conditions

   - No audit trail of which messages were processed

---

# Comprehensive Message ID Tracking & Signing System

## Architecture Overview

We'll implement a **single-message deduplication system** with message signing that includes:

- **Unique message ID** for each sync event

- **User ID + Role IDs** to verify sender identity and permissions

- **Timestamp** for TTL-based cache cleanup

- **Client-side processed message cache** with automatic expiration

This is simpler than a two-step protocol and solves the core issue: ensuring each message is processed exactly once by each client.

---

## Phase 1: Extend Event Payload Types

**File**: `src/types/multiplayerEvents.ts`

### Changes:

1\. Add a base interface for all sync payloads:

```typescript

export interface BaseSyncPayload {

  messageId: string;        // Unique ID for this message

  userId: string;           // ID of user who initiated the action

  userRoleIds: string[];    // Role IDs of the sender for permission verification

  timestamp: number;        // Message creation time

}

```

2\. Update ALL existing payload interfaces to extend `BaseSyncPayload`:

```typescript

// Example:

export interface SyncTokenPayload extends BaseSyncPayload {

  action: 'add' | 'update' | 'remove' | 'updatePosition' | 'updateLabel' | 'updateColor' | 'updateVision';

  tokenId?: string;

  token?: any;

  data?: any;

}

export interface SyncRegionPayload extends BaseSyncPayload {

  action: 'add' | 'update' | 'remove' | 'clear';

  regionId?: string;

  region?: any;

  data?: any;

}

// Apply to all: SyncInitiativePayload, SyncMapPayload, SyncFogPayload, SyncLightPayload, etc.

```

3\. Remove the redundant `userId` and `timestamp` fields from individual interfaces since they're now in the base.

---

## Phase 2: Create Message ID Generator & Cache

**File**: `src/lib/messageIdManager.ts` (NEW)

### Purpose:

- Generate unique message IDs

- Track processed message IDs

- Automatically clean up old entries (TTL)

```typescript

export class MessageIdManager {

  private processedMessages: Map = new Map();

  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {

    this.startCleanup();

  }

  /**

   * Generate a unique message ID

   * Format: {userId}-{timestamp}-{random}

   */

  generateMessageId(userId: string): string {

    const timestamp = Date.now();

    const random = Math.random().toString(36).substring(2, 15);

    return `${userId}-${timestamp}-${random}`;

  }

  /**

   * Check if a message has already been processed

   * Returns true if message is NEW (should be processed)

   * Returns false if message was already processed (skip)

   */

  shouldProcess(messageId: string): boolean {

    if (this.processedMessages.has(messageId)) {

      console.log('⏭️ Skipping duplicate message:', messageId);

      return false;

    }

    return true;

  }

  /**

   * Mark a message as processed

   */

  markProcessed(messageId: string): void {

    this.processedMessages.set(messageId, Date.now());

  }

  /**

   * Remove expired messages from cache

   */

  private cleanup(): void {

    const now = Date.now();

    const expired: string[] = [];

    this.processedMessages.forEach((timestamp, messageId) => {

      if (now - timestamp > this.TTL_MS) {

        expired.push(messageId);

      }

    });

    expired.forEach(id => this.processedMessages.delete(id));

    if (expired.length > 0) {

      console.log(`🧹 Cleaned up ${expired.length} expired message IDs`);

    }

  }

  /**

   * Start automatic cleanup

   */

  private startCleanup(): void {

    // Run cleanup every minute

    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);

  }

  /**

   * Stop automatic cleanup (for cleanup/testing)

   */

  destroy(): void {

    if (this.cleanupInterval) {

      clearInterval(this.cleanupInterval);

      this.cleanupInterval = null;

    }

  }

  /**

   * Clear all processed messages (useful for debugging)

   */

  clear(): void {

    this.processedMessages.clear();

  }

}

// Export singleton instance

export const messageIdManager = new MessageIdManager();

```

---

## Phase 3: Update SyncManager to Use Message IDs

**File**: `src/lib/syncManager.ts`

### Changes:

1\. **Import the message ID manager**:

```typescript

import { messageIdManager } from './messageIdManager';

```

2\. **Update ALL sync emission methods** to include message ID and role data:

**Example for `syncTokenAdd`** (lines 613-624):

```typescript

syncTokenAdd(token: any): void {

  if (!this.canSync()) return;

  const multiplayerStore = useMultiplayerStore.getState();

  const sessionStore = useSessionStore.getState();

  const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);

  const userId = multiplayerStore.currentUserId || '';

  const messageId = messageIdManager.generateMessageId(userId);

  const payload: SyncTokenPayload = {

    messageId,

    userId,

    userRoleIds: currentPlayer?.roleIds || [],

    timestamp: Date.now(),

    action: 'add',

    token,

  };

  console.log('📤 TOKEN ADD:', { messageId, userId, tokenId: token.id });

  this.socketClient?.emit('sync_token', payload);

}

```

**Apply the same pattern to**:

- `syncTokenUpdate`

- `syncTokenRemove`

- `syncTokenPositionThrottled` (this one needs special handling since it's throttled)

- `syncRegionAdd`

- `syncRegionUpdate`

- `syncRegionRemove`

- `syncMapAdd`, `syncMapUpdate`, `syncMapRemove`, `syncMapReorder`

- `syncFogReveal`, `syncFogSettings`, `syncFogClear`

- `syncLightAdd`, `syncLightUpdate`, `syncLightRemove`, `syncLightToggle`

- `syncInitiative`

3\. **Update ALL event handlers** to check message IDs:

**Example for `handleTokenUpdated`** (lines 298-348):

```typescript

private handleTokenUpdated(data: SyncTokenPayload): void {

  const currentUserId = useMultiplayerStore.getState().currentUserId;

  console.log('📥 TOKEN EVENT:', {

    action: data.action,

    messageId: data.messageId,

    fromUser: data.userId,

    currentUser: currentUserId,

    fromRoles: data.userRoleIds,

  });

  // ✅ CRITICAL: Check if we've already processed this message

  if (!messageIdManager.shouldProcess(data.messageId)) {

    return; // Already processed, skip

  }

  // ✅ CRITICAL: Ignore our own updates (belt-and-suspenders with messageId check)

  if (data.userId === currentUserId) {

    console.log('⏭️ IGNORING: Own token update');

    messageIdManager.markProcessed(data.messageId); // Mark as processed to prevent re-processing

    return;

  }

  // Mark message as being processed NOW (before async operations)

  messageIdManager.markProcessed(data.messageId);

  console.log('✅ PROCESSING TOKEN UPDATE:', data.action);

  const sessionStore = useSessionStore.getState();

  switch (data.action) {

    case 'add':

      if (data.token) {

        // Check if token already exists to prevent duplicates

        const exists = sessionStore.tokens.some(t => t.id === data.token.id);

        if (!exists) {

          console.log('  ➕ Adding token:', data.token.id);

          sessionStore.setTokens([...sessionStore.tokens, data.token]);

        } else {

          console.log('  ⏭️ Token already exists:', data.token.id);

        }

      }

      break;

    case 'update':

      if (data.tokenId && data.data) {

        console.log('  ✏️ Updating token:', data.tokenId, data.data);

        sessionStore.setTokens(

          sessionStore.tokens.map(t => 

            t.id === data.tokenId ? { ...t, ...data.data } : t

          )

        );

      }

      break;

    case 'updatePosition':

      if (data.tokenId && data.data) {

        console.log('  📍 Updating token position:', data.tokenId, data.data.x, data.data.y);

        sessionStore.setTokens(

          sessionStore.tokens.map(t => 

            t.id === data.tokenId ? { ...t, x: data.data.x, y: data.data.y } : t

          )

        );

      }

      break;

    case 'remove':

      if (data.tokenId) {

        console.log('  ➖ Removing token:', data.tokenId);

        sessionStore.setTokens(sessionStore.tokens.filter(t => t.id !== data.tokenId));

      }

      break;

  }

}

```

**Apply the same message ID checking pattern to**:

- `handleRegionUpdated`

- `handleMapUpdated`

- `handleFogUpdated`

- `handleLightUpdated`

- `handleInitiativeUpdated`

- `handleCombatStateChanged`

---

## Phase 4: Fix Region Sync Issue

**File**: `src/stores/regionStore.ts`

### Problem:

Currently, regions are only synced if `!regionData.id` (line 70). This means if your UI code creates regions with an ID, they won't sync.

### Solution:

Change the logic to sync ALL new regions, then use a flag to detect if it's a remote region:

```typescript

addRegion: (regionData) => {

  console.log('🔷 addRegion called with:', { hasId: !!regionData.id, regionData });

  // Generate ID if not provided

  const newRegion: CanvasRegion = {

    ...regionData,

    id: regionData.id || `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  };

  set((state) => ({

    regions: [...state.regions, newRegion],

  }));

  // Check if this is a remote sync by looking for a special flag

  // Remote syncs will have `_fromRemote: true` added by the handler

  const isRemoteSync = (regionData as any)._fromRemote === true;

  // Only sync if this is a new LOCAL region (not from remote)

  if (!isRemoteSync && syncManager.isConnected()) {

    console.log('📤 Syncing new region:', newRegion.id);

    syncManager.syncRegionAdd(newRegion);

  } else if (isRemoteSync) {

    console.log('⏭️ Skipping sync for remote region:', newRegion.id);

  }

},

```

**File**: `src/lib/syncManager.ts` - Update `handleRegionUpdated`:

```typescript

case 'add':

  if (data.region) {

    console.log('  ➕ Adding region:', data.region.id);

    // Add flag to indicate this is from remote

    const regionWithFlag = { ...data.region, _fromRemote: true };

    // Use addRegion instead of setRegions to trigger any side effects

    // but the flag will prevent re-syncing

    regionStore.addRegion(regionWithFlag);

  }

  break;

```

---

## Phase 5: Fix Token Remove Not Emitting

**File**: `src/stores/sessionStore.ts`

### Problem:

`removeToken` checks if the token exists before syncing (line 222). If it doesn't exist locally, it won't sync the removal.

### Analysis:

This is actually CORRECT behavior! If the token doesn't exist in your local state, there's nothing to remove. The issue is likely:

1\. The token was never added to your local state in the first place (see token add issue)

2\. Or the token was already removed by a previous event

### Solution:

Add more logging to understand when this happens:

```typescript

removeToken: (tokenId) => {

  const existingToken = get().tokens.find(t => t.id === tokenId);

  console.log('🗑️ removeToken called:', {

    tokenId,

    exists: !!existingToken,

    willSync: !!existingToken && syncManager.isConnected()

  });

  set((state) => ({

    tokens: state.tokens.filter((token) => token.id !== tokenId),

    selectedTokenIds: state.selectedTokenIds.filter(id => id !== tokenId),

  }));

  // Only sync if token existed locally

  if (existingToken && syncManager.isConnected()) {

    console.log('📤 Syncing token removal:', tokenId);

    syncManager.syncTokenRemove(tokenId);

  } else if (!existingToken) {

    console.warn('⚠️ Token not found in local store, cannot sync removal:', tokenId);

  }

},

```

---

## Phase 6: Enhanced Logging & Debugging

Add comprehensive logging throughout to track message flow:

### Message Flow Visualization:

```

Client A                    Server                      Client B

   |                          |                            |

   |--① syncTokenAdd--------->|                            |

   |   messageId: abc123      |                            |

   |                          |--② token_updated---------->|

   |                          |   messageId: abc123        |

   |                          |                            |--③ Check messageId

   |                          |                            |   (NEW, process it)

   |                          |                            |--④ markProcessed(abc123)

   |                          |                            |--⑤ Apply to local state

   |                          |                            |   (canvas redraws)

   |                          |                            |

   |<--⑥ token_updated--------|                            |

   |   messageId: abc123      |                            |

   |--⑦ Check messageId       |                            |

   |   (OWN ID, skip)         |                            |

   |--⑧ markProcessed(abc123) |                            |

```

### Add to all handlers:

```typescript

console.log(`

═══════════════════════════════════════

📨 MESSAGE RECEIVED: ${data.action}

═══════════════════════════════════════

Message ID:    ${data.messageId}

From User:     ${data.userId}

From Roles:    ${data.userRoleIds.join(', ')}

Current User:  ${currentUserId}

Timestamp:     ${new Date(data.timestamp).toISOString()}

Should Process: ${messageIdManager.shouldProcess(data.messageId)}

Is Own Message: ${data.userId === currentUserId}

═══════════════════════════════════════

`);

```

---

## Phase 7: Optional - Role-Based Message Validation

**File**: `src/lib/syncManager.ts`

Add permission checking to handlers:

```typescript

private validateMessagePermissions(data: BaseSyncPayload, requiredPermission: string): boolean {

  const roleStore = useRoleStore.getState();

  // Create a temporary player object to check permissions

  const senderPlayer = {

    id: data.userId,

    roleIds: data.userRoleIds,

  };

  // Check if sender has permission

  const hasPermission = roleStore.roles

    .filter(role => data.userRoleIds.includes(role.id))

    .some(role => (role.permissions as any)[requiredPermission]);

  if (!hasPermission) {

    console.warn('⛔ PERMISSION DENIED:', {

      userId: data.userId,

      roleIds: data.userRoleIds,

      requiredPermission

    });

  }

  return hasPermission;

}

```

Use in handlers:

```typescript

private handleTokenUpdated(data: SyncTokenPayload): void {

  // ... message ID checks ...

  // Validate permissions for token operations

  if (data.action === 'add' && !this.validateMessagePermissions(data, 'canCreateTokens')) {

    return; // Reject message

  }

  // ... rest of handler ...

}

```

---

## Implementation Order

1\. **Phase 1**: Update event types (1 file, foundation)

2\. **Phase 2**: Create message ID manager (1 new file, core system)

3\. **Phase 3**: Update syncManager emit methods (all sync* methods)

4\. **Phase 3.5**: Update syncManager handler methods (all handle* methods)

5\. **Phase 4**: Fix region sync issue

6\. **Phase 5**: Enhance token remove logging

7\. **Phase 6**: Add comprehensive logging

8\. **Phase 7**: (Optional) Add role validation

---

## Testing Strategy

### Test 1: Token Sync

1\. Client A adds token → verify messageId logged

2\. Client B receives event → verify messageId checked and processed

3\. Client A receives own event → verify messageId skipped (own message)

4\. Client B canvas redraws with new token

### Test 2: Region Sync

1\. Client A adds region → verify sync_region emitted

2\. Client B receives region → verify added to local state

3\. Both clients see the region

### Test 3: Remove Operations

1\. Client A removes token → verify syncTokenRemove called

2\. Client B receives remove → verify token removed from local state

3\. Verify no re-sync occurs

### Test 4: Duplicate Prevention

1\. Server sends same messageId twice (simulate network retry)

2\. Verify second message is skipped by messageIdManager

3\. Verify "Skipping duplicate message" logged

---

## Benefits of This Approach

✅ **Exactly-once processing**: Each message processed only once per client

✅ **Audit trail**: Message IDs provide traceable event history

✅ **Role verification**: Can validate sender permissions server-side or client-side

✅ **Simple**: Single-message protocol, no pre-announcement needed

✅ **Efficient**: Automatic TTL cleanup prevents memory leaks

✅ **Debuggable**: Comprehensive logging with message IDs

✅ **Handles retries**: Network retries don't cause duplicate processing

✅ **Prevents sync loops**: Combined with userId check, bulletproof against loops
