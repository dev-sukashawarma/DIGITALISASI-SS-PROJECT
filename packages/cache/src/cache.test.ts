import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryStore } from './memory-store';
import { RedisStore } from './redis-store';
import { CacheManager } from './cache-manager';

describe('MemoryStore (L1 Cache)', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(5); // Small limit for testing LRU
  });

  it('should store and retrieve data correctly', () => {
    store.set('key1', { name: 'Shawarma Beef' }, 10);
    const result = store.get<{ name: string }>('key1');
    expect(result).toEqual({ name: 'Shawarma Beef' });
  });

  it('should return null for non-existent key', () => {
    const result = store.get('unknown');
    expect(result).toBeNull();
  });

  it('should expire keys after TTL', async () => {
    // Set 0.05 second TTL
    store.set('expiringKey', 'temporary', 0.05);
    expect(store.get('expiringKey')).toBe('temporary');

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(store.get('expiringKey')).toBeNull();
  });

  it('should evict oldest entry when capacity is exceeded (LRU)', () => {
    store.set('item1', 1);
    store.set('item2', 2);
    store.set('item3', 3);
    store.set('item4', 4);
    store.set('item5', 5);

    // Access item1 to make it recently used
    store.get('item1');

    // Add item6, item2 should be evicted (as item1 was recently accessed)
    store.set('item6', 6);

    expect(store.get('item1')).toBe(1);
    expect(store.get('item2')).toBeNull();
    expect(store.get('item6')).toBe(6);
  });

  it('should delete keys by prefix', () => {
    store.set('suka:menu:1', 'shawarma');
    store.set('suka:menu:2', 'kebab');
    store.set('suka:other:3', 'drink');

    const deleted = store.deletePrefix('suka:menu:');
    expect(deleted).toBe(2);
    expect(store.get('suka:menu:1')).toBeNull();
    expect(store.get('suka:menu:2')).toBeNull();
    expect(store.get('suka:other:3')).toBe('drink');
  });
});

describe('CacheManager (Tiered Cache & Fallback)', () => {
  let l1: MemoryStore;
  let l2: RedisStore;
  let manager: CacheManager;

  beforeEach(() => {
    l1 = new MemoryStore(100);
    // Unconfigured Redis instance to test zero-crash fallback
    l2 = new RedisStore('', '');
    manager = new CacheManager(l1, l2);
  });

  it('should call fetcher on cache miss and return from L1 on subsequent calls', async () => {
    const mockFetcher = vi.fn().mockResolvedValue([
      { id: '1', name: 'Shawarma Chicken' },
      { id: '2', name: 'Shawarma Beef' },
    ]);

    // 1st Call: Miss -> calls fetcher
    const firstResult = await manager.getCached('suka:menu:all', mockFetcher);
    expect(firstResult).toHaveLength(2);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // 2nd Call: Hit in L1 -> does NOT call fetcher
    const secondResult = await manager.getCached('suka:menu:all', mockFetcher);
    expect(secondResult).toEqual(firstResult);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    const stats = manager.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.l1Hits).toBe(1);
  });

  it('should invalidate cache properly', async () => {
    const mockFetcher = vi.fn()
      .mockResolvedValueOnce([{ id: '1', version: 'v1' }])
      .mockResolvedValueOnce([{ id: '1', version: 'v2' }]);

    await manager.getCached('suka:menu:all', mockFetcher);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // Invalidate
    await manager.invalidate('suka:menu:all');

    // Next get must call fetcher again
    const updated = await manager.getCached('suka:menu:all', mockFetcher);
    expect(updated).toEqual([{ id: '1', version: 'v2' }]);
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('should handle Redis failures gracefully without crashing (Zero-Crash Guarantee)', async () => {
    // Mock RedisStore that throws an unexpected error
    const faultyRedis = new RedisStore('http://mock-redis', 'mock-token');
    vi.spyOn(faultyRedis, 'isAvailable').mockReturnValue(true);
    vi.spyOn(faultyRedis, 'get').mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(faultyRedis, 'set').mockRejectedValue(new Error('TIMEOUT'));

    const resilientManager = new CacheManager(l1, faultyRedis);

    const dbFetcher = vi.fn().mockResolvedValue({ status: 'ok', data: 'from_db' });

    // Should NOT throw, but fetch from DB and serve
    const result = await resilientManager.getCached('test_error_resilience', dbFetcher);
    expect(result).toEqual({ status: 'ok', data: 'from_db' });
    expect(dbFetcher).toHaveBeenCalledTimes(1);
  });
});

describe('MenuCacheServices (Domain Master Data Services)', () => {
  it('should cache and invalidate menu items and categories', async () => {
    const { createMenuCacheServices } = await import('./services/menu-cache');
    const localManager = new CacheManager(new MemoryStore(50), new RedisStore('', ''));
    const services = createMenuCacheServices(localManager);

    const mockMenuData = [{ id: 'menu-1', name: 'Shawarma Large', sort_order: 1 }];
    const mockCategoriesData = [{ id: 'cat-1', name: 'Shawarma', sort_order: 1 }];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'menu_items') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockMenuData, error: null }),
          };
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockCategoriesData, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    // 1. Fetch menu items - miss -> Supabase
    const menu1 = await services.getCachedMenuItems(mockSupabase);
    expect(menu1).toEqual(mockMenuData);
    expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');

    // 2. Fetch menu items again - hit -> served from cache
    mockSupabase.from.mockClear();
    const menu2 = await services.getCachedMenuItems(mockSupabase);
    expect(menu2).toEqual(mockMenuData);
    expect(mockSupabase.from).not.toHaveBeenCalled();

    // 3. Fetch categories - miss -> Supabase
    const cats1 = await services.getCachedCategories(mockSupabase);
    expect(cats1).toEqual(mockCategoriesData);
    expect(mockSupabase.from).toHaveBeenCalledWith('categories');

    // 4. Invalidate menu cache
    await services.invalidateMenuCache();

    // 5. Fetch menu items again - cache miss -> calls Supabase again
    mockSupabase.from.mockClear();
    const menu3 = await services.getCachedMenuItems(mockSupabase);
    expect(menu3).toEqual(mockMenuData);
    expect(mockSupabase.from).toHaveBeenCalledWith('menu_items');
  });
});

