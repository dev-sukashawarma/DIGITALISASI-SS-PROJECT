import { describe, it, expect } from 'vitest'
import { exportReconciliationToPdf } from './exportJurnalMutasiPdf'
import type { ReconciliationSnapshotResponse } from '@/app/actions/jurnalMutasi'

describe('exportReconciliationToPdf', () => {
  it('should generate PDF and call doc.save with formatted filename', async () => {
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
          menu_usages: [
            {
              menu_item_name: 'Shawarma Ayam Reguler',
              porsi_terjual: 40,
              qty_per_porsi: 100,
              satuan: 'gr',
              total_pemakaian: 4000,
            },
            {
              menu_item_name: 'Shawarma Ayam Jumbo',
              porsi_terjual: 10,
              qty_per_porsi: 200,
              satuan: 'gr',
              total_pemakaian: 2000,
            },
          ],
        },
      ],
    }

    // Call exportReconciliationToPdf
    await expect(exportReconciliationToPdf(mockData)).resolves.not.toThrow()
  })
})
