import { describe, it, expect, vi, beforeEach } from 'vitest';

function createQueryBuilderMock(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    in: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@suka/auth', () => ({
  createSupabaseBrowserClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
  }),
}));

import { fetchItemDetail, fetchOutletItemsDetail } from '../monitoring';

describe('fetchItemDetail access control', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockGetUser.mockReset();
  });

  it('throws "Not authenticated" when there is no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(fetchItemDetail('outlet-a', 'bb1')).rejects.toThrow('Not authenticated');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws "Access denied" when outletId is not in accessible_outlet_ids()', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'staff-leader' } } });
    mockRpc.mockResolvedValue({ data: ['outlet-b', 'outlet-c'], error: null });

    await expect(fetchItemDetail('outlet-a', 'bb1')).rejects.toThrow('Access denied');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('proceeds to query monitoring_view_spv when outletId is accessible', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'staff-leader' } } });
    mockRpc.mockResolvedValue({ data: ['outlet-a', 'outlet-b'], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'monitoring_view_spv') {
        return createQueryBuilderMock({
          data: { outlet_id: 'outlet-a', bahan_baku_id: 'bb1', current_qty: 5 },
          error: null,
        });
      }
      if (table === 'ledger_stok') return createQueryBuilderMock({ data: [], error: null });
      if (table === 'opname_item') return createQueryBuilderMock({ data: null, error: null });
      if (table === 'bahan_baku') {
        return createQueryBuilderMock({
          data: { satuan_kecil: null, faktor_tampilan: null },
          error: null,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await fetchItemDetail('outlet-a', 'bb1');

    expect(mockFrom).toHaveBeenCalledWith('monitoring_view_spv');
    expect(result.outlet_id).toBe('outlet-a');
  });

  it('handles accessible_outlet_ids() returning single-key objects (alternate PostgREST shape)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'staff-leader' } } });
    mockRpc.mockResolvedValue({
      data: [{ accessible_outlet_ids: 'outlet-a' }],
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'monitoring_view_spv') {
        return createQueryBuilderMock({ data: { outlet_id: 'outlet-a' }, error: null });
      }
      return createQueryBuilderMock({ data: [], error: null });
    });

    await expect(fetchItemDetail('outlet-a', 'bb1')).resolves.toMatchObject({ outlet_id: 'outlet-a' });
  });
});

describe('fetchOutletItemsDetail access control', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockGetUser.mockReset();
  });

  it('throws "Access denied" for an outlet outside accessible_outlet_ids()', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'staff-leader' } } });
    mockRpc.mockResolvedValue({ data: ['outlet-b'], error: null });

    await expect(fetchOutletItemsDetail('outlet-a')).rejects.toThrow('Access denied');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns items when the outlet is accessible', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'staff-leader' } } });
    mockRpc.mockResolvedValue({ data: ['outlet-a'], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'monitoring_view_spv') {
        return createQueryBuilderMock({
          data: [{ outlet_id: 'outlet-a', bahan_baku_id: 'bb1', item_name: 'Minyak', status: 'ok' }],
          error: null,
        });
      }
      if (table === 'ledger_feed_spv') return createQueryBuilderMock({ data: [], error: null });
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await fetchOutletItemsDetail('outlet-a');

    expect(result).toHaveLength(1);
    expect(result[0].bahan_baku_id).toBe('bb1');
  });
});
