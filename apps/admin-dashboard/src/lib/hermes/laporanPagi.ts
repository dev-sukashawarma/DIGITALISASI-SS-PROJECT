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
