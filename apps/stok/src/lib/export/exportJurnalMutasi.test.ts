import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import {
  buildSummaryCardsRows,
  exportDailySummaryCardsToCsv,
  exportDailySummaryCardsToXls,
  exportReconciliationToCsv,
  exportSummaryCardsToCsv,
  exportSummaryCardsToXls,
} from './exportJurnalMutasi'
import type { DailySummaryCardEntry, ReconciliationSnapshotResponse } from '@/app/actions/jurnalMutasi'

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
        omzet_rp: 1000000,
        potongan_rp: 0,
        order_count: 50,
        teoritis_pakai_rp: 280000,
        teoritis_tidak_terhitung: 0,
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
          satuan_kirim: 'kg',
          harga_master_kirim: 50000,
          has_opname: true,
          status: 'MINUS',
          selisih_persen: -7.89,
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

  it('should include menu breakdown section in CSV when menu_breakdown is provided', () => {
    let capturedBlobContent: string = ''
    const originalBlob = global.Blob
    global.Blob = class MockBlob extends originalBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          capturedBlobContent = String(blobParts[0])
        }
      }
    } as any

    const mockData: ReconciliationSnapshotResponse = {
      outlet: { id: 'ALL', name: 'Semua Outlet (3 Cabang)' },
      period: {
        mode: 'date_range',
        start_date: '2026-09-10T00:00:00Z',
        end_date: '2026-09-15T23:59:59Z',
        opname_terpilih: null,
      },
      pending_surat_jalan_count: 0,
      audit_note: null,
      totals: {
        total_awal_rp: 1000000,
        total_masuk_rp_master: 500000,
        total_masuk_rp_riil: 500000,
        total_pakai_rp: 400000,
        total_waste_rp: 0,
        total_sistem_rp: 1100000,
        total_fisik_rp: 1100000,
        total_selisih_rp: 0,
        bahan_berselisih_count: 0,
        anomali_skala_count: 0,
        ekstrem_count: 0,
        omzet_rp: 2000000,
        potongan_rp: 0,
        order_count: 100,
        teoritis_pakai_rp: 400000,
        teoritis_tidak_terhitung: 0,
      },
      items: [],
      menu_breakdown: [
        {
          menu_item_id: 'm-1',
          menu_item_name: 'Ayam Goreng Spesial',
          total_porsi: 25,
          has_recipe: true,
          ingredients: [
            {
              bahan_baku_id: 'b-1',
              nama_bahan: 'Ayam Potong',
              qty_per_porsi: 0.25,
              satuan: 'kg',
              total_kebutuhan: 6.25,
            },
          ],
        },
      ],
    }

    const mockAnchor = {
      setAttribute: vi.fn(),
      click: vi.fn(),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())

    exportReconciliationToCsv(mockData)

    expect(capturedBlobContent).toContain('RINCIAN PEMAKAIAN BAHAN BAKU SETIAP MENU POS (BOM)')
    expect(capturedBlobContent).toContain('Ayam Goreng Spesial')
    expect(capturedBlobContent).toContain('Ayam Potong')
    expect(capturedBlobContent).toContain('6.25')
    expect(capturedBlobContent).toContain('Masuk (Qty)')
    expect(capturedBlobContent).toContain('Pemakaian POS (Qty)')
    expect(capturedBlobContent).toContain('Waste (Qty)')
    expect(capturedBlobContent).not.toContain('Saldo Awal (Qty)')
    expect(capturedBlobContent).not.toContain('Stok Sistem (Qty)')
    expect(capturedBlobContent).not.toContain('Stok Fisik Opname (Qty)')

    global.Blob = originalBlob
  })
})

