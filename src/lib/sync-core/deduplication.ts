/**
 * Built-in Message Deduplication
 * Simple TTL-based message ID tracking for preventing duplicate processing
 */

import type { DeduplicationAdapter } from './types';

export interface DeduplicationConfig {
  /** Time-to-live for message IDs in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Cleanup interval in milliseconds (default: 1 minute) */
  cleanupIntervalMs?: number;
  /** Maximum number of tracked message IDs (default: 10000) */
  maxEntries?: number;
}

/**
 * Default message deduplication implementation
 * Uses a Map with TTL-based expiration for memory efficiency
 */
export class MessageDeduplication implements DeduplicationAdapter {
  private processedIds: Map<string, number> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private counter = 0;
  
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(config: DeduplicationConfig = {}) {
    this.ttlMs = config.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxEntries = config.maxEntries ?? 10000;
    
    // Start cleanup interval
    const cleanupIntervalMs = config.cleanupIntervalMs ?? 60 * 1000; // 1 minute
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(userId: string): string {
    this.counter++;
    return `${userId}-${Date.now()}-${this.counter}`;
  }

  /**
   * Check if a message should be processed (not already processed)
   */
  shouldProcess(messageId: string): boolean {
    return !this.processedIds.has(messageId);
  }

  /**
   * Mark a message as processed
   */
  markProcessed(messageId: string): void {
    // Evict oldest entries if at capacity
    if (this.processedIds.size >= this.maxEntries) {
      const oldestKey = this.processedIds.keys().next().value;
      if (oldestKey) {
        this.processedIds.delete(oldestKey);
      }
    }
    
    this.processedIds.set(messageId, Date.now());
  }

  /**
   * Clean up expired message IDs
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredBefore = now - this.ttlMs;
    
    for (const [id, timestamp] of this.processedIds.entries()) {
      if (timestamp < expiredBefore) {
        this.processedIds.delete(id);
      }
    }
  }

  /**
   * Dispose of the deduplication instance
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.processedIds.clear();
  }

  /**
   * Get current statistics
   */
  getStats(): { trackedCount: number; maxEntries: number; ttlMs: number } {
    return {
      trackedCount: this.processedIds.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
    };
  }
}

/**
 * Create a default deduplication adapter
 */
export function createDeduplication(config?: DeduplicationConfig): MessageDeduplication {
  return new MessageDeduplication(config);
}
