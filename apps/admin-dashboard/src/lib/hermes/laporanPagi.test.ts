import { teksLaporanPagiCeo } from './laporanPagi'
import { labelTanggal } from '@/lib/sukaBot/periode'
import type { DataRekap } from '@/lib/sukaBot/rekap'

const d: DataRekap = {
  tanggal: '2026-10-06', pembanding: '2026-09-29',
  omzet: 48_500_000, omzetPembanding: 51_000_000, transaksi: 1234,
  ranking: [
    { peringkat: 1, nama: 'EMPANG', omzet: 6_000_000 },
    { peringkat: 2, nama: 'BEJI', omzet: 4_000_000 },
    { peringkat: 3, nama: 'KALISARI', omzet: 0 },
  ],
  menuTeratas: [{ nama: 'Original Sapi Jumbo', qty: 320 }, { nama: 'Original Ayam Jumbo', qty: 290 }, { nama: 'Ice Tea', qty: 150 }],
}

describe('teksLaporanPagiCeo', () => {
  const t = teksLaporanPagiCeo(d)
  it('memuat tanggal, omzet & pembanding dalam rupiah, tanpa persen', () => {
    expect(t).toContain(labelTanggal('2026-10-06'))
    expect(t).toContain('Omzet kotor: Rp 48.500.000')
    expect(t).toContain(`Minggu lalu (${labelTanggal('2026-09-29')}): Rp 51.000.000`)
    expect(t).not.toMatch(/%/)
  })
  it('memuat transaksi, tertinggi, terendah, dan outlet tanpa penjualan', () => {
    expect(t).toContain('Transaksi: 1.234')
    expect(t).toContain('Tertinggi: EMPANG — Rp 6.000.000')
    expect(t).toContain('Terendah: KALISARI — Rp 0')
    expect(t).toContain('Tanpa penjualan: KALISARI')
  })
  it('memuat 3 menu terlaris berurutan dan sumber', () => {
    expect(t).toMatch(/1\. Original Sapi Jumbo — 320 porsi\n2\. Original Ayam Jumbo — 290 porsi\n3\. Ice Tea — 150 porsi/)
    expect(t).toContain('Sumber: Rangkuman Penjualan')
    expect(t).toContain('tanpa SS Online')
  })
  it('ranking kosong tidak meledak', () => {
    const k = teksLaporanPagiCeo({ ...d, ranking: [], menuTeratas: [] })
    expect(k).toContain('Tertinggi: —')
    expect(k).toContain('Terendah: —')
  })
})
