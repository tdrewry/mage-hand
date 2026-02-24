// src/lib/net/ephemeral/TTLCache.ts
// Generic TTL cache: stores ephemeral state entries that auto-expire.
// Key = composite string (e.g. "cursor.update::userId123").

export interface TTLEntry<T> {
  data: T;
  userId: string;
  updatedAt: number;
  expiresAt: number;
}

/**
 * TTLCache stores ephemeral overlay state keyed by a composite string.
 * Entries expire after their TTL and are cleaned up lazily + periodically.
 *
 * Designed for "latest wins" semantics: setting a key overwrites any
 * previous value regardless of ordering.
 */
export class TTLCache<T = unknown> {
  private entries = new Map<string, TTLEntry<T>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private onChange?: (key: string, entry: TTLEntry<T> | null) => void;

  constructor(opts?: { onChange?: (key: string, entry: TTLEntry<T> | null) => void }) {
    this.onChange = opts?.onChange;
  }

  /** Set or overwrite an entry. If ttlMs <= 0 the entry never expires. */
  set(key: string, data: T, userId: string, ttlMs: number): void {
    // Clear existing timer for this key
    const prev = this.timers.get(key);
    if (prev !== undefined) clearTimeout(prev);

    const now = Date.now();
    const entry: TTLEntry<T> = {
      data,
      userId,
      updatedAt: now,
      expiresAt: ttlMs > 0 ? now + ttlMs : Infinity,
    };

    this.entries.set(key, entry);

    // Schedule expiry
    if (ttlMs > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttlMs);
      this.timers.set(key, timer);
    }

    this.onChange?.(key, entry);
  }

  /** Get an entry if it exists and hasn't expired. */
  get(key: string): TTLEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== Infinity && Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Delete an entry and fire onChange with null. */
  delete(key: string): boolean {
    const timer = this.timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(key);

    const existed = this.entries.delete(key);
    if (existed) {
      this.onChange?.(key, null);
    }
    return existed;
  }

  /** Get all non-expired entries. */
  values(): Array<{ key: string } & TTLEntry<T>> {
    const now = Date.now();
    const result: Array<{ key: string } & TTLEntry<T>> = [];
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== Infinity && now > entry.expiresAt) {
        this.delete(key);
        continue;
      }
      result.push({ key, ...entry });
    }
    return result;
  }

  /** Number of live entries. */
  get size(): number {
    return this.entries.size;
  }

  /** Remove all entries and timers. */
  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();

    const keys = [...this.entries.keys()];
    this.entries.clear();

    // Notify all cleared
    for (const key of keys) {
      this.onChange?.(key, null);
    }
  }

  /** Clean up — call on disconnect / unmount. */
  dispose(): void {
    this.clear();
    this.onChange = undefined;
  }
}
