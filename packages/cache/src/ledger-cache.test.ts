import { describe, it, expect, vi } from 'vitest';
import { createLedgerCacheServices } from './services/ledger-cache';
import { CacheManager } from './cache-manager';
import { MemoryStore } from './memory-store';
import { RedisStore } from './redis-store';

describe('LedgerCacheServices (Smart Caching & Event-Driven Invalidation)', () => {
  it('should cache page 0 and bypass cache for page > 0', async () => {
    const memory = new MemoryStore(100);
    const redis = new RedisStore('', ''); // unconfigured, fallback
    const manager = new CacheManager(memory, redis);
    const services = createLedgerCacheServices(manager);

    const mockOutletId = 'outlet-123';
    const mockDataPage0 = [
      { transaksi_key: 'tx-1', outlet_id: mockOutletId, jumlah_bahan: 3, created_at: '2026-09-22T10:00:00Z' },
    ];
    const mockDataPage1 = [
      { transaksi_key: 'tx-2', outlet_id: mockOutletId, jumlah_bahan: 2, created_at: '2026-09-21T10:00:00Z' },
    ];

    let page0CallCount = 0;
    let page1CallCount = 0;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'ledger_transaksi_ringkas') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn((from: number) => {
              if (from === 0) {
                page0CallCount++;
                return Promise.resolve({ data: mockDataPage0, error: null });
              } else {
                page1CallCount++;
                return Promise.resolve({ data: mockDataPage1, error: null });
              }
            }),
          };
        }
        if (table === 'stok_waste_reports' || table === 'orders' || table === 'stok_opname' || table === 'surat_jalan') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    // 1st request page 0: Cache miss -> calls DB
    const res1 = await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 0);
    expect(res1[0].transaksi_key).toBe('tx-1');
    expect(page0CallCount).toBe(1);

    // 2nd request page 0: Cache hit -> served from L1/L2 Redis (< 1ms) -> DB NOT called
    const res2 = await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 0);
    expect(res2[0].transaksi_key).toBe('tx-1');
    expect(page0CallCount).toBe(1);

    // 3. Request page 1: Always bypasses cache
    await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 1);
    expect(page1CallCount).toBe(1);

    await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 1);
    expect(page1CallCount).toBe(2);

    // 4. Event-Driven Invalidation: When new transaction occurs
    await services.invalidateLedgerCache(mockOutletId);

    // 5. Next request page 0: Cache miss again -> reloads fresh from DB
    await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 0);
    expect(page0CallCount).toBe(2);
  });

  it('should support forceRefresh (Pull-to-Refresh) to bypass cache', async () => {
    const memory = new MemoryStore(100);
    const redis = new RedisStore('', '');
    const manager = new CacheManager(memory, redis);
    const services = createLedgerCacheServices(manager);

    const mockOutletId = 'outlet-pull-refresh';
    let queryCount = 0;

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn(() => {
          queryCount++;
          return Promise.resolve({ data: [{ transaksi_key: `tx-${queryCount}` }], error: null });
        }),
      })),
    };

    // 1. Initial load
    const first = await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 0);
    expect(first[0].transaksi_key).toBe('tx-1');
    expect(queryCount).toBe(1);

    // 2. Normal load -> Cached
    await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 0);
    expect(queryCount).toBe(1);

    // 3. Pull-to-Refresh: forceRefresh = true
    const refreshed = await services.getCachedLedgerTransaksi(mockSupabase, mockOutletId, 0, true);
    expect(refreshed[0].transaksi_key).toBe('tx-2');
    expect(queryCount).toBe(2);
  });
});
