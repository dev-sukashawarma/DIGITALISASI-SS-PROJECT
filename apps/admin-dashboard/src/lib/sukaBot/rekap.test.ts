import { describe, it, expect, vi } from 'vitest'
import { tanggalRekapUntuk, hitungRekap, teksRekap, type DataRekap } from './rekap'

describe('tanggalRekapUntuk', () => {
  it('sebelum 05:00 WIB → H-2', () => {
    expect(tanggalRekapUntuk(new Date('2026-10-02T21:59:00Z'))).toBe('2026-10-01') // Sab 04:59 WIB 3 Okt
  })
  it('mulai 05:00 WIB → H-1', () => {
    expect(tanggalRekapUntuk(new Date('2026-10-02T22:00:00Z'))).toBe('2026-10-02') // Sab 05:00 WIB 3 Okt
  })
})

describe('hitungRekap', () => {
  it('total & pembanding H-7, transaksi, menu teratas dari semua outlet terhitung; ranking tanpa pembanding', async () => {
    const ambilLaporan = vi.fn(async (r: any) => {
      const hari = r.dari === '2026-10-02' ? 1 : 0.5
      const omzet = r.outletIds.length * 1_000_000 * hari
      return { omzetKotor: omzet, omzetBersih: omzet, transaksi: r.outletIds.length * 20, menu: [{ nama: 'A', qty: 5, omzet: 1 }, { nama: 'B', qty: 9, omzet: 1 }, { nama: 'C', qty: 7, omzet: 1 }, { nama: 'D', qty: 1, omzet: 1 }] }
    })
    const d = await hitungRekap({
      ambilLaporan, hariIni: '2026-10-03', sekarang: new Date(),
      outlets: [
        { id: 'a', name: 'SUKA SHAWARMA BEJI', type: 'internal', is_active: true },
        { id: 'b', name: 'MITRA CIBUBUR', type: 'mitra', is_active: true },
        { id: 't', name: 'outlet tes', type: 'test', is_active: true },
      ],
    }, '2026-10-02')
    expect(d).toMatchObject({ tanggal: '2026-10-02', pembanding: '2026-09-25', omzet: 2_000_000, omzetPembanding: 1_000_000, transaksi: 40 })
    expect(d).not.toHaveProperty('persen')
    expect(d.menuTeratas).toEqual([{ nama: 'B', qty: 9 }, { nama: 'C', qty: 7 }, { nama: 'A', qty: 5 }])
    expect(d.ranking).toHaveLength(2)
    expect(ambilLaporan).toHaveBeenCalledWith({ dari: '2026-10-02', sampai: '2026-10-02', outletIds: ['a', 'b'], kanal: ['all'] })
    // Total: 2 panggilan (H & H-7). Ranking: 1 per outlet (2), tanpa pembanding.
    expect(ambilLaporan).toHaveBeenCalledTimes(4)
  })
})

describe('teksRekap', () => {
  it('menyusun rekap lengkap tanpa AI, tanpa persentase omzet', () => {
    const d: DataRekap = {
      tanggal: '2026-10-02', pembanding: '2026-09-25', omzet: 48_200_000, omzetPembanding: 51_300_000, transaksi: 1240,
      ranking: [
        { peringkat: 1, nama: 'MITRA CIBUBUR', omzet: 6_100_000 },
        { peringkat: 2, nama: 'SUKA SHAWARMA BEJI', omzet: 4_000_000 },
      ],
      menuTeratas: [{ nama: 'Original Sapi Jumbo', qty: 310 }],
    }
    const teks = teksRekap(d)
    expect(teks).not.toContain('%')
    expect(teks).toBe([
      'Rekap penjualan Jum 2 Okt 2026, Bos 👋',
      '',
      'Omzet kotor: Rp 48.200.000 (Jum 25 Sep 2026: Rp 51.300.000)',
      'Transaksi: 1.240',
      '',
      'Ranking outlet:',
      '1. MITRA CIBUBUR — Rp 6.100.000',
      '2. SUKA SHAWARMA BEJI — Rp 4.000.000',
      '',
      'Menu terlaris:',
      '1. Original Sapi Jumbo — 310 porsi',
      '',
      'Sumber: Rangkuman Penjualan (omzet kotor, tanpa SS Online).',
    ].join('\n'))
  })
})
