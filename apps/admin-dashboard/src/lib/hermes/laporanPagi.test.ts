import { teksLaporanPagiCeo, teksLaporanMalamPenjualan, teksLaporanAbsensiHarian, type DataLaporanAbsensi } from './laporanPagi'
import { labelTanggal } from '@/lib/sukaBot/periode'
import type { DataRekap } from '@/lib/sukaBot/rekap'

const d: DataRekap = {
  tanggal: '2026-10-06', pembanding: '2026-09-29',
  omzet: 48_500_000, omzetPembanding: 51_000_000, transaksi: 1234, totalQty: 1234,
  ranking: [
    { peringkat: 1, nama: 'EMPANG', omzet: 6_000_000, qty: 150 },
    { peringkat: 2, nama: 'BEJI', omzet: 4_000_000, qty: 100 },
    { peringkat: 3, nama: 'KALISARI', omzet: 0, qty: 0 },
  ],
  menuTeratas: [{ nama: 'Original Sapi Jumbo', qty: 320 }, { nama: 'Original Ayam Jumbo', qty: 290 }, { nama: 'Ice Tea', qty: 150 }],
}

describe('teksLaporanPagiCeo', () => {
  const t = teksLaporanPagiCeo(d)
  it('memuat header standar, tanggal, omzet & pembanding dengan icon trend', () => {
    expect(t).toContain('📊 LAPORAN PENJUALAN HARIAN')
    expect(t).toContain(labelTanggal('2026-10-06'))
    expect(t).toContain('Omzet Total: Rp 48.500.000')
    expect(t).toContain('📉 vs Minggu Lalu: Rp 51.000.000 (-4.9%)')
    expect(t).toContain('Total Transaksi: 1.234 struk')
    expect(t).toContain('Rata-rata Struk (ATV): Rp 39.303')
  })
  it('memuat ranking seluruh outlet dengan porsi dan outlet tanpa penjualan', () => {
    expect(t).toContain('1. EMPANG — Rp 6.000.000 (150 porsi)')
    expect(t).toContain('2. BEJI — Rp 4.000.000 (100 porsi)')
    expect(t).toContain('3. KALISARI — Rp 0 (0 porsi)')
    expect(t).toContain('Outlet tanpa penjualan: KALISARI')
  })
  it('memuat 3 menu terlaris berurutan dan sumber', () => {
    expect(t).toMatch(/1\. Original Sapi Jumbo — 320 porsi\n  2\. Original Ayam Jumbo — 290 porsi\n  3\. Ice Tea — 150 porsi/)
    expect(t).toContain('Sumber: Rangkuman Penjualan')
    expect(t).toContain('tanpa SS Online')
  })
  it('ranking kosong tidak meledak', () => {
    const k = teksLaporanPagiCeo({ ...d, ranking: [], menuTeratas: [] })
    expect(k).toContain('Ranking Seluruh Outlet:\n  —')
  })
})

describe('teksLaporanMalamPenjualan', () => {
  const t = teksLaporanMalamPenjualan(d, '22:00 WIB')
  it('memuat judul penutupan malam dan cut-off jam', () => {
    expect(t).toContain('LAPORAN CLOSING PENJUALAN (Cut-off 22:00 WIB)')
    expect(t).toContain('Omzet Total Closing: Rp 48.500.000')
    expect(t).toContain('📉 vs Minggu Lalu: Rp 51.000.000 (-4.9%)')
  })
  it('memuat top outlet dan menu terlaris', () => {
    expect(t).toContain('1. EMPANG — Rp 6.000.000 (150 porsi)')
    expect(t).toContain('Original Sapi Jumbo — 320 porsi')
  })
})

describe('teksLaporanAbsensiHarian', () => {
  const dataAbsensi: DataLaporanAbsensi = {
    tanggal: '2026-10-07',
    jamWib: '11.00 WIB',
    total: { staf: 50, hadir: 45, telat: 3, telat_toleransi: 2, belum: 2, alpa: 1, cuti: 2, libur: 0 },
    daftarTelat: [
      { nama: 'Ahmad', outlet: 'EMPANG', menit: 35, jam: '08:35' },
      { nama: 'Bambang', outlet: 'BEJI', menit: 12, jam: '08:12' },
    ],
    daftarCuti: [{ nama: 'Citra', outlet: 'DTC', keterangan: 'Cuti Tahunan' }],
  }
  const t = teksLaporanAbsensiHarian(dataAbsensi)
  it('memuat ringkasan kehadiran, tepat waktu, dan keterlambatan', () => {
    expect(t).toContain('Rekap Presensi Kru Operasional')
    expect(t).toContain('Total kru terjadwal: 50 orang')
    expect(t).toContain('Hadir tepat waktu: 40 orang')
    expect(t).toContain('Terlambat: 5 orang (3 di luar toleransi, 2 toleransi)')
    expect(t).toContain('1. Ahmad (EMPANG) — 35 mnt [Masuk 08:35]')
    expect(t).toContain('Citra (DTC): Cuti Tahunan')
  })
  it('tidak meledak bila tidak ada yang telat', () => {
    const bersih = teksLaporanAbsensiHarian({ ...dataAbsensi, daftarTelat: [] })
    expect(bersih).toContain('Tidak ada keterlambatan tercatat hari ini')
  })
})
