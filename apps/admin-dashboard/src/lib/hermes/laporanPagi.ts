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
    ? `${iconBanding} <b>vs Minggu Lalu:</b> <code>${rupiah(d.omzetPembanding)}</code> (<code>${tandaPersen}${persenBanding}%</code>)`
    : `📈 <b>vs Minggu Lalu:</b> <code>${rupiah(d.omzetPembanding)}</code>`

  return [
    '📊 <b>LAPORAN PENJUALAN HARIAN</b>',
    `🗓️ Hari/Tanggal: <b>${labelTanggal(d.tanggal)}</b>`,
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    `💰 <b>Omzet Total:</b> <code>${rupiah(d.omzet)}</code>`,
    bandingStr,
    `🧾 <b>Total Transaksi:</b> <code>${d.transaksi.toLocaleString('id-ID')}</code> struk`,
    `💵 <b>Rata-rata Struk (ATV):</b> <code>${rupiah(atv)}</code>`,
    '',
    '🏆 <b>Ranking Seluruh Outlet:</b>',
    ...(d.ranking.length
      ? d.ranking.map((r) => {
          const medal = r.peringkat === 1 ? '🥇 ' : r.peringkat === 2 ? '🥈 ' : r.peringkat === 3 ? '🥉 ' : '   '
          const qtyStr = r.qty !== undefined ? ` (<code>${r.qty.toLocaleString('id-ID')}</code> porsi)` : ''
          return `  ${medal}${r.peringkat}. <b>${r.nama}</b> — <code>${rupiah(r.omzet)}</code>${qtyStr}`
        })
      : ['  —']),
    ...(nol.length ? ['', `⚠️ <b>Outlet tanpa penjualan:</b> <code>${nol.join(', ')}</code>`] : []),
    '',
    '🥇 <b>Top 3 Menu Terlaris:</b>',
    ...(d.menuTeratas.length
      ? d.menuTeratas.slice(0, 3).map((m, i) => `  ${i + 1}. <b>${m.nama}</b> — <code>${m.qty.toLocaleString('id-ID')}</code> porsi`)
      : ['  —']),
    '',
    '<blockquote>📍 <i>Sumber: Rangkuman Penjualan (omzet kotor, outlet internal + mitra, tanpa SS Online).</i></blockquote>',
  ].join('\n')
}

// Laporan penutupan malam (closing harian)
export function teksLaporanMalamPenjualan(d: DataRekap, jamWibStr?: string): string {
  const jamSuffix = jamWibStr ? ` (${jamWibStr})` : ' (Closing 22:00 WIB)'
  const nol = d.ranking.filter((r) => r.omzet <= 0).map((r) => r.nama)
  const atv = d.transaksi > 0 ? Math.round(d.omzet / d.transaksi) : 0
  const selisih = d.omzet - d.omzetPembanding
  const persenBanding = d.omzetPembanding > 0 ? ((selisih / d.omzetPembanding) * 100).toFixed(1) : '0'
  const iconBanding = selisih >= 0 ? '📈' : '📉'
  const tandaPersen = selisih > 0 ? '+' : ''
  const bandingStr = d.omzetPembanding > 0
    ? `${iconBanding} <b>vs Minggu Lalu:</b> <code>${rupiah(d.omzetPembanding)}</code> (<code>${tandaPersen}${persenBanding}%</code>)`
    : `📈 <b>vs Minggu Lalu:</b> <code>${rupiah(d.omzetPembanding)}</code>`

  return [
    '🌙 <b>LAPORAN CLOSING PENJUALAN</b>',
    `🗓️ Hari/Tanggal: <b>${labelTanggal(d.tanggal)}${jamSuffix}</b>`,
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    `💰 <b>Omzet Total:</b> <code>${rupiah(d.omzet)}</code>`,
    bandingStr,
    `🧾 <b>Total Transaksi:</b> <code>${d.transaksi.toLocaleString('id-ID')}</code> struk`,
    `💵 <b>Rata-rata Struk (ATV):</b> <code>${rupiah(atv)}</code>`,
    '',
    '🏆 <b>Ranking Seluruh Outlet:</b>',
    ...(d.ranking.length
      ? d.ranking.map((r) => {
          const medal = r.peringkat === 1 ? '🥇 ' : r.peringkat === 2 ? '🥈 ' : r.peringkat === 3 ? '🥉 ' : '   '
          const qtyStr = r.qty !== undefined ? ` (<code>${r.qty.toLocaleString('id-ID')}</code> porsi)` : ''
          return `  ${medal}${r.peringkat}. <b>${r.nama}</b> — <code>${rupiah(r.omzet)}</code>${qtyStr}`
        })
      : ['  —']),
    ...(nol.length ? ['', `⚠️ <b>Outlet tanpa penjualan:</b> <code>${nol.join(', ')}</code>`] : []),
    '',
    '🥇 <b>Top 3 Menu Terlaris:</b>',
    ...(d.menuTeratas.length
      ? d.menuTeratas.slice(0, 3).map((m, i) => `  ${i + 1}. <b>${m.nama}</b> — <code>${m.qty.toLocaleString('id-ID')}</code> porsi`)
      : ['  —']),
    '',
    '<blockquote>📍 <i>Sumber: Rangkuman Penjualan (omzet kotor closing 22:00 WIB, internal + mitra, tanpa SS Online).</i></blockquote>',
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
    `👥 <b>Rekap Presensi Kru Operasional</b>`,
    `🗓️ Hari/Tanggal: <b>${labelTanggal(d.tanggal)}${jamSuffix}</b>`,
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    '📊 <b>Ringkasan Kehadiran:</b>',
    `• Total kru terjadwal: <code>${d.total.staf}</code> orang`,
    `• Hadir tepat waktu: <code>${tepatWaktu}</code> orang`,
    `• Terlambat: <code>${d.total.telat + d.total.telat_toleransi}</code> orang (<code>${d.total.telat}</code> di luar toleransi, <code>${d.total.telat_toleransi}</code> toleransi)`,
    `• Izin / Cuti / Sakit: <code>${d.total.cuti}</code> orang`,
    `• Belum hadir: <code>${d.total.belum}</code> orang`,
    `• Alpa: <code>${d.total.alpa}</code> orang`,
    '',
  ]

  if (d.daftarTelat.length > 0) {
    baris.push('⚠️ <b>Rincian Keterlambatan:</b>')
    d.daftarTelat.slice(0, 10).forEach((t, i) => {
      const jamMasuk = t.jam ? ` [Masuk ${t.jam}]` : ''
      baris.push(`${i + 1}. <b>${t.nama}</b> (${t.outlet}) — <code>${t.menit} mnt</code>${jamMasuk}`)
    })
    if (d.daftarTelat.length > 10) {
      baris.push(`<i>... dan ${d.daftarTelat.length - 10} staf lainnya.</i>`)
    }
    baris.push('')
  } else {
    baris.push('✅ <i>Tidak ada keterlambatan tercatat hari ini.</i>')
    baris.push('')
  }

  if (d.daftarCuti.length > 0) {
    baris.push('🏖️ <b>Kru Izin / Cuti / Sakit:</b>')
    d.daftarCuti.slice(0, 8).forEach((c) => {
      baris.push(`• <b>${c.nama}</b> (${c.outlet}): ${c.keterangan}`)
    })
    baris.push('')
  }

  baris.push('<blockquote>📍 <i>Sumber: Papan Kehadiran (app absensi).</i></blockquote>')
  return baris.join('\n')
}
