import { memoryStore, MemoryStore } from './memory-store';
import { redisStore, RedisStore } from './redis-store';
import { CacheOptions, CacheStats, CACHE_TTL } from './types';

/**
 * CacheManager: Tiered L1 (RAM) + L2 (Redis) Cache Orchestrator
 *
 * Latency profile:
 * - L1 Hit (RAM): ~0.02ms
 * - L2 Hit (Redis REST): ~1-3ms
 * - Miss (Database): ~50-200ms
 */
export class CacheManager {
  private l1: MemoryStore;
  private l2: RedisStore;
  private stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
  };

  constructor(l1Store?: MemoryStore, l2Store?: RedisStore) {
    this.l1 = l1Store || memoryStore;
    this.l2 = l2Store || redisStore;
  }

  /**
   * Retrieves data from cache or runs fetcher to populate cache.
   * Guaranteed zero crash: if cache fails, fetcher still runs and returns database data.
   */
  async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const ttlSeconds = options.ttlSeconds ?? CACHE_TTL.MENU;

    // 1. Try L1 (Memory)
    if (!options.skipL1) {
      try {
        const l1Result = this.l1.get<T>(key);
        if (l1Result !== null && l1Result !== undefined) {
          this.stats.l1Hits++;
          return l1Result;
        }
      } catch (err) {
        this.stats.errors++;
        console.warn(`[CacheManager] L1 error for key ${key}:`, err);
      }
    }

    // 2. Try L2 (Redis)
    if (!options.skipL2 && this.l2.isAvailable()) {
      try {
        const l2Result = await this.l2.get<T>(key);
        if (l2Result !== null && l2Result !== undefined) {
          this.stats.l2Hits++;
          // Backfill L1 so subsequent requests are instant
          if (!options.skipL1) {
            this.l1.set(key, l2Result, ttlSeconds);
          }
          return l2Result;
        }
      } catch (err) {
        this.stats.errors++;
        console.warn(`[CacheManager] L2 error for key ${key}:`, err);
      }
    }

    // 3. Cache Miss — Query Source of Truth (Database)
    this.stats.misses++;
    const freshData = await fetcher();

    // 4. Save to Caches (only if data is valid)
    if (freshData !== null && freshData !== undefined) {
      this.stats.sets++;
      if (!options.skipL1) {
        this.l1.set(key, freshData, ttlSeconds);
      }
      if (!options.skipL2 && this.l2.isAvailable()) {
        // Fire and forget so we don't delay the response
        this.l2.set(key, freshData, ttlSeconds).catch(err => {
          this.stats.errors++;
          console.warn(`[CacheManager] Failed to write L2 for key ${key}:`, err);
        });
      }
    }

    return freshData;
  }

  /**
   * Directly sets value in L1 and L2 caches.
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttlSeconds = options.ttlSeconds ?? CACHE_TTL.MENU;
    if (!options.skipL1) {
      this.l1.set(key, value, ttlSeconds);
    }
    if (!options.skipL2 && this.l2.isAvailable()) {
      await this.l2.set(key, value, ttlSeconds).catch(() => {});
    }
  }

  /**
   * Invalidates a key or pattern (e.g. 'suka:menu:*').
   */
  async invalidate(keyOrPattern: string): Promise<void> {
    if (keyOrPattern.endsWith('*')) {
      const prefix = keyOrPattern.slice(0, -1);
      this.l1.deletePrefix(prefix);
      if (this.l2.isAvailable()) {
        await this.l2.deletePattern(keyOrPattern).catch(() => {});
      }
    } else {
      this.l1.delete(keyOrPattern);
      if (this.l2.isAvailable()) {
        await this.l2.delete(keyOrPattern).catch(() => {});
      }
    }
  }

  /**
   * Returns telemetry / performance stats.
   */
  getStats(): CacheStats & { hitRatio: string } {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalRequests = totalHits + this.stats.misses;
    const ratio = totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(1) + '%' : '0%';

    return {
      ...this.stats,
      hitRatio: ratio,
    };
  }

  /**
   * Resets hit/miss counters.
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
    };
  }
}

export const defaultCacheManager = new CacheManager();
