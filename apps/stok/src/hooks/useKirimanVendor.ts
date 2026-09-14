'use client'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BarisRekap, BarisRincian } from '@/lib/stok/kirimanVendor'

export type FilterKirimanVendor = { dari: string; sampai: string; outlet: string | null; bahan: string | null; vendor: string | null }
export const UKURAN_HALAMAN = 50
export const BATAS_REKAP = 1000

const params = (f: FilterKirimanVendor) => ({ p_dari: f.dari, p_sampai: f.sampai, p_outlet: f.outlet, p_bahan: f.bahan, p_vendor: f.vendor })

export function useRincianKirimanVendor(filter: FilterKirimanVendor, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['kiriman-vendor', 'rincian', filter, page],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('laporan_kiriman_vendor_rincian', {
        ...params(filter), p_limit: UKURAN_HALAMAN, p_offset: page * UKURAN_HALAMAN,
      })
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as BarisRincian[]
      return { rows, total: rows.length ? Number(rows[0].total_count) : 0 }
    },
  })
}

export function useRekapKirimanVendor(filter: FilterKirimanVendor, enabled: boolean) {
  return useQuery({
    queryKey: ['kiriman-vendor', 'rekap', filter],
    enabled,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('laporan_kiriman_vendor_rekap', params(filter))
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as BarisRekap[]
      return { rows, terpotong: rows.length >= BATAS_REKAP }
    },
  })
}
