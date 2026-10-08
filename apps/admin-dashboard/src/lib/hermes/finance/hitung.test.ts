import { describe, it, expect } from 'vitest'
import { hitungUtang, ringkasPengeluaran, ringkasSetoran, ringkasSelisihKasir, tglWib } from './hitung'
import type { PoBaris, SetoranBaris, ShiftBaris, OutletNama } from './tipe'
import type { ExpenseRow } from '@/lib/expenseRow'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

const OUTLETS: OutletNama[] = [
  { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' },
  { id: 'o2', name: 'MITRA CIBINONG', type: 'mitra' },
]

const po = (o: Partial<PoBaris>): PoBaris => ({
  nomorPo: 'PO-1', supplier: 'Altindo', tanggalPo: '2026-09-20', status: 'diterima_lengkap',
  nilaiPesan: 1000, nilaiTerima: 900, jatuhTempo: '2026-10-10', statusBayar: 'unpaid', ...o,
})

describe('hitungUtang', () => {
  const daftar: PoBaris[] = [
    po({ nomorPo: 'A', supplier: 'Altindo', nilaiTerima: 900, jatuhTempo: '2026-10-05' }),
    po({ nomorPo: 'B', supplier: 'Altindo', status: 'sebagian_diterima', statusBayar: 'pending', nilaiTerima: 500, jatuhTempo: '2026-10-20' }),
    po({ nomorPo: 'C', supplier: 'Silaris', nilaiTerima: 2000, jatuhTempo: null }),
    po({ nomorPo: 'D', supplier: 'Silaris', statusBayar: 'paid' }),
    po({ nomorPo: 'E', supplier: 'Zein', status: 'dikirim_ke_supplier', nilaiPesan: 700, nilaiTerima: 0 }),
    po({ nomorPo: 'F', supplier: 'Zein', status: 'draft', nilaiPesan: 999 }),
    po({ nomorPo: 'G', supplier: 'Zein', status: 'dibatalkan', nilaiPesan: 888 }),
    po({ nomorPo: 'H', supplier: 'Zein', status: 'dikirim_ke_supplier', statusBayar: 'paid', nilaiPesan: 50 }),
  ]

  it('utang = PO diterima & belum lunas, nilai terima; komitmen terpisah dengan nilai pesan', () => {
    const r = hitungUtang(daftar, '2026-10-08')
    expect(r.total_utang).toBe(3400)
    expect(r.jumlah_po).toBe(3)
    expect(r.komitmen).toEqual({ total: 700, jumlah_po: 1 })
    expect(r.po.map((p) => p.nomor_po)).toEqual(['A', 'B', 'C'])
  })

  it('lewat jatuh tempo dihitung dari hari ini (WIB)', () => {
    const r = hitungUtang(daftar, '2026-10-08')
    expect(r.lewat_jatuh_tempo).toEqual({ total: 900, jumlah_po: 1 })
    expect(r.po[0].hari_lewat).toBe(3)
    expect(r.po[1].hari_lewat).toBe(-12)
    expect(r.po[2].hari_lewat).toBeNull()
  })

  it('per supplier urut total menurun, jatuh tempo terdekat', () => {
    const r = hitungUtang(daftar, '2026-10-08')
    expect(r.per_supplier).toEqual([
      { supplier: 'Silaris', total: 2000, jumlah_po: 1, jatuh_tempo_terdekat: null },
      { supplier: 'Altindo', total: 1400, jumlah_po: 2, jatuh_tempo_terdekat: '2026-10-05' },
    ])
  })

  it('filter jatuh_tempo_dalam_hari: hanya PO jatuh tempo s/d hari ini + N (termasuk yang lewat)', () => {
    const r = hitungUtang(daftar, '2026-10-08', 7)
    expect(r.po.map((p) => p.nomor_po)).toEqual(['A'])
    expect(r.total_utang).toBe(900)
    expect(r.total_utang_semua).toBe(3400)
  })
})

const exp = (o: Partial<ExpenseRow>): ExpenseRow => ({
  id: 'x', outlet_id: 'o1', outlet_name: 'SUKA SHAWARMA EMPANG', category: 'bahan_baku' as any, scope: 'outlet',
  amount: 100, description: 'rahasia', expense_date: '2026-10-02', period_month: '2026-10-01', source: 'monthly', ...o,
})

describe('ringkasPengeluaran', () => {
  const rows = [
    exp({ amount: 100 }),
    exp({ amount: 50, category: 'utilitas' as any }),
    exp({ amount: 300, outlet_id: 'o2', outlet_name: 'MITRA CIBINONG' }),
    exp({ amount: 1000, outlet_id: null, outlet_name: 'Kantor Pusat', scope: 'pusat', category: 'pengeluaran_global' as any }),
  ]

  it('total, outlet vs pusat, per kategori & per outlet urut menurun', () => {
    const r = ringkasPengeluaran(rows)
    expect(r.total).toBe(1450)
    expect(r.outlet_total).toBe(450)
    expect(r.pusat_total).toBe(1000)
    expect(r.per_kategori[0]).toMatchObject({ kategori: 'pengeluaran_global', total: 1000 })
    expect(r.per_kategori.find((k) => k.kategori === 'bahan_baku')?.total).toBe(400)
    expect(r.per_outlet).toEqual([{ outlet: 'MITRA CIBINONG', total: 300 }, { outlet: 'SUKA SHAWARMA EMPANG', total: 150 }])
  })

  it('filter outlet membuang pusat & outlet lain', () => {
    const r = ringkasPengeluaran(rows, new Set(['o1']))
    expect(r.total).toBe(150)
    expect(r.pusat_total).toBe(0)
  })

  it('keluaran tanpa keterangan bebas', () => {
    expect(JSON.stringify(ringkasPengeluaran(rows))).not.toContain('rahasia')
  })
})

describe('ringkasSetoran', () => {
  const s = (o: Partial<SetoranBaris>): SetoranBaris => ({
    outletId: 'o2', nominal: 430000, tanggalJual: '2026-10-01', occurredAt: '2026-10-08T03:00:00Z', jenis: 'Setoran Bank', ...o,
  })

  it('tanggal jual = sales_date, fallback tanggal WIB occurred_at - 1 hari', () => {
    const r = ringkasSetoran([s({}), s({ outletId: 'o1', nominal: 100, tanggalJual: null, occurredAt: '2026-10-02T18:30:00Z' })], OUTLETS, '2026-10-01', '2026-10-31')
    expect(r.setoran.map((x) => x.tanggal_jual)).toEqual(['2026-10-01', '2026-10-02'])
    expect(r.total).toBe(430100)
  })

  it('di luar rentang & outlet tes dibuang; per outlet bernama', () => {
    const r = ringkasSetoran(
      [s({}), s({ tanggalJual: '2026-09-30' }), s({ outletId: TEST_OUTLET_ID })],
      OUTLETS, '2026-10-01', '2026-10-31',
    )
    expect(r.jumlah).toBe(1)
    expect(r.per_outlet).toEqual([{ outlet: 'MITRA CIBINONG', total: 430000, jumlah: 1 }])
  })
})

describe('ringkasSelisihKasir', () => {
  const sh = (o: Partial<ShiftBaris>): ShiftBaris => ({
    outletId: 'o1', mulai: '2026-10-07T02:00:00Z', status: 'closed', seharusnya: 1000, fisik: 1000, selisih: 0, kasir: 'Andi', ...o,
  })

  it('jumlah per outlet hanya shift tutup; daftar hanya selisih bukan 0', () => {
    const r = ringkasSelisihKasir([sh({}), sh({ seharusnya: 500, fisik: 450, selisih: -50, kasir: 'Budi' })], OUTLETS, '2026-10-08')
    expect(r.per_outlet).toEqual([{ outlet: 'SUKA SHAWARMA EMPANG', shift_tutup: 2, seharusnya: 1500, fisik: 1450, selisih: -50 }])
    expect(r.shift_selisih).toEqual([{ tanggal: '2026-10-07', outlet: 'SUKA SHAWARMA EMPANG', kasir: 'Budi', seharusnya: 500, fisik: 450, selisih: -50 }])
    expect(r.total_selisih).toBe(-50)
  })

  it('shift belum tutup hari lalu masuk daftar, shift berjalan hari ini tidak', () => {
    const r = ringkasSelisihKasir(
      [sh({ status: 'open', mulai: '2026-10-06T03:00:00Z' }), sh({ status: 'open', mulai: '2026-10-08T01:00:00Z' })],
      OUTLETS, '2026-10-08',
    )
    expect(r.shift_belum_tutup).toEqual([{ tanggal: '2026-10-06', outlet: 'SUKA SHAWARMA EMPANG', kasir: 'Andi' }])
    expect(r.per_outlet).toEqual([])
  })

  it('tanggal shift memakai WIB; outlet tes dibuang', () => {
    const r = ringkasSelisihKasir([sh({ mulai: '2026-10-06T18:30:00Z', selisih: 10, fisik: 1010 }), sh({ outletId: TEST_OUTLET_ID, selisih: 5 })], OUTLETS, '2026-10-08')
    expect(r.shift_selisih[0].tanggal).toBe('2026-10-07')
    expect(r.shift_selisih).toHaveLength(1)
  })

  it('tglWib', () => {
    expect(tglWib('2026-10-07T18:30:00Z')).toBe('2026-10-08')
  })
})
