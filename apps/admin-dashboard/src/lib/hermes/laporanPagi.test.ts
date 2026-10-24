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
    expect(t).toContain('📊 <b>LAPORAN PENJUALAN HARIAN</b>')
    expect(t).toContain(labelTanggal('2026-10-06'))
    expect(t).toContain('<b>Omzet Total:</b> <code>Rp 48.500.000</code>')
    expect(t).toContain('📉 <b>vs Minggu Lalu:</b> <code>Rp 51.000.000</code> (<code>-4.9%</code>)')
    expect(t).toContain('<b>Total Transaksi:</b> <code>1.234</code> struk')
    expect(t).toContain('<b>Rata-rata Struk (ATV):</b> <code>Rp 39.303</code>')
  })
  it('memuat ranking seluruh outlet dengan porsi dan outlet tanpa penjualan', () => {
    expect(t).toContain('🥇 1. <b>EMPANG</b> — <code>Rp 6.000.000</code> (<code>150</code> porsi)')
    expect(t).toContain('🥈 2. <b>BEJI</b> — <code>Rp 4.000.000</code> (<code>100</code> porsi)')
    expect(t).toContain('🥉 3. <b>KALISARI</b> — <code>Rp 0</code> (<code>0</code> porsi)')
    expect(t).toContain('<b>Outlet tanpa penjualan:</b> <code>KALISARI</code>')
  })
  it('memuat 3 menu terlaris berurutan dan sumber', () => {
    expect(t).toMatch(/1\. <b>Original Sapi Jumbo<\/b> — <code>320<\/code> porsi\n  2\. <b>Original Ayam Jumbo<\/b> — <code>290<\/code> porsi\n  3\. <b>Ice Tea<\/b> — <code>150<\/code> porsi/)
    expect(t).toContain('Sumber: Rangkuman Penjualan')
    expect(t).toContain('tanpa SS Online')
  })
  it('ranking kosong tidak meledak', () => {
    const k = teksLaporanPagiCeo({ ...d, ranking: [], menuTeratas: [] })
    expect(k).toContain('<b>Ranking Seluruh Outlet:</b>\n  —')
  })
})

describe('teksLaporanMalamPenjualan', () => {
  const t = teksLaporanMalamPenjualan(d, '22:00 WIB')
  it('memuat judul penutupan malam dan cut-off jam', () => {
    expect(t).toContain('LAPORAN CLOSING PENJUALAN')
    expect(t).toContain('(22:00 WIB)')
    expect(t).toContain('<b>Omzet Total:</b> <code>Rp 48.500.000</code>')
    expect(t).toContain('📉 <b>vs Minggu Lalu:</b> <code>Rp 51.000.000</code> (<code>-4.9%</code>)')
  })
  it('memuat top outlet dan menu terlaris', () => {
    expect(t).toContain('🥇 1. <b>EMPANG</b> — <code>Rp 6.000.000</code> (<code>150</code> porsi)')
    expect(t).toContain('Original Sapi Jumbo')
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
    expect(t).toContain('Total kru terjadwal: <code>50</code> orang')
    expect(t).toContain('Hadir tepat waktu: <code>40</code> orang')
    expect(t).toContain('Terlambat: <code>5</code> orang (<code>3</code> di luar toleransi, <code>2</code> toleransi)')
    expect(t).toContain('1. <b>Ahmad</b> (EMPANG) — <code>35 mnt</code> [Masuk 08:35]')
    expect(t).toContain('<b>Citra</b> (DTC): Cuti Tahunan')
  })
  it('tidak meledak bila tidak ada yang telat', () => {
    const bersih = teksLaporanAbsensiHarian({ ...dataAbsensi, daftarTelat: [] })
    expect(bersih).toContain('Tidak ada keterlambatan tercatat hari ini')
  })
})