describe('summary cards export (CSV & XLS)', () => {
  const singleOutletMock: ReconciliationSnapshotResponse = {
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
        notes: null,
        created_at: '2026-09-15T10:00:00Z',
        approved_at: '2026-09-15T11:00:00Z',
        created_by_name: 'Budi',
        item_count: 1,
        flagged_count: 0,
      },
    },
    pending_surat_jalan_count: 0,
    audit_note: null,
    totals: {
      total_awal_rp: 500000,
      total_masuk_rp_master: 200000,
      total_masuk_rp_riil: 200000,
      total_pakai_rp: 300000,
      total_pakai_rp_riil: 295000,
      total_mutasi_lain_rp: 0,
      total_waste_rp: 20000,
      total_sistem_rp: 380000,
      total_fisik_rp: 350000,
      total_selisih_rp: -30000,
      bahan_berselisih_count: 1,
      anomali_skala_count: 0,
      ekstrem_count: 0,
      omzet_rp: 1000000,
      potongan_rp: 25000,
      order_count: 50,
      teoritis_pakai_rp: 280000,
      teoritis_tidak_terhitung: 0,
    },
    items: [],
  }

  it('builds 8 summary card rows for single outlet and 4 for ALL outlets', () => {
    const singleRows = buildSummaryCardsRows(singleOutletMock)
    expect(singleRows).toHaveLength(8)
    expect(singleRows.map((r) => r.kartu)).toEqual([
      'Omzet Penjualan',
      '1. Saldo Awal',
      '2. Masuk (Inbound)',
      '3. Pemakaian Menu',
      '4. Waste / Rusak',
      '5. Seharusnya Ada',
      '6. Hasil Hitung Opname',
      '7. Selisih',
    ])
    expect(singleRows[0].nilai_rp).toBe(1000000)
    expect(singleRows[7].nilai_rp).toBe(-30000)

    const allRows = buildSummaryCardsRows({
      ...singleOutletMock,
      outlet: { id: 'ALL', name: 'Semua Outlet (3 Cabang)' },
    })
    expect(allRows).toHaveLength(4)
    expect(allRows.map((r) => r.kartu)).toEqual([
      'Omzet Penjualan',
      'Masuk (Inbound)',
      'Pemakaian POS',
      'Waste',
    ])
  })

  it('exports summary cards to CSV with card values', () => {
    let capturedCsv = ''
    const originalBlob = global.Blob
    global.Blob = class MockBlob extends originalBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          capturedCsv = String(blobParts[0])
        }
      }
    } as any

    const mockAnchor = { setAttribute: vi.fn(), click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:cards-csv')
    global.URL.revokeObjectURL = vi.fn()

    exportSummaryCardsToCsv(singleOutletMock)

    expect(mockAnchor.setAttribute).toHaveBeenCalledWith(
      'download',
      expect.stringMatching(/^Ringkasan_Kartu_Rekonsiliasi_Outlet_Pajajaran_.*\.csv$/)
    )
    expect(capturedCsv).toContain('RINGKASAN KARTU REKONSILIASI & JURNAL BAHAN BAKU')
    expect(capturedCsv).toContain('"Omzet Penjualan";"1000000"')
    expect(capturedCsv).toContain('"7. Selisih";"-30000"')

    global.Blob = originalBlob
  })

  it('exports summary cards to readable XLS workbook', () => {
    let capturedBuffer: ArrayBuffer | Uint8Array | null = null
    const originalBlob = global.Blob
    global.Blob = class MockBlob extends originalBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          capturedBuffer = blobParts[0] as ArrayBuffer | Uint8Array
        }
      }
    } as any

    const mockAnchor = { setAttribute: vi.fn(), click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:cards-xls')
    global.URL.revokeObjectURL = vi.fn()

    exportSummaryCardsToXls(singleOutletMock)

    expect(mockAnchor.setAttribute).toHaveBeenCalledWith(
      'download',
      expect.stringMatching(/^Ringkasan_Kartu_Rekonsiliasi_Outlet_Pajajaran_.*\.xls$/)
    )
    expect(capturedBuffer).not.toBeNull()

    const wb = XLSX.read(capturedBuffer!, { type: 'array' })
    expect(wb.SheetNames).toContain('Ringkasan Kartu')
    const sheetRows = XLSX.utils.sheet_to_json<Array<string | number>>(wb.Sheets['Ringkasan Kartu'], {
      header: 1,
    })
    expect(sheetRows.some((r) => r[0] === 'Omzet Penjualan' && r[1] === 1000000)).toBe(true)
    expect(sheetRows.some((r) => r[0] === '7. Selisih' && r[1] === -30000)).toBe(true)

    global.Blob = originalBlob
  })

  it('exports per-date breakdown to CSV and XLS for date_range without summing across dates', () => {
    const dailyEntries: DailySummaryCardEntry[] = [
      {
        date: '2026-11-20',
        totals: { ...singleOutletMock.totals, omzet_rp: 1000000, total_selisih_rp: -10000 },
      },
      {
        date: '2026-11-21',
        totals: { ...singleOutletMock.totals, omzet_rp: 1500000, total_selisih_rp: 5000 },
      },
    ]

    let capturedCsv = ''
    const originalBlob = global.Blob
    global.Blob = class MockBlob extends originalBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          capturedCsv = String(blobParts[0])
        }
      }
    } as any

    const mockAnchor = { setAttribute: vi.fn(), click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:daily-csv')
    global.URL.revokeObjectURL = vi.fn()

    exportDailySummaryCardsToCsv(singleOutletMock, dailyEntries)
    expect(capturedCsv).toContain('BREAKDOWN HARIAN KARTU REKONSILIASI & JURNAL BAHAN BAKU')
    expect(capturedCsv).toContain('"2026-11-20";"1000000"')
    expect(capturedCsv).toContain('"2026-11-21";"1500000"')
    expect(capturedCsv).not.toContain('"2500000"')

    let capturedXlsBuffer: ArrayBuffer | Uint8Array | null = null
    global.Blob = class MockXlsBlob extends originalBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          capturedXlsBuffer = blobParts[0] as ArrayBuffer | Uint8Array
        }
      }
    } as any

    exportDailySummaryCardsToXls(
      { ...singleOutletMock, outlet: { id: 'ALL', name: 'Semua Outlet (3 Cabang)' } },
      dailyEntries
    )

    const wb = XLSX.read(capturedXlsBuffer!, { type: 'array' })
    expect(wb.SheetNames).toContain('Breakdown Harian')
    const sheetRows = XLSX.utils.sheet_to_json<Array<string | number>>(wb.Sheets['Breakdown Harian'], {
      header: 1,
    })
    expect(sheetRows.some((r) => r[0] === '2026-11-20' && r[1] === 1000000)).toBe(true)
    expect(sheetRows.some((r) => r[0] === '2026-11-21' && r[1] === 1500000)).toBe(true)

    global.Blob = originalBlob
  })
})
