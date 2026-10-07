'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/fetchAllPages'

export interface MitraTransferRecord {
  id: string
  outlet_id: string
  bulan: string | null
  nominal: number
}

export interface MitraInvestmentExtended {
  id: string
  outlet_id: string
  nilai_investasi: number
  tanggal_mulai: string | null
  catatan: string | null
  created_at: string
  updated_at: string
  omzet_historis: number
  transfer_historis: number
  is_profit_sharing_active: boolean
  persentase_bagi_hasil: number
  management_fee: number
  totalTransfers: number
  totalDanaKembali: number
  isBep: boolean
  transfers?: MitraTransferRecord[]
}

/**
 * Mengambil data profil investasi dan bukti transfer mitra per outlet dari sisi server
 * menggunakan service client agar bypass batasan RLS PostgREST client browser.
 */
export async function getMitraInvestmentsAction(): Promise<Record<string, MitraInvestmentExtended>> {
  const supabase = createServiceClient()

  const [invRes, transfers] = await Promise.all([
    supabase.from('mitra_investments').select('*'),
    fetchAllPages<MitraTransferRecord>(() =>
      supabase.from('mitra_transfers').select('id, outlet_id, bulan, nominal').order('id', { ascending: true })
    ),
  ])

  if (invRes.error) {
    console.error('Failed to fetch mitra_investments:', invRes.error)
    throw new Error(invRes.error.message)
  }

  const transfersByOutlet = new Map<string, MitraTransferRecord[]>()
  for (const t of transfers ?? []) {
    if (!t.outlet_id) continue
    const list = transfersByOutlet.get(t.outlet_id) || []
    list.push(t)
    transfersByOutlet.set(t.outlet_id, list)
  }

  const map: Record<string, MitraInvestmentExtended> = {}
  for (const inv of invRes.data ?? []) {
    const outletTransfersList = transfersByOutlet.get(inv.outlet_id) ?? []
    const outletTransfers = outletTransfersList.reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)
    const totalDanaKembali = Number(inv.omzet_historis || 0) + Number(inv.transfer_historis || 0) + outletTransfers
    const modalInvestasi = Number(inv.nilai_investasi) || 0
    const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi

    map[inv.outlet_id] = {
      ...inv,
      totalTransfers: outletTransfers,
      totalDanaKembali,
      isBep,
      transfers: outletTransfersList,
    }
  }

  return map
}
