'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

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
}

/**
 * Profil investasi mitra per outlet, dipetakan berdasarkan `outlet_id`.
 *
 * Dipakai halaman Laba Rugi untuk dua hal: memisahkan outlet mitra dari outlet
 * pusat, dan mengisi angka bagi hasil/BEP di ekspor CSV & PDF. Lewat React
 * Query supaya statusnya ikut terpantau — pemisahan internal/mitra tidak boleh
 * dihitung selagi daftar mitra masih kosong karena belum termuat.
 */
export function useMitraInvestments() {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<Record<string, MitraInvestmentExtended>>({
    queryKey: ['mitra-investments'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [invRes, transferRes] = await Promise.all([
        supabase.from('mitra_investments').select('*'),
        supabase.from('mitra_transfers').select('outlet_id, nominal'),
      ])
      if (invRes.error) throw invRes.error
      if (transferRes.error) throw transferRes.error

      const transfersByOutlet = new Map<string, number>()
      for (const t of transferRes.data ?? []) {
        if (!t.outlet_id) continue
        transfersByOutlet.set(t.outlet_id, (transfersByOutlet.get(t.outlet_id) ?? 0) + (Number(t.nominal) || 0))
      }

      const map: Record<string, MitraInvestmentExtended> = {}
      for (const inv of invRes.data ?? []) {
        const outletTransfers = transfersByOutlet.get(inv.outlet_id) ?? 0
        const totalDanaKembali = Number(inv.omzet_historis || 0) + Number(inv.transfer_historis || 0) + outletTransfers
        const modalInvestasi = Number(inv.nilai_investasi) || 0
        const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi

        map[inv.outlet_id] = {
          ...inv,
          totalTransfers: outletTransfers,
          totalDanaKembali,
          isBep,
        }
      }
      return map
    },
  })

  return {
    investments: query.data ?? {},
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
