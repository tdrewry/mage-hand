/**
 * Zustand Middleware for JSON Patch Sync
 * Automatically captures state changes, generates JSON patches, and syncs them
 * 
 * This is a framework-agnostic implementation that works with any transport.
 */

import type { StateCreator } from 'zustand';
import { compare, applyPatch, deepClone } from 'fast-json-patch';
import type { 
  SyncMiddlewareConfig, 
  SyncPatchPayload, 
  JsonPatchOperation, 
  TransportAdapter,
  DeduplicationAdapter,
  CreateSyncPatchOptions 
} from './types';
import { MessageDeduplication } from './deduplication';

// Middleware state per store instance
interface MiddlewareState {
  isApplyingRemote: boolean;
  lastState: unknown;
  pendingPatches: JsonPatchOperation[];
  throttleTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Filter patches based on include/exclude paths
 */
function filterPatches(
  patches: JsonPatchOperation[],
  includePaths?: string[],
  excludePaths?: string[]
): JsonPatchOperation[] {
  return patches.filter(patch => {
    const path = patch.path;
    
    // Check exclude paths first
    if (excludePaths?.some(excluded => path.startsWith(`/${excluded}`))) {
      return false;
    }
    
    // If include paths specified, only include matching paths
    if (includePaths && includePaths.length > 0) {
      return includePaths.some(included => path.startsWith(`/${included}`));
    }
    
    return true;
  });
}

/**
 * Create a syncPatch middleware factory with dependency injection
 * 
 * @param options - Transport and deduplication adapters
 * @returns A middleware factory function
 * 
 * @example
 * ```typescript
 * const syncPatch = createSyncPatch({
 *   transport: mySocketTransport,
 *   deduplication: myDeduplicationAdapter, // optional
 * });
 * 
 * const useStore = create(
 *   syncPatch({ channel: 'myChannel' })((set, get) => ({
 *     // ... store definition
 *   }))
 * );
 * ```
 */
export function createSyncPatch(options: CreateSyncPatchOptions) {
  const { transport, deduplication = new MessageDeduplication() } = options;

  /**
   * syncPatch middleware for automatic JSON Patch sync
   */
  return function syncPatch<T>(config: SyncMiddlewareConfig) {
    const {
      channel,
      enabled = true,
      throttleMs = 0,
      excludePaths = [],
      includePaths,
      debug = false,
    } = config;

    return (initializer: StateCreator<T, [], []>): StateCreator<T, [], []> => {
      return (set, get, api) => {
        // Middleware internal state
        const mwState: MiddlewareState = {
          isApplyingRemote: false,
          lastState: null,
          pendingPatches: [],
          throttleTimer: null,
        };

        const log = (...args: unknown[]) => {
          if (debug) {
            console.log(`[SyncPatch:${channel}]`, ...args);
          }
        };

        /**
         * Send patches to other clients
         */
        const sendPatches = (patches: JsonPatchOperation[]) => {
          if (!enabled || patches.length === 0) return;
          
          if (!transport.isConnected()) {
            log('⚠️ Cannot send - not connected');
            return;
          }

          const userId = transport.getUserId();
          if (!userId) {
            log('⚠️ Cannot send - no userId');
            return;
          }

          const payload: SyncPatchPayload = {
            messageId: deduplication.generateMessageId(userId),
            userId,
            channel,
            patches,
            timestamp: Date.now(),
          };

          log('Sending patches:', patches.length, patches);
          transport.send(payload);
        };

        /**
         * Flush pending patches (for throttled sends)
         */
        const flushPatches = () => {
          if (mwState.pendingPatches.length > 0) {
            sendPatches(mwState.pendingPatches);
            mwState.pendingPatches = [];
          }
          mwState.throttleTimer = null;
        };

        /**
         * Queue patches for sending (with optional throttling)
         */
        const queuePatches = (patches: JsonPatchOperation[]) => {
          if (throttleMs > 0) {
            // Accumulate patches and send after throttle delay
            mwState.pendingPatches.push(...patches);
            
            if (!mwState.throttleTimer) {
              mwState.throttleTimer = setTimeout(flushPatches, throttleMs);
            }
          } else {
            // Send immediately
            sendPatches(patches);
          }
        };

        /**
         * Handle incoming patches from other clients
         */
        const handleRemotePatches = (payload: SyncPatchPayload) => {
          const { patches } = payload;
          
          if (patches.length === 0) return;
          
          log('Received patches:', patches.length, patches);

          // Set flag to prevent re-broadcasting our own application
          mwState.isApplyingRemote = true;
          
          try {
            const currentState = get();
            // Deep clone to avoid mutation issues
            const newState = deepClone(currentState);
            
            // Apply patches
            const result = applyPatch(newState, patches, true, false);
            
            // Check for errors
            const errors = result.filter(r => r !== null);
            if (errors.length > 0) {
              console.warn(`[SyncPatch:${channel}] Some patches failed to apply:`, errors);
            }

            // Update state with replace=true
            set(newState as T, true);
            
            // Update last known state
            mwState.lastState = deepClone(newState);
            
            log('Applied remote patches successfully');
          } catch (error) {
            console.error(`[SyncPatch:${channel}] Failed to apply patches:`, error);
          } finally {
            mwState.isApplyingRemote = false;
          }
        };

        // Subscribe to incoming patches for this channel
        if (enabled) {
          transport.subscribe(channel, handleRemotePatches);
        }

        // Create wrapped set function that captures changes
        const syncSet: typeof set = (partial, replace) => {
          // Get state before change
          const prevState = get();
          
          // Apply the change using original set
          set(partial, replace);
          
          // Get state after change
          const nextState = get();

          // Skip if we're applying remote changes (prevent echo)
          if (mwState.isApplyingRemote) {
            mwState.lastState = deepClone(nextState);
            return;
          }

          // Skip if not enabled or not connected
          if (!enabled || !transport.isConnected()) {
            mwState.lastState = deepClone(nextState);
            return;
          }

          // Generate patches
          const allPatches = compare(prevState as object, nextState as object);
          
          // Filter patches based on config
          const filteredPatches = filterPatches(allPatches, includePaths, excludePaths);

          if (filteredPatches.length > 0) {
            log('State changed, generated patches:', filteredPatches.length);
            queuePatches(filteredPatches);
          }

          // Update last known state
          mwState.lastState = deepClone(nextState);
        };

        // Initialize the store with wrapped set
        const initialState = initializer(syncSet, get, api);
        
        // Store initial state
        mwState.lastState = deepClone(initialState);

        return initialState;
      };
    };
  };
}

/**
 * Utility to manually broadcast full state
 * Useful for initial state broadcast when joining a session
 */
export function createBroadcastFullState(
  transport: TransportAdapter,
  deduplication: DeduplicationAdapter
) {
  return function broadcastFullState<T extends object>(
    channel: string,
    state: T
  ): void {
    if (!transport.isConnected()) return;
    
    const userId = transport.getUserId();
    if (!userId) return;

    // Generate patches that would create the entire state from empty
    const patches = compare({} as object, state);

    const payload: SyncPatchPayload = {
      messageId: deduplication.generateMessageId(userId),
      userId,
      channel,
      patches,
      timestamp: Date.now(),
    };

    transport.send(payload);
  };
}
