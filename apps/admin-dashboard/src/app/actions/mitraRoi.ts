'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { aggregateMitraRoiStats } from '@/lib/mitraRoiAggregate'

export async function getMitraRoiStats(outletId: string | 'all', allowedOutletIds: string[]) {
  const targetOutlets = outletId === 'all' ? allowedOutletIds : [outletId]
  if (targetOutlets.length === 0) {
    return aggregateMitraRoiStats({}, targetOutlets)
  }

  const bepMap = await getMitraRealtimeBepBreakdown(targetOutlets)
  return aggregateMitraRoiStats(bepMap, targetOutlets)
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
