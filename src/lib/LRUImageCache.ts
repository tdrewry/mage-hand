/**
 * LRU (Least Recently Used) Image Cache
 * 
 * Caps memory usage by evicting least-recently-accessed images
 * when the cache exceeds maxSize. Uses a Map (insertion-ordered)
 * with manual reordering on access to maintain LRU order.
 */
export class LRUImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get(key: string): HTMLImageElement | undefined {
    const img = this.cache.get(key);
    if (img) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, img);
    }
    return img;
  }

  set(key: string, img: HTMLImageElement): void {
    // If already exists, delete first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, img);

    // Evict oldest entries if over capacity
    while (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const evicted = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        // Clear src to help GC release the decoded image data
        if (evicted) {
          evicted.onload = null;
          evicted.onerror = null;
          evicted.src = '';
        }
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    for (const img of this.cache.values()) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
    }
    this.cache.clear();
  }
}
