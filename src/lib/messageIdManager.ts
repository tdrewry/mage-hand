/**
 * Message ID Manager
 * Prevents duplicate processing of sync events by tracking processed message IDs
 * Uses TTL-based cache to automatically clean up old entries
 */

export class MessageIdManager {
  private processedMessages: Map<string, number> = new Map();
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

  /**
   * Get current cache size
   */
  getCacheSize(): number {
    return this.processedMessages.size;
  }
}

// Export singleton instance
export const messageIdManager = new MessageIdManager();
