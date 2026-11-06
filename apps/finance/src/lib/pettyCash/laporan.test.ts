import { describe, it, expect } from 'vitest'
import { kelompokkanPerHari, labelKategori, perOutlet, ringkas, saring, tanggalWib } from './laporan'
import type { PettyCashTransaction } from '@/components/owner/PettyCashReportView'

const tx = (p: Partial<PettyCashTransaction>): PettyCashTransaction => ({
  id: Math.random().toString(),
  outlet_id: 'a',
  outlet_name: 'Outlet A',
  transaction_date: '2026-11-06T08:00:00Z',
  type: 'out',
  category: 'transport',
  description: 'antar omset',
  amount: 10_000,
  staff_name: 'Zikri',
  receipt_url: 'https://x/nota.jpg',
  ...p,
})

describe('laporan petty cash', () => {
  it('tanggal mengikuti WIB, bukan UTC', () => {
    // 5 Nov 20:00 UTC = 6 Nov 03:00 WIB
    expect(tanggalWib('2026-11-05T20:00:00Z')).toBe('2026-11-06')
    expect(tanggalWib('2026-11-06')).toBe('2026-11-06')
  })

  it('label kategori dari meta, sisanya dirapikan', () => {
    expect(labelKategori('bahan_baku')).toBe('Bahan Baku Lainnya')
    expect(labelKategori('Top Up Petty Cash')).toBe('Top Up Petty Cash')
    expect(labelKategori('biaya_aneh')).toBe('Biaya aneh')
  })

  it('ringkasan menghitung tanpa nota hanya untuk pengeluaran', () => {
    const r = ringkas([
      tx({ type: 'in', amount: 50_000, receipt_url: null }),
      tx({ amount: 10_000, receipt_url: null }),
      tx({ amount: 5_000 }),
    ])
    expect(r).toMatchObject({ masuk: 50_000, keluar: 15_000, selisih: 35_000, jumlahMasuk: 1, jumlahKeluar: 2, tanpaNota: 1 })
  })

  it('kelompok per hari, terbaru dulu, dengan label Hari ini/Kemarin', () => {
    const now = new Date('2026-11-06T12:00:00+07:00')
    const g = kelompokkanPerHari(
      [
        tx({ transaction_date: '2026-11-05T10:00:00Z' }),
        tx({ transaction_date: '2026-11-06T01:00:00Z' }),
        tx({ transaction_date: '2026-11-03T01:00:00Z' }),
      ],
      now,
    )
    expect(g.map((x) => x.label.split(',')[0])).toEqual(['Hari ini', 'Kemarin', 'Selasa'])
  })

  it('per outlet urut pengeluaran terbesar', () => {
    const r = perOutlet([tx({ outlet_id: 'a', amount: 5 }), tx({ outlet_id: 'b', outlet_name: 'B', amount: 9 })])
    expect(r.map((o) => o.outletId)).toEqual(['b', 'a'])
  })

  it('saringan tanpa nota & cari label kategori', () => {
    const rows = [tx({ receipt_url: null, category: 'bahan_baku' }), tx({}), tx({ type: 'in', receipt_url: null })]
    const dasar = { outletId: 'all', tipe: 'all' as const, kategori: null, cari: '', hanyaTanpaNota: false }
    expect(saring(rows, { ...dasar, hanyaTanpaNota: true })).toHaveLength(1)
    expect(saring(rows, { ...dasar, cari: 'bahan baku' })).toHaveLength(1)
  })
})

import { statusSaldo, urutkanSaldo, type SaldoOutlet } from './laporan'

describe('saldo petty cash per outlet', () => {
  const s = (nama: string, saldo: number | null): SaldoOutlet => ({ outletId: nama, nama, saldo, shiftAktif: true, dihitungPada: null })

  it('status: habis, menipis di bawah 150 rb, galat bila gagal dibaca', () => {
    expect(statusSaldo(s('a', 0))).toBe('habis')
    expect(statusSaldo(s('a', 149_999))).toBe('menipis')
    expect(statusSaldo(s('a', 150_000))).toBe('aman')
    expect(statusSaldo(s('a', null))).toBe('galat')
  })

  it('urutan: galat, habis, menipis, lalu saldo terkecil', () => {
    const r = urutkanSaldo([s('aman2', 500_000), s('tipis', 90_000), s('aman1', 200_000), s('nol', 0), s('err', null)])
    expect(r.map((x) => x.nama)).toEqual(['err', 'nol', 'tipis', 'aman1', 'aman2'])
  })

  it('urut nama dan nominal; gagal dibaca di akhir untuk nominal', () => {
    const rows = [s('Beji', 300_000), s('Akasia', 100_000), s('Cimanggu', null), s('Depok', 500_000)]
    expect(urutkanSaldo(rows, 'nama').map((x) => x.nama)).toEqual(['Akasia', 'Beji', 'Cimanggu', 'Depok'])
    expect(urutkanSaldo(rows, 'nominal_besar').map((x) => x.nama)).toEqual(['Depok', 'Beji', 'Akasia', 'Cimanggu'])
    expect(urutkanSaldo(rows, 'nominal_kecil').map((x) => x.nama)).toEqual(['Akasia', 'Beji', 'Depok', 'Cimanggu'])
  })
})
