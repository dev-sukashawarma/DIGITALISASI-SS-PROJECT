import { CacheEntry, ICacheStore } from './types';

/**
 * L1 In-Memory Cache Store with LRU eviction and TTL.
 * Runs directly in Node.js process heap memory.
 * Speed: < 0.05ms.
 */
export class MemoryStore implements ICacheStore {
  private store = new Map<string, CacheEntry<any>>();
  private maxItems: number;

  constructor(maxItems = 1000) {
    this.maxItems = maxItems;
  }

  /**
   * Retrieves an item from memory. Returns null if missing or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt > 0 && entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order by re-inserting at the end of the Map
    this.store.delete(key);
    entry.lastAccessed = now;
    this.store.set(key, entry);

    return entry.value as T;
  }

  /**
   * Stores an item with optional TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds = 300): void {
    // If key already exists, delete first to refresh insertion order
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxItems) {
      // Evict oldest item (first entry in Map)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    const now = Date.now();
    const expiresAt = ttlSeconds > 0 ? now + ttlSeconds * 1000 : 0;

    this.store.set(key, {
      value,
      expiresAt,
      lastAccessed: now,
    });
  }

  /**
   * Deletes a specific key.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Deletes all keys matching a prefix (e.g., 'suka:menu:').
   */
  deletePrefix(prefix: string): number {
    let deletedCount = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Clears the entire memory store.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Returns current active entries count (cleaning expired on the fly).
   */
  size(): number {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    return this.store.size;
  }
}

export const memoryStore = new MemoryStore();
