import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInboundOutbound } from './useInboundOutbound';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

const mockQueryBuilder: any = {
  select: mockSelect,
  eq: mockEq,
  gte: mockGte,
  lte: mockLte,
  order: mockOrder,
  range: mockRange,
};

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: vi.fn(() => mockQueryBuilder),
  }),
}));

describe('useInboundOutbound hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(mockQueryBuilder);
    mockEq.mockReturnValue(mockQueryBuilder);
    mockGte.mockReturnValue(mockQueryBuilder);
    mockLte.mockReturnValue(mockQueryBuilder);
    mockOrder.mockReturnValue(mockQueryBuilder);
    mockRange.mockResolvedValue({
      data: [
        {
          id: 'test-1',
          outlet_id: 'outlet-1',
          bahan_baku_id: 'bahan-1',
          tipe: 'IN',
          sumber: 'vendor_po',
          kategori: 'Pembelian Vendor',
          qty: 10,
          harga_satuan: 50000,
          saldo_sesudah: 100,
          catatan: null,
          created_by: 'staff-1',
          created_at: '2026-10-24T10:00:00Z',
          pencatat_nama: 'Budi',
          bahan_nama: 'AYAM',
          bahan_satuan: 'kg',
          satuan_tengah: null,
          faktor_tengah: null,
          satuan_kecil: 'gram',
          faktor_tampilan: 1000,
          satuan_distribusi: 'kg',
          ref_shipment_id: null,
          tujuan_outlet_nama: null,
          nomor_sj: null,
          nomor_po: 'PO-001',
          supplier_nama: 'Vendor Ayam',
        },
      ],
      error: null,
    });
  });

  it('filters by specific outlet when outletId is provided', async () => {
    const { result } = renderHook(() =>
      useInboundOutbound('outlet-uuid-1', 0, undefined, undefined, undefined, 'ALL')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockEq).toHaveBeenCalledWith('outlet_id', 'outlet-uuid-1');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].bahan_baku?.nama).toBe('AYAM');
  });

  it('does NOT filter by outlet_id when outletId is ALL (Semua Outlet)', async () => {
    const { result } = renderHook(() =>
      useInboundOutbound('ALL', 0, undefined, undefined, undefined, 'ALL')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // mockEq should NOT have been called with 'outlet_id'
    const outletCalls = mockEq.mock.calls.filter((call) => call[0] === 'outlet_id');
    expect(outletCalls).toHaveLength(0);
    expect(result.current.data).toHaveLength(1);
  });

  it('filters by bahan_baku_id when a specific bahanId is selected', async () => {
    const { result } = renderHook(() =>
      useInboundOutbound('ALL', 0, undefined, undefined, undefined, 'bahan-uuid-ayam')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockEq).toHaveBeenCalledWith('bahan_baku_id', 'bahan-uuid-ayam');
  });

  it('does NOT filter by bahan_baku_id when bahanId is ALL', async () => {
    const { result } = renderHook(() =>
      useInboundOutbound('ALL', 0, undefined, undefined, undefined, 'ALL')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const bahanCalls = mockEq.mock.calls.filter((call) => call[0] === 'bahan_baku_id');
    expect(bahanCalls).toHaveLength(0);
  });

  it('filters by tipe when filterTipe is IN or OUT', async () => {
    const { result } = renderHook(() =>
      useInboundOutbound('ALL', 0, undefined, undefined, undefined, 'ALL', 'IN')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockEq).toHaveBeenCalledWith('tipe', 'IN');
  });

  it('does NOT filter by tipe when filterTipe is ALL', async () => {
    const { result } = renderHook(() =>
      useInboundOutbound('ALL', 0, undefined, undefined, undefined, 'ALL', 'ALL')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const tipeCalls = mockEq.mock.calls.filter((call) => call[0] === 'tipe');
    expect(tipeCalls).toHaveLength(0);
  });
});
