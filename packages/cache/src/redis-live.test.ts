import { describe, it, expect, afterAll } from 'vitest';
import { RedisStore } from './redis-store';
import { CacheManager } from './cache-manager';
import { MemoryStore } from './memory-store';

const LIVE_REDIS_URL = 'redis://default:%40Akundevss2026@76.13.193.138:6379/0';

describe('Live Coolify Redis Server Integration (76.13.193.138:6379)', () => {
  const liveStore = new RedisStore(LIVE_REDIS_URL);
  const manager = new CacheManager(new MemoryStore(100), liveStore);

  afterAll(async () => {
    await liveStore.disconnect();
  });

  it('should connect to live Redis and perform CRUD operations', async () => {
    expect(liveStore.isAvailable()).toBe(true);

    const testKey = 'test:coolify:ping';
    const testData = { server: 'Coolify', role: 'Redis L2 Cache', timestamp: Date.now() };

    // 1. Set key with 60s TTL
    await liveStore.set(testKey, testData, 60);

    // 2. Get key
    const fetched = await liveStore.get<typeof testData>(testKey);
    expect(fetched).toEqual(testData);

    // 3. Delete key
    const deleted = await liveStore.delete(testKey);
    expect(deleted).toBe(true);

    // 4. Verify gone
    const afterDelete = await liveStore.get(testKey);
    expect(afterDelete).toBeNull();
  });

  it('should support pattern deletion on live Redis', async () => {
    await liveStore.set('suka:test:item1', 'A', 60);
    await liveStore.set('suka:test:item2', 'B', 60);

    expect(await liveStore.get('suka:test:item1')).toBe('A');
    expect(await liveStore.get('suka:test:item2')).toBe('B');

    const count = await liveStore.deletePattern('suka:test:*');
    expect(count).toBeGreaterThanOrEqual(2);

    expect(await liveStore.get('suka:test:item1')).toBeNull();
    expect(await liveStore.get('suka:test:item2')).toBeNull();
  });

  it('should tier L1 and L2 caches seamlessly with live Redis', async () => {
    const testKey = 'suka:tiered:sample';
    let dbQueryCount = 0;

    const dbFetcher = async () => {
      dbQueryCount++;
      return [{ id: 'menu-shawarma', name: 'Shawarma Special', price: 25000 }];
    };

    // 1st request: Misses L1 and L2 -> fetches from DB -> populates both L1 and L2
    const res1 = await manager.getCached(testKey, dbFetcher, { ttlSeconds: 60 });
    expect(res1[0].name).toBe('Shawarma Special');
    expect(dbQueryCount).toBe(1);

    // 2nd request: Hits L1 memory (ultra fast < 0.05ms) -> DB not called
    const res2 = await manager.getCached(testKey, dbFetcher);
    expect(res2).toEqual(res1);
    expect(dbQueryCount).toBe(1);

    // Clear L1 memory to simulate new node process / memory restart
    (manager as any).l1.clear();

    // 3rd request: Misses L1, but hits live L2 Redis! -> DB still not called!
    const res3 = await manager.getCached(testKey, dbFetcher);
    expect(res3).toEqual(res1);
    expect(dbQueryCount).toBe(1);

    // Clean up
    await manager.invalidate(testKey);
  });
});
