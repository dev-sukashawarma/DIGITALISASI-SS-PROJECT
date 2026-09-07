import type { MitraRealtimeBepItem } from '@/app/actions/mitraRoi'

export interface MitraRoiAggregateStats {
  systemProfitMitra: number
  historisProfitMitra: number
  nilaiInvestasi: number
  totalProfitKumulatif: number
  roi: number
  bepPercentage: number
  sudahDiterima: number
  roiDiterima: number
}

/**
 * Jumlahkan breakdown per-outlet (dari get_mitra_roi) jadi satu angka ringkas
 * untuk kartu dashboard mitra. Fungsi murni — tidak menyentuh network/DB —
 * supaya aritmetikanya bisa diuji tanpa mock Supabase.
 *
 * roiDiterima HARUS mengikuti basis yang sama dengan roi_diterima_pct di SQL
 * (omzet_historis + transfer_historis + sudah_diterima, dibagi modal), bukan
 * cuma sudah_diterima saja — kalau tidak, kartu "Sudah diterima" bisa
 * menampilkan angka satu digit padahal mitra sebenarnya sudah lewat BEP.
 */
export function aggregateMitraRoiStats(
  bepMap: Record<string, MitraRealtimeBepItem>,
  targetOutlets: string[]
): MitraRoiAggregateStats {
  let nilaiInvestasi = 0
  let historisProfitMitra = 0
  let systemProfitMitra = 0
  let totalDanaKembali = 0
  let sudahDiterima = 0

  for (const oid of targetOutlets) {
    const item = bepMap[oid]
    if (item) {
      nilaiInvestasi += item.modalInvestasi
      historisProfitMitra += (item.omzetHistoris + item.transferHistoris)
      systemProfitMitra += item.mitraShare
      totalDanaKembali += item.totalDanaKembali
      sudahDiterima += item.sudahDiterima
    }
  }

  const roi = nilaiInvestasi > 0 ? (totalDanaKembali / nilaiInvestasi) * 100 : 0
  const bepPercentage = Math.min(Math.round(roi * 10) / 10, 100)
  const roiDiterima = nilaiInvestasi > 0
    ? Math.round(((historisProfitMitra + sudahDiterima) / nilaiInvestasi) * 1000) / 10
    : 0

  return {
    systemProfitMitra,
    historisProfitMitra,
    nilaiInvestasi,
    totalProfitKumulatif: totalDanaKembali,
    roi: Math.round(roi * 10) / 10,
    bepPercentage,
    sudahDiterima,
    roiDiterima
  }
}
