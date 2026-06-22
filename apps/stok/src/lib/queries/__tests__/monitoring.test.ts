import { describe, it, expect, vi, beforeEach } from 'vitest';

function createQueryBuilderMock(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    in: () => builder,
    lte: () => builder,
    gte: () => builder,
    limit: () => builder,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const mockFrom = vi.fn();

vi.mock('@suka/auth', () => ({
  createSupabaseBrowserClient: () => ({ from: mockFrom }),
}));

import { fetchLeaderMonitoringData, fetchOpnameStatus } from '../monitoring';

describe('fetchLeaderMonitoringData', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('queries monitoring_view_scoped (not monitoring_view_spv)', async () => {
    mockFrom.mockReturnValue(createQueryBuilderMock({ data: [], error: null }));

    await fetchLeaderMonitoringData();

    expect(mockFrom).toHaveBeenCalledWith('monitoring_view_scoped');
    expect(mockFrom).not.toHaveBeenCalledWith('monitoring_view_spv');
  });

  it('deduplicates items by composite outlet_id + bahan_baku_id key', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilderMock({
        data: [
          { outlet_id: 'outlet-a', bahan_baku_id: 'bb1', item_name: 'Minyak' },
          { outlet_id: 'outlet-a', bahan_baku_id: 'bb1', item_name: 'Minyak (dup)' },
          { outlet_id: 'outlet-a', bahan_baku_id: 'bb2', item_name: 'Tepung' },
        ],
        error: null,
      })
    );

    const result = await fetchLeaderMonitoringData();

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i: { bahan_baku_id: string }) => i.bahan_baku_id)).toEqual(['bb1', 'bb2']);
  });

  it('throws on query error', async () => {
    mockFrom.mockReturnValue(createQueryBuilderMock({ data: null, error: new Error('boom') }));

    await expect(fetchLeaderMonitoringData()).rejects.toThrow('boom');
  });
});

describe('fetchOpnameStatus', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('queries opname_compliance_view (not the raw outlets table)', async () => {
    mockFrom.mockReturnValue(createQueryBuilderMock({ data: [], error: null }));

    await fetchOpnameStatus();

    expect(mockFrom).toHaveBeenCalledWith('opname_compliance_view');
    expect(mockFrom).not.toHaveBeenCalledWith('outlets');
  });

  it('maps last_opname_date into days_since / is_overdue', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockFrom.mockReturnValue(
      createQueryBuilderMock({
        data: [{ outlet_id: 'outlet-a', outlet_name: 'Outlet A', last_opname_date: tenDaysAgo }],
        error: null,
      })
    );

    const result = await fetchOpnameStatus();

    expect(result).toEqual([
      {
        outlet_id: 'outlet-a',
        outlet_name: 'Outlet A',
        last_opname_date: tenDaysAgo,
        days_since: 10,
        is_overdue: true,
      },
    ]);
  });

  it('handles outlets with no opname yet', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilderMock({
        data: [{ outlet_id: 'outlet-b', outlet_name: 'Outlet B', last_opname_date: null }],
        error: null,
      })
    );

    const result = await fetchOpnameStatus();

    expect(result[0]).toEqual({
      outlet_id: 'outlet-b',
      outlet_name: 'Outlet B',
      last_opname_date: null,
      days_since: null,
      is_overdue: false,
    });
  });
});
