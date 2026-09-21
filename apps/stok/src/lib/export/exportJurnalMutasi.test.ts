import { describe, it, expect, vi } from 'vitest'
import { exportReconciliationToCsv } from './exportJurnalMutasi'
import type { ReconciliationSnapshotResponse } from '@/app/actions/jurnalMutasi'

describe('exportReconciliationToCsv', () => {
  it('should generate and trigger CSV download with valid structure and headers', () => {
    const mockData: ReconciliationSnapshotResponse = {
      outlet: { id: 'outlet-1', name: 'Outlet Pajajaran' },
      period: {
        mode: 'opname_session',
        start_date: '2026-09-10T10:00:00Z',
        end_date: '2026-09-15T10:00:00Z',
        opname_terpilih: {
          id: 'op-1',
          tanggal: '2026-09-15',
          tipe: 'harian',
          status: 'finalized',
          notes: 'Opname rutin',
          created_at: '2026-09-15T10:00:00Z',
          approved_at: '2026-09-15T11:00:00Z',
          created_by_name: 'Budi',
          item_count: 1,
          flagged_count: 0,
        },
      },
      pending_surat_jalan_count: 0,
      audit_note: 'Audit normal',
      totals: {
        total_awal_rp: 500000,
        total_masuk_rp_master: 200000,
        total_masuk_rp_riil: 200000,
        total_pakai_rp: 300000,
        total_waste_rp: 20000,
        total_sistem_rp: 380000,
        total_fisik_rp: 350000,
        total_selisih_rp: -30000,
        bahan_berselisih_count: 1,
        anomali_skala_count: 0,
        ekstrem_count: 0,
      },
      items: [
        {
          bahan_baku_id: 'b-1',
          nama: 'AYAM FILLET',
          kategori: 'FOOD & BEVERAGE',
          satuan: 'kg',
          satuan_tengah: null,
          faktor_tengah: null,
          satuan_kecil: 'gram',
          faktor_tampilan: 1000,
          harga_beli_master: 50000,
          unit_price_kecil: 50,
          saldo_awal_qty: 10000,
          masuk_qty: 4000,
          pakai_qty: 6000,
          waste_qty: 400,
          mutasi_lain_qty: 0,
          stok_sistem_qty: 7600,
          stok_fisik_qty: 7000,
          selisih_qty: -600,
          saldo_awal_rp: 500000,
          masuk_rp_master: 200000,
          masuk_rp_riil: 200000,
          pakai_rp: 300000,
          waste_rp: 20000,
          mutasi_lain_rp: 0,
          stok_sistem_rp: 380000,
          stok_fisik_rp: 350000,
          selisih_rp: -30000,
          diagnostics: [],
          menu_usages: [],
        },
      ],
    }

    // Mock DOM elements
    const appendChildMock = vi.fn()
    const removeChildMock = vi.fn()
    const clickMock = vi.fn()

    const mockAnchor = {
      setAttribute: vi.fn(),
      click: clickMock,
    }

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock)
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock)
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test')
    global.URL.revokeObjectURL = vi.fn()

    exportReconciliationToCsv(mockData)

    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith('href', 'blob:test')
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith(
      'download',
      expect.stringContaining('Rekonsiliasi_Mutasi_Stok_Outlet_Pajajaran')
    )
    expect(clickMock).toHaveBeenCalled()
    expect(appendChildMock).toHaveBeenCalled()
    expect(removeChildMock).toHaveBeenCalled()
  })
})
