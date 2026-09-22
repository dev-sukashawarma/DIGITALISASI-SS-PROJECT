/**
 * @suka/cache Types & Constants
 */

export interface CacheOptions {
  /** Time To Live in seconds. Default is 300 (5 minutes) */
  ttlSeconds?: number;
  /** If true, bypasses L1 in-memory cache */
  skipL1?: boolean;
  /** If true, bypasses L2 Redis cache */
  skipL2?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  misses: number;
  sets: number;
  errors: number;
}

export interface ICacheStore {
  get<T>(key: string): Promise<T | null> | (T | null);
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> | void;
  delete(key: string): Promise<boolean> | boolean;
  clear(): Promise<void> | void;
}

export const CACHE_TTL = {
  SHORT: 60,            // 1 minute
  MENU: 300,            // 5 minutes
  CATEGORIES: 600,      // 10 minutes
  OUTLETS: 1800,        // 30 minutes
  LONG: 86400,          // 24 hours
} as const;

export const CACHE_KEYS = {
  MENU_ALL: 'suka:menu:all',
  MENU_OUTLET: (outletId: string) => `suka:menu:outlet:${outletId}`,
  CATEGORIES_ALL: 'suka:categories:all',
  OUTLETS_ALL: 'suka:outlets:all',
  OUTLET_DETAIL: (outletId: string) => `suka:outlet:${outletId}`,
  KIOSK_SETTINGS: (outletId?: string | null) => `suka:kiosk_settings:${outletId || 'global'}`,
} as const;
