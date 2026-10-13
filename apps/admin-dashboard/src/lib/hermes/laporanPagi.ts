import type { DataRekap } from '@/lib/sukaBot/rekap'
import { rupiah } from '@/lib/sukaBot/format'
import { labelTanggal } from '@/lib/sukaBot/periode'

// Teks dirakit kode, bukan AI (spec K12). Omzet tanpa persen (keputusan owner 2026-10-05).
export function teksLaporanPagiCeo(d: DataRekap): string {
  const atas = d.ranking[0]
  const bawah = d.ranking.length > 1 ? d.ranking[d.ranking.length - 1] : undefined
  const nol = d.ranking.filter((r) => r.omzet <= 0).map((r) => r.nama)
  return [
    `☀️ Laporan Pagi — ${labelTanggal(d.tanggal)}`,
    '',
    `Omzet kotor: ${rupiah(d.omzet)}`,
    `Minggu lalu (${labelTanggal(d.pembanding)}): ${rupiah(d.omzetPembanding)}`,
    `Transaksi: ${d.transaksi.toLocaleString('id-ID')}`,
    '',
    atas ? `Tertinggi: ${atas.nama} — ${rupiah(atas.omzet)}` : 'Tertinggi: —',
    bawah ? `Terendah: ${bawah.nama} — ${rupiah(bawah.omzet)}` : 'Terendah: —',
    ...(nol.length ? [`Tanpa penjualan: ${nol.join(', ')}`] : []),
    '',
    'Menu terlaris:',
    ...(d.menuTeratas.length
      ? d.menuTeratas.map((m, i) => `${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`)
      : ['—']),
    '',
    'Sumber: Rangkuman Penjualan (omzet kotor, outlet internal + mitra, tanpa SS Online).',
  ].join('\n')
}

// Laporan penutupan malam (closing harian)
export function teksLaporanMalamPenjualan(d: DataRekap, jamWibStr?: string): string {
  const jamSuffix = jamWibStr ? ` (Cut-off ${jamWibStr})` : ''
  const top5 = d.ranking.slice(0, 5)
  const nol = d.ranking.filter((r) => r.omzet <= 0).map((r) => r.nama)
  const selisih = d.omzet - d.omzetPembanding
  const tanda = selisih >= 0 ? '+' : '-'
  const infoBanding = `Minggu lalu (${labelTanggal(d.pembanding)}): ${rupiah(d.omzetPembanding)} (${tanda}${rupiah(Math.abs(selisih))})`

  return [
    `🌙 Laporan Penutupan Malam — ${labelTanggal(d.tanggal)}${jamSuffix}`,
    '',
    `Omzet kotor hari ini: ${rupiah(d.omzet)}`,
    infoBanding,
    `Total transaksi: ${d.transaksi.toLocaleString('id-ID')}`,
    '',
    'Top Outlet Hari Ini:',
    ...(top5.length
      ? top5.map((r) => `${r.peringkat}. ${r.nama} — ${rupiah(r.omzet)}`)
      : ['—']),
    ...(nol.length ? ['', `Outlet tanpa penjualan: ${nol.join(', ')}`] : []),
    '',
    'Menu terlaris hari ini:',
    ...(d.menuTeratas.length
      ? d.menuTeratas.map((m, i) => `${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`)
      : ['—']),
    '',
    `Sumber: Rangkuman Penjualan (omzet kotor hari berjalan${jamSuffix}, internal + mitra, tanpa SS Online).`,
  ].join('\n')
}

export interface DataLaporanAbsensi {
  tanggal: string
  jamWib?: string
  total: {
    staf: number
    hadir: number
    telat: number
    telat_toleransi: number
    belum: number
    alpa: number
    cuti: number
    libur: number
  }
  daftarTelat: { nama: string; outlet: string; menit: number; jam?: string }[]
  daftarCuti: { nama: string; outlet: string; keterangan: string }[]
}

export function teksLaporanAbsensiHarian(d: DataLaporanAbsensi): string {
  const jamSuffix = d.jamWib ? ` (Pukul ${d.jamWib})` : ''
  const tepatWaktu = Math.max(0, d.total.hadir - d.total.telat - d.total.telat_toleransi)

  const baris = [
    `👥 Rekap Presensi Kru Operasional — ${labelTanggal(d.tanggal)}${jamSuffix}`,
    '',
    '📊 Ringkasan Kehadiran:',
    `• Total kru terjadwal: ${d.total.staf} orang`,
    `• Hadir tepat waktu: ${tepatWaktu} orang`,
    `• Terlambat: ${d.total.telat + d.total.telat_toleransi} orang (${d.total.telat} di luar toleransi, ${d.total.telat_toleransi} toleransi)`,
    `• Izin / Cuti / Sakit: ${d.total.cuti} orang`,
    `• Belum hadir: ${d.total.belum} orang`,
    `• Alpa: ${d.total.alpa} orang`,
    '',
  ]

  if (d.daftarTelat.length > 0) {
    baris.push('⚠️ Rincian Keterlambatan:')
    d.daftarTelat.slice(0, 10).forEach((t, i) => {
      const jamMasuk = t.jam ? ` [Masuk ${t.jam}]` : ''
      baris.push(`${i + 1}. ${t.nama} (${t.outlet}) — ${t.menit} mnt${jamMasuk}`)
    })
    if (d.daftarTelat.length > 10) {
      baris.push(`... dan ${d.daftarTelat.length - 10} staf lainnya.`)
    }
    baris.push('')
  } else {
    baris.push('✅ Tidak ada keterlambatan tercatat hari ini.')
    baris.push('')
  }

  if (d.daftarCuti.length > 0) {
    baris.push('🏖️ Kru Izin / Cuti / Sakit:')
    d.daftarCuti.slice(0, 8).forEach((c) => {
      baris.push(`• ${c.nama} (${c.outlet}): ${c.keterangan}`)
    })
    baris.push('')
  }

  baris.push('Sumber: Papan Kehadiran (app absensi).')
  return baris.join('\n')
}
