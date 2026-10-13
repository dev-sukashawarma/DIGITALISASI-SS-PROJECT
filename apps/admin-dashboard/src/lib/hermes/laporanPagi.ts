import type { DataRekap } from '@/lib/sukaBot/rekap'
import { rupiah } from '@/lib/sukaBot/format'
import { labelTanggal } from '@/lib/sukaBot/periode'

// Teks dirakit kode, bukan AI (spec K12). Format disesuaikan dengan permintaan owner.
export function teksLaporanPagiCeo(d: DataRekap): string {
  const nol = d.ranking.filter((r) => r.omzet <= 0).map((r) => r.nama)
  const atv = d.transaksi > 0 ? Math.round(d.omzet / d.transaksi) : 0
  const selisih = d.omzet - d.omzetPembanding
  const persenBanding = d.omzetPembanding > 0 ? ((selisih / d.omzetPembanding) * 100).toFixed(1) : '0'
  const iconBanding = selisih >= 0 ? '📈' : '📉'
  const tandaPersen = selisih > 0 ? '+' : ''
  const bandingStr = d.omzetPembanding > 0
    ? `${iconBanding} vs Minggu Lalu: ${rupiah(d.omzetPembanding)} (${tandaPersen}${persenBanding}%)`
    : `📈 vs Minggu Lalu: ${rupiah(d.omzetPembanding)}`

  return [
    '📊 LAPORAN PENJUALAN HARIAN',
    `🗓️ Hari/Tanggal: ${labelTanggal(d.tanggal)}`,
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    `💰 Omzet Total: ${rupiah(d.omzet)}`,
    bandingStr,
    `🧾 Total Transaksi: ${d.transaksi.toLocaleString('id-ID')} struk`,
    `💵 Rata-rata Struk (ATV): ${rupiah(atv)}`,
    '',
    '🏆 Ranking Seluruh Outlet:',
    ...(d.ranking.length
      ? d.ranking.map((r) => {
          const qtyStr = r.qty !== undefined ? ` (${r.qty.toLocaleString('id-ID')} porsi)` : ''
          return `  ${r.peringkat}. ${r.nama} — ${rupiah(r.omzet)}${qtyStr}`
        })
      : ['  —']),
    ...(nol.length ? ['', `⚠️ Outlet tanpa penjualan: ${nol.join(', ')}`] : []),
    '',
    '🥇 Top 3 Menu Terlaris:',
    ...(d.menuTeratas.length
      ? d.menuTeratas.slice(0, 3).map((m, i) => `  ${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`)
      : ['  —']),
    '',
    '📍 Sumber: Rangkuman Penjualan (omzet kotor, outlet internal + mitra, tanpa SS Online).',
  ].join('\n')
}

// Laporan penutupan malam (closing harian)
export function teksLaporanMalamPenjualan(d: DataRekap, jamWibStr?: string): string {
  const jamSuffix = jamWibStr ? ` (Cut-off ${jamWibStr})` : ''
  const nol = d.ranking.filter((r) => r.omzet <= 0).map((r) => r.nama)
  const atv = d.transaksi > 0 ? Math.round(d.omzet / d.transaksi) : 0
  const selisih = d.omzet - d.omzetPembanding
  const persenBanding = d.omzetPembanding > 0 ? ((selisih / d.omzetPembanding) * 100).toFixed(1) : '0'
  const iconBanding = selisih >= 0 ? '📈' : '📉'
  const tandaPersen = selisih > 0 ? '+' : ''
  const bandingStr = d.omzetPembanding > 0
    ? `${iconBanding} vs Minggu Lalu: ${rupiah(d.omzetPembanding)} (${tandaPersen}${persenBanding}%)`
    : `📈 vs Minggu Lalu: ${rupiah(d.omzetPembanding)}`

  return [
    `🌙 LAPORAN CLOSING PENJUALAN${jamSuffix}`,
    `🗓️ Hari/Tanggal: ${labelTanggal(d.tanggal)}`,
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    `💰 Omzet Total Closing: ${rupiah(d.omzet)}`,
    bandingStr,
    `🧾 Total Transaksi: ${d.transaksi.toLocaleString('id-ID')} struk`,
    `💵 Rata-rata Struk (ATV): ${rupiah(atv)}`,
    '',
    '🏆 Ranking Seluruh Outlet Hari Ini:',
    ...(d.ranking.length
      ? d.ranking.map((r) => {
          const qtyStr = r.qty !== undefined ? ` (${r.qty.toLocaleString('id-ID')} porsi)` : ''
          return `  ${r.peringkat}. ${r.nama} — ${rupiah(r.omzet)}${qtyStr}`
        })
      : ['  —']),
    ...(nol.length ? ['', `⚠️ Outlet tanpa penjualan: ${nol.join(', ')}`] : []),
    '',
    '🥇 Top 3 Menu Terlaris Hari Ini:',
    ...(d.menuTeratas.length
      ? d.menuTeratas.slice(0, 3).map((m, i) => `  ${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`)
      : ['  —']),
    '',
    `📍 Sumber: Rangkuman Penjualan (omzet kotor hari berjalan${jamSuffix}, internal + mitra, tanpa SS Online).`,
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
