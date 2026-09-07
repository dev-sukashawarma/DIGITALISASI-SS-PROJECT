'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

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
  const query = useQuery<Record<string, any>>({
    queryKey: ['mitra-investments'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('mitra_investments').select('*')
      if (error) throw error
      const map: Record<string, any> = {}
      for (const inv of data ?? []) map[inv.outlet_id] = inv
      return map
    },
  })

  return {
    investments: query.data ?? {},
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
