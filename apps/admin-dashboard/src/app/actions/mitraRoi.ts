'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'

export async function getMitraRoiStats(outletId: string | 'all', allowedOutletIds: string[]) {
  const targetOutlets = outletId === 'all' ? allowedOutletIds : [outletId]
  if (targetOutlets.length === 0) {
    return {
      systemProfitMitra: 0,
      historisProfitMitra: 0,
      nilaiInvestasi: 0,
      totalProfitKumulatif: 0,
      roi: 0,
      bepPercentage: 0,
      sudahDiterima: 0,
      roiDiterima: 0
    }
  }

  const bepMap = await getMitraRealtimeBepBreakdown(targetOutlets)

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

  return {
    systemProfitMitra,
    historisProfitMitra,
    nilaiInvestasi,
    totalProfitKumulatif: totalDanaKembali,
    roi: Math.round(roi * 10) / 10,
    bepPercentage,
    sudahDiterima,
    roiDiterima: nilaiInvestasi > 0 ? Math.round((sudahDiterima / nilaiInvestasi) * 1000) / 10 : 0
  }
}

export interface MitraRealtimeBepItem {
  outletId: string
  modalInvestasi: number
  omzetHistoris: number
  transferHistoris: number
  revenue: number
  cogs: number
  opex: number
  managementFee: number
  netProfit: number
  mitraShare: number
  totalDanaKembali: number
  sisaModal: number
  roiPct: number
  bepPercentage: number
  isBep: boolean
  sudahDiterima: number
  roiDiterimaPct: number
}

export async function getMitraRealtimeBepBreakdown(mitraOutletIds: string[]): Promise<Record<string, MitraRealtimeBepItem>> {
  if (mitraOutletIds.length === 0) return {}

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Seluruh aturan bagi hasil kini hidup di fungsi database get_mitra_roi,
  // supaya web dan aplikasi Android memakai perhitungan yang sama persis.
  // Jalur cadangan yang dulu menarik seluruh order ke server lalu menghitung
  // ulang HPP sengaja dihapus: ia bisa menghasilkan angka berbeda dari jalur
  // utama tanpa ada yang tahu. Kegagalan kini tampil sebagai galat jujur.
  const { data, error } = await supabase.rpc('get_mitra_roi', {
    p_outlet_ids: mitraOutletIds,
    p_from: '2026-07-31T17:00:00.000Z',
    p_to: new Date().toISOString(),
  })

  if (error) throw new Error(`get_mitra_roi gagal: ${error.message}`)

  const resultMap: Record<string, MitraRealtimeBepItem> = {}
  for (const row of data || []) {
    resultMap[row.outlet_id] = {
      outletId: row.outlet_id,
      modalInvestasi: Number(row.modal_investasi) || 0,
      omzetHistoris: Number(row.omzet_historis) || 0,
      transferHistoris: Number(row.transfer_historis) || 0,
      revenue: Number(row.omzet) || 0,
      cogs: Number(row.cogs) || 0,
      opex: (Number(row.opex) || 0) + (Number(row.waste) || 0),
      managementFee: Number(row.management_fee) || 0,
      netProfit: Number(row.laba_bersih) || 0,
      mitraShare: Number(row.bagi_hasil_mitra) || 0,
      totalDanaKembali: Number(row.dana_kembali) || 0,
      sisaModal: Number(row.sisa_modal) || 0,
      roiPct: Number(row.roi_pct) || 0,
      bepPercentage: Number(row.bep_pct) || 0,
      isBep: Boolean(row.is_bep),
      sudahDiterima: Number(row.sudah_diterima) || 0,
      roiDiterimaPct: Number(row.roi_diterima_pct) || 0,
    }
  }
  return resultMap
}
